import type { PlatformAdapter } from "./platforms";

interface OriginalDisplay {
  value: string;
  priority: string;
}

type SearchConfig = NonNullable<PlatformAdapter["intentionalSearch"]>;

export class IntentionalSearchController {
  private readonly hidden = new Map<HTMLElement, OriginalDisplay>();
  private readonly observers = new Map<Node, MutationObserver>();
  private processingTimer?: number;
  private destroyed = false;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly url: URL,
  ) {}

  start(): void {
    if (!this.adapter.intentionalSearch) return;
    this.process();
  }

  destroy(): void {
    this.destroyed = true;
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    if (this.processingTimer) window.clearTimeout(this.processingTimer);
    this.hidden.forEach((display, element) => {
      element.style.setProperty("display", display.value, display.priority);
      delete element.dataset.dopamineFastHiddenSearchSuggestion;
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
    const config = this.adapter.intentionalSearch;
    if (!config || this.destroyed) return;

    const roots = collectSearchRoots(config.shadowHostSelectors ?? []);
    const navigationRoots = collectSearchRoots(
      config.navigationShadowHostSelectors ?? [],
    );
    [...roots, ...navigationRoots].forEach((root) => this.observe(root));
    const shadowRoots = roots.slice(1);
    this.hideMatches([document], config.suggestionSelectors);
    this.hideMatches(shadowRoots, config.shadowSuggestionSelectors ?? []);
    this.hideControlledPopups([document], roots, config.inputSelectors);
    this.hideControlledPopups(
      shadowRoots,
      roots,
      config.shadowInputSelectors ?? [],
    );
    this.hideMatches([document], config.navigationSelectors ?? []);
    this.hideMatches(
      navigationRoots.slice(1),
      config.shadowNavigationSelectors ?? [],
    );

    this.hideMatches([document], selectorsForRoute(config, this.url));
  }

  private observe(root: Node): void {
    if (this.observers.has(root)) return;
    const observer = new MutationObserver(() => this.scheduleProcess());
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-controls", "aria-expanded", "aria-owns"],
    });
    this.observers.set(root, observer);
  }

  private hideMatches(roots: ParentNode[], selectors: string[]): void {
    selectors.forEach((selector) => {
      roots.forEach((root) => {
        root
          .querySelectorAll<HTMLElement>(selector)
          .forEach((element) => this.hideElement(element));
      });
    });
  }

  private hideControlledPopups(
    inputRoots: ParentNode[],
    candidateRoots: ParentNode[],
    inputSelectors: string[],
  ): void {
    inputSelectors.forEach((selector) => {
      inputRoots.forEach((root) => {
        root.querySelectorAll<HTMLElement>(selector).forEach((input) => {
          const controlledIds = [
            input.getAttribute("aria-controls"),
            input.getAttribute("aria-owns"),
          ]
            .filter((value): value is string => Boolean(value))
            .flatMap((value) => value.split(/\s+/));

          controlledIds.forEach((id) => {
            candidateRoots.forEach((candidateRoot) => {
              const target = candidateRoot.querySelector<HTMLElement>(
                `#${CSS.escape(id)}`,
              );
              if (target) this.hideElement(target);
            });
          });
        });
      });
    });
  }

  private hideElement(element: HTMLElement): void {
    if (!this.hidden.has(element)) {
      this.hidden.set(element, {
        value: element.style.getPropertyValue("display"),
        priority: element.style.getPropertyPriority("display"),
      });
    }
    element.dataset.dopamineFastHiddenSearchSuggestion = "true";
    element.style.setProperty("display", "none", "important");
  }
}

export function selectorsForRoute(config: SearchConfig, url: URL): string[] {
  return (config.routeRules ?? [])
    .filter((rule) => rule.paths.includes(url.pathname))
    .flatMap((rule) => rule.selectors);
}

function collectSearchRoots(shadowHostSelectors: string[]): ParentNode[] {
  const roots: ParentNode[] = [document];
  if (shadowHostSelectors.length === 0) return roots;

  const hostSelector = shadowHostSelectors.join(",");
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    if (!root) continue;
    root.querySelectorAll<HTMLElement>(hostSelector).forEach((element) => {
      if (element.shadowRoot && !roots.includes(element.shadowRoot)) {
        roots.push(element.shadowRoot);
      }
    });
  }
  return roots;
}
