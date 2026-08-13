import "../assets/content.css";
import { FeedLimiter } from "../lib/feed-limiter";
import { InterventionUi } from "../lib/intervention-ui";
import { IntentionalSearchController } from "../lib/intentional-search";
import { availableUsageSeconds, localDateKey } from "../lib/models";
import { PageInteractionGuard } from "../lib/page-interaction-guard";
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

    const interactionGuard = new PageInteractionGuard();
    if (adapter.isFeedRoute(new URL(location.href))) {
      interactionGuard.engage(0);
    }
    ctx.onInvalidated(() => interactionGuard.destroy());

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
    }).catch((error: unknown) => {
      interactionGuard.destroy();
      throw error;
    });
    try {
      shadowUi.mount();
    } catch (error) {
      interactionGuard.destroy();
      throw error;
    }

    const intervention = shadowUi.mounted;
    if (!intervention) {
      interactionGuard.destroy();
      return;
    }

    let limiter: FeedLimiter | undefined;
    let intentionalSearch: IntentionalSearchController | undefined;
    let preferredFeed: PreferredFeedController | undefined;
    let singleItemView: SingleItemViewController | undefined;
    let surfaceSuppression: SurfaceSuppressionController | undefined;
    let usageSession: UsageSession | undefined;
    let sessionPostAllowance = 0;
    let currentUrl = "";
    let activationId = 0;

    const activate = (preserveUsageSession = false): Promise<void> => {
      const thisActivation = ++activationId;
      const url = new URL(location.href);
      if (
        adapter.isFeedRoute(url) &&
        (!preserveUsageSession || !usageSession)
      ) {
        interactionGuard.engage(thisActivation);
      } else {
        interactionGuard.releaseAll();
      }

      return (async () => {
      if (limiter) sessionPostAllowance = limiter.getAllowance();
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
      if (!preserveUsageSession || !usageSession) {
        const previousUsageSession = usageSession;
        usageSession = undefined;
        sessionPostAllowance = 0;
        await previousUsageSession?.destroy();
        if (thisActivation !== activationId) return;
        intervention.hideAll();
      }

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

      const isSingleItemRoute = adapter.singleItemView?.isRoute(url) ?? false;
      if (adapter.singleItemView) {
        singleItemView = new SingleItemViewController(
          adapter.singleItemView,
          isSingleItemRoute,
        );
        singleItemView.start();
      }
      if (isSingleItemRoute) {
        return;
      }

      if (!adapter.isFeedRoute(url)) return;

      const followingOnly =
        (adapter.id === "x" && settings.xFollowingOnly) ||
        (adapter.id === "instagram" && settings.instagramFollowingOnly);
      if (followingOnly) {
        const preferredUrl = adapter.preferredFeed?.canonicalUrl?.(url);
        if (preferredUrl && preferredUrl.href !== url.href) {
          location.replace(preferredUrl.href);
          return;
        }
        preferredFeed = new PreferredFeedController(adapter);
        preferredFeed.start();
      }

      if (usageSession) {
        if (usageSession.getAvailableSeconds() <= 0) {
          intervention.showHardLimitReached(adapter.label);
          return;
        }
        limiter = new FeedLimiter(adapter, settings, sessionPostAllowance);
        limiter.start();
        return;
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

      const opening = intervention.showOpening({
        platformLabel: adapter.label,
        delaySeconds: settings.openingDelaySeconds,
        defaultSessionMinutes:
          settings.sessionDurationMinutesByPlatform[adapter.id],
        availableSeconds,
        usageMetrics: [
          { label: "Reddit", usedSeconds: todayUsage.reddit },
          { label: "X", usedSeconds: todayUsage.x },
          { label: "Instagram", usedSeconds: todayUsage.instagram },
          { label: "YouTube", usedSeconds: todayUsage.youtube },
        ],
      });
      interactionGuard.release(thisActivation);
      const plannedSeconds = await opening;
      if (thisActivation !== activationId) return;
      if (plannedSeconds <= 0) return;

      const initialAllowance = await reserveAllowance(
        adapter.id,
        settings.batchSize,
      );
      if (thisActivation !== activationId) return;
      sessionPostAllowance = initialAllowance;

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
              defaultSessionMinutes:
                settings.sessionDurationMinutesByPlatform[adapter.id],
              availableSeconds: remainingSeconds,
            });
            if (usageSession !== session) {
              return;
            }
            if (extensionSeconds <= 0) return;
            session.extend(extensionSeconds);
          })();
        },
        onHardLimitReached() {
          if (usageSession !== session) {
            return;
          }
          sessionPostAllowance = 0;
          limiter?.destroy();
          limiter = undefined;
          intervention.showHardLimitReached(adapter.label);
        },
      });
      usageSession = session;
      session.start();
      })().finally(() => interactionGuard.release(thisActivation));
    };

    currentUrl = location.href;
    void activate();

    const navigationTimer = window.setInterval(() => {
      if (location.href === currentUrl) return;
      currentUrl = location.href;
      void activate(true);
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
