import type { PlatformAdapter } from "./platforms";

interface OriginalDisplay {
  value: string;
  priority: string;
}

export class PreferredFeedController {
  private readonly hidden = new Map<HTMLElement, OriginalDisplay>();
  private readonly observer: MutationObserver;
  private processingTimer?: number;
  private destroyed = false;

  constructor(private readonly adapter: PlatformAdapter) {
    this.observer = new MutationObserver(() => this.scheduleProcess());
  }

  start(): void {
    if (!this.adapter.preferredFeed) return;
    this.process();
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected"],
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.observer.disconnect();
    if (this.processingTimer) window.clearTimeout(this.processingTimer);
    this.hidden.forEach((display, element) => {
      element.style.setProperty("display", display.value, display.priority);
      delete element.dataset.dopamineFastHiddenFeedTab;
    });
    this.hidden.clear();
  }

  private scheduleProcess(): void {
    if (this.destroyed || this.processingTimer) return;
    this.processingTimer = window.setTimeout(() => {
      this.processingTimer = undefined;
      this.process();
    }, 120);
  }

  private process(): void {
    const config = this.adapter.preferredFeed;
    if (!config || this.destroyed) return;
    const tabs = Array.from(
      document.querySelectorAll<HTMLElement>(config.tabSelector),
    );
    const preferred = tabs.find((tab) =>
      matchesFeedTab(tab.textContent, config.preferredTokens),
    );
    const hidden = tabs.find((tab) =>
      matchesFeedTab(tab.textContent, config.hiddenTokens),
    );

    if (!preferred) return;
    if (hidden) this.hideTab(hidden);
    if (preferred.getAttribute("aria-selected") !== "true") preferred.click();
  }

  private hideTab(tab: HTMLElement): void {
    if (!this.hidden.has(tab)) {
      this.hidden.set(tab, {
        value: tab.style.getPropertyValue("display"),
        priority: tab.style.getPropertyPriority("display"),
      });
    }
    tab.dataset.dopamineFastHiddenFeedTab = "true";
    tab.style.setProperty("display", "none", "important");
  }
}

export function matchesFeedTab(
  label: string | null,
  tokens: string[],
): boolean {
  const normalized = label?.trim().toLocaleLowerCase() ?? "";
  return tokens.some((token) => normalized === token);
}
