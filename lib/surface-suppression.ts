import type {
  PlatformAdapter,
  SurfaceSuppressionRule,
} from "./platforms";

interface OriginalDisplay {
  value: string;
  priority: string;
}

export class SurfaceSuppressionController {
  private readonly hidden = new Map<HTMLElement, OriginalDisplay>();
  private readonly observer: MutationObserver;
  private processingTimer?: number;
  private destroyed = false;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly subscriptionsOnly: boolean,
  ) {
    this.observer = new MutationObserver(() => this.scheduleProcess());
  }

  start(): void {
    if (!this.adapter.surfaceSuppression) return;
    this.process();
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "aria-label"],
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.observer.disconnect();
    if (this.processingTimer) window.clearTimeout(this.processingTimer);
    this.hidden.forEach((display, element) => {
      element.style.setProperty("display", display.value, display.priority);
      delete element.dataset.dopamineFastHiddenSurface;
    });
    this.hidden.clear();
  }

  private scheduleProcess(): void {
    if (this.destroyed || this.processingTimer) return;
    this.processingTimer = window.setTimeout(() => {
      this.processingTimer = undefined;
      this.process();
    }, 80);
  }

  private process(): void {
    const config = this.adapter.surfaceSuppression;
    if (!config || this.destroyed) return;
    const rules = this.subscriptionsOnly
      ? [...config.always, ...config.subscriptionsOnly]
      : config.always;
    rules.forEach((rule) => this.applyRule(rule));
  }

  private applyRule(rule: SurfaceSuppressionRule): void {
    document.querySelectorAll<HTMLElement>(rule.selector).forEach((element) => {
      if (
        rule.exactTokens &&
        !matchesExactToken(element.textContent, rule.exactTokens)
      ) {
        return;
      }
      const target =
        rule.ancestorSelectors
          ?.map((selector) => element.closest<HTMLElement>(selector))
          .find((candidate): candidate is HTMLElement => candidate !== null) ??
        element;
      this.hide(target);
    });
  }

  private hide(element: HTMLElement): void {
    if (!this.hidden.has(element)) {
      this.hidden.set(element, {
        value: element.style.getPropertyValue("display"),
        priority: element.style.getPropertyPriority("display"),
      });
    }
    element.dataset.dopamineFastHiddenSurface = "true";
    element.style.setProperty("display", "none", "important");
  }
}

export function matchesExactToken(
  label: string | null,
  tokens: string[],
): boolean {
  const normalized = label?.trim().toLocaleLowerCase() ?? "";
  return tokens.some((token) => normalized === token);
}
