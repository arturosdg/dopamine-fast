import "../assets/content.css";
import { FeedLimiter } from "../lib/feed-limiter";
import { InterventionUi } from "../lib/intervention-ui";
import { getPlatformAdapter } from "../lib/platforms";
import { getSettings, reserveAllowance, settingsItem } from "../lib/storage";

export default defineContentScript({
  matches: [
    "*://reddit.com/*",
    "*://www.reddit.com/*",
    "*://x.com/*",
    "*://twitter.com/*",
    "*://www.instagram.com/*",
    "*://instagram.com/*",
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
        root.dataset.visible = "false";
        container.append(root);
        return new InterventionUi(root);
      },
      onRemove(ui) {
        ui?.hide();
      },
    });
    shadowUi.mount();

    const intervention = shadowUi.mounted;
    if (!intervention) return;

    let limiter: FeedLimiter | undefined;
    let currentUrl = "";
    let activationId = 0;

    const activate = async () => {
      const thisActivation = ++activationId;
      limiter?.destroy();
      limiter = undefined;
      intervention.hide();

      const url = new URL(location.href);
      const settings = await getSettings();
      if (
        !settings.enabled ||
        !settings.enabledSites[adapter.id] ||
        !adapter.isFeedRoute(url)
      ) {
        return;
      }

      await intervention.showOpening(
        adapter.label,
        settings.openingDelaySeconds,
      );
      if (thisActivation !== activationId) return;

      const initialAllowance = await reserveAllowance(
        adapter.id,
        settings.batchSize,
      );
      if (thisActivation !== activationId) return;

      limiter = new FeedLimiter(
        adapter,
        settings,
        intervention,
        initialAllowance,
      );
      limiter.start();
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

    ctx.onInvalidated(() => {
      window.clearInterval(navigationTimer);
      unwatchSettings();
      limiter?.destroy();
      shadowUi.remove();
    });
  },
});
