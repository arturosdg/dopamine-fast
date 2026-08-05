import "../assets/content.css";
import { FeedLimiter } from "../lib/feed-limiter";
import { InterventionUi } from "../lib/intervention-ui";
import { IntentionalSearchController } from "../lib/intentional-search";
import { availableUsageSeconds, localDateKey } from "../lib/models";
import { getPlatformAdapter } from "../lib/platforms";
import { PreferredFeedController } from "../lib/preferred-feed";
import { SingleItemViewController } from "../lib/single-item-view";
import { SurfaceSuppressionController } from "../lib/surface-suppression";
import {
  getDailyUsageState,
  getSettings,
  getUsageHistory,
  reserveAllowance,
  dailyUsageStateItem,
  settingsItem,
} from "../lib/storage";
import { usageForDate } from "../lib/usage-history";
import { UsageSession } from "../lib/usage-session";

export default defineContentScript({
  matches: [
    "*://reddit.com/*",
    "*://www.reddit.com/*",
    "*://x.com/*",
    "*://twitter.com/*",
    "*://www.instagram.com/*",
    "*://instagram.com/*",
    "*://www.youtube.com/*",
    "*://m.youtube.com/*",
    "*://youtube.com/*",
  ],
  runAt: "document_start",
  cssInjectionMode: "ui",

  async main(ctx) {
    const adapter = getPlatformAdapter(location.hostname);
    if (!adapter) return;

    if (document.readyState === "loading") {
      await new Promise<void>((resolve) => {
        document.addEventListener("DOMContentLoaded", () => resolve(), {
          once: true,
        });
      });
    }

    const shadowUi = await createShadowRootUi(ctx, {
      name: "dopamine-fast-layer",
      position: "inline",
      anchor: "body",
      append: "last",
      isolateEvents: true,
      onMount(container) {
        const root = document.createElement("div");
        root.className = "df-root";
        container.append(root);
        return new InterventionUi(root);
      },
      onRemove(ui) {
        ui?.hideAll();
      },
    });
    shadowUi.mount();

    const intervention = shadowUi.mounted;
    if (!intervention) return;

    let limiter: FeedLimiter | undefined;
    let intentionalSearch: IntentionalSearchController | undefined;
    let preferredFeed: PreferredFeedController | undefined;
    let singleItemView: SingleItemViewController | undefined;
    let surfaceSuppression: SurfaceSuppressionController | undefined;
    let usageSession: UsageSession | undefined;
    let currentUrl = "";
    let activationId = 0;

    const activate = async () => {
      const thisActivation = ++activationId;
      limiter?.destroy();
      limiter = undefined;
      intentionalSearch?.destroy();
      intentionalSearch = undefined;
      preferredFeed?.destroy();
      preferredFeed = undefined;
      singleItemView?.destroy();
      singleItemView = undefined;
      surfaceSuppression?.destroy();
      surfaceSuppression = undefined;
      const previousUsageSession = usageSession;
      usageSession = undefined;
      await previousUsageSession?.destroy();
      if (thisActivation !== activationId) return;
      intervention.hideAll();

      const url = new URL(location.href);
      const settings = await getSettings();
      if (thisActivation !== activationId) return;
      if (!settings.enabled || !settings.enabledSites[adapter.id]) {
        return;
      }

      const surfaceConfig = adapter.surfaceSuppression;
      const subscriptionsOnly =
        adapter.id === "youtube" && settings.youtubeSubscriptionsOnly;
      const canonicalUrl = surfaceConfig?.canonicalUrl(url);
      if (canonicalUrl && canonicalUrl.href !== url.href) {
        location.replace(canonicalUrl.href);
        return;
      }
      if (
        subscriptionsOnly &&
        surfaceConfig &&
        url.pathname === "/"
      ) {
        location.replace(new URL(surfaceConfig.subscriptionsPath, url).href);
        return;
      }
      if (surfaceConfig) {
        surfaceSuppression = new SurfaceSuppressionController(
          adapter,
          subscriptionsOnly,
        );
        surfaceSuppression.start();
      }

      if (
        adapter.intentionalSearch &&
        (settings.blockSuggested ||
          adapter.intentionalSearch.alwaysHideNavigation)
      ) {
        intentionalSearch = new IntentionalSearchController(
          adapter,
          url,
          settings.blockSuggested,
        );
        intentionalSearch.start();
      }

      if (adapter.singleItemView?.isRoute(url)) {
        singleItemView = new SingleItemViewController(adapter.singleItemView);
        singleItemView.start();
        return;
      }

      if (!adapter.isFeedRoute(url)) return;

      const followingOnly =
        (adapter.id === "x" && settings.xFollowingOnly) ||
        (adapter.id === "instagram" && settings.instagramFollowingOnly);
      if (followingOnly) {
        preferredFeed = new PreferredFeedController(adapter);
        preferredFeed.start();
      }

      const [usageState, usageHistory] = await Promise.all([
        getDailyUsageState(),
        getUsageHistory(),
      ]);
      const availableSeconds = availableUsageSeconds(
        settings,
        usageState,
        adapter.id,
      );
      if (thisActivation !== activationId) return;
      if (availableSeconds <= 0) {
        intervention.showHardLimitReached(adapter.label);
        return;
      }
      const todayUsage = usageForDate(usageHistory, localDateKey());

      const plannedSeconds = await intervention.showOpening({
        platformLabel: adapter.label,
        delaySeconds: settings.openingDelaySeconds,
        defaultSessionMinutes: settings.sessionDurationMinutes,
        availableSeconds,
        usageMetrics: [
          { label: "Reddit", usedSeconds: todayUsage.reddit },
          { label: "X", usedSeconds: todayUsage.x },
          { label: "Instagram", usedSeconds: todayUsage.instagram },
          { label: "YouTube", usedSeconds: todayUsage.youtube },
        ],
      });
      if (thisActivation !== activationId) return;
      if (plannedSeconds <= 0) return;

      const initialAllowance = await reserveAllowance(
        adapter.id,
        settings.batchSize,
      );
      if (thisActivation !== activationId) return;

      limiter = new FeedLimiter(
        adapter,
        settings,
        initialAllowance,
      );
      limiter.start();

      const session = new UsageSession({
        platform: adapter.id,
        platformLabel: adapter.label,
        plannedSeconds,
        availableSeconds,
        ui: intervention,
        onPlannedTimeElapsed(remainingSeconds) {
          void (async () => {
            const extensionSeconds = await intervention.showSessionEnded({
              platformLabel: adapter.label,
              defaultSessionMinutes: settings.sessionDurationMinutes,
              availableSeconds: remainingSeconds,
            });
            if (
              thisActivation !== activationId ||
              usageSession !== session
            ) {
              return;
            }
            if (extensionSeconds <= 0) return;
            session.extend(extensionSeconds);
          })();
        },
        onHardLimitReached() {
          if (
            thisActivation !== activationId ||
            usageSession !== session
          ) {
            return;
          }
          limiter?.destroy();
          limiter = undefined;
          intervention.showHardLimitReached(adapter.label);
        },
      });
      usageSession = session;
      session.start();
    };

    currentUrl = location.href;
    void activate();

    const navigationTimer = window.setInterval(() => {
      if (location.href === currentUrl) return;
      currentUrl = location.href;
      void activate();
    }, 600);

    const unwatchSettings = settingsItem.watch(() => {
      void activate();
    });

    const unwatchUsage = dailyUsageStateItem.watch(() => {
      const session = usageSession;
      const watchedActivation = activationId;
      if (!session) return;

      void (async () => {
        const [settings, usageState] = await Promise.all([
          getSettings(),
          getDailyUsageState(),
        ]);
        if (
          watchedActivation !== activationId ||
          session !== usageSession
        ) {
          return;
        }
        session.syncAvailableSeconds(
          availableUsageSeconds(settings, usageState, adapter.id),
        );
      })();
    });

    ctx.onInvalidated(() => {
      window.clearInterval(navigationTimer);
      unwatchSettings();
      unwatchUsage();
      limiter?.destroy();
      intentionalSearch?.destroy();
      preferredFeed?.destroy();
      singleItemView?.destroy();
      surfaceSuppression?.destroy();
      void usageSession?.destroy();
      shadowUi.remove();
    });
  },
});
