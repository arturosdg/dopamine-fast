interface OriginalProperty {
  value: string;
  priority: string;
}

interface OriginalPageStyles {
  overflow: OriginalProperty;
  overscrollBehavior: OriginalProperty;
}

interface SingleItemViewOptions {
  activationSelectors?: string[];
  itemSelector: string;
  itemRootSelector: string;
  navigationSelectors: string[];
  navigationControlSelector?: string;
  navigationControlTokens?: string[];
}

const BLOCKED_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

export class SingleItemViewController {
  private readonly originals = new Map<HTMLElement, OriginalPageStyles>();
  private readonly originalDisplays = new Map<HTMLElement, OriginalProperty>();
  private observer: MutationObserver | undefined;
  private primaryItem: HTMLElement | undefined;
  private scanTimer: number | undefined;
  private started = false;
  private active = false;

  constructor(
    private readonly options: SingleItemViewOptions,
    private readonly activateImmediately = true,
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.updateActivation();
  }

  destroy(): void {
    if (!this.started) return;
    this.started = false;
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.scanTimer !== undefined) window.clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
    this.deactivate();
  }

  private activate(): void {
    if (this.active) return;
    this.active = true;
    this.lock(document.documentElement);
    if (document.body) this.lock(document.body);
    window.addEventListener("wheel", this.blockPointerNavigation, {
      capture: true,
      passive: false,
    });
    window.addEventListener("touchmove", this.blockPointerNavigation, {
      capture: true,
      passive: false,
    });
    window.addEventListener("keydown", this.blockKeyboardNavigation, true);
  }

  private deactivate(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener("wheel", this.blockPointerNavigation, true);
    window.removeEventListener("touchmove", this.blockPointerNavigation, true);
    window.removeEventListener("keydown", this.blockKeyboardNavigation, true);
    this.originals.forEach((styles, element) => {
      restoreProperty(element, "overflow", styles.overflow);
      restoreProperty(
        element,
        "overscroll-behavior",
        styles.overscrollBehavior,
      );
    });
    this.originals.clear();
    this.originalDisplays.forEach((display, element) => {
      restoreProperty(element, "display", display);
    });
    this.originalDisplays.clear();
    this.primaryItem = undefined;
  }

  private readonly blockPointerNavigation = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly blockKeyboardNavigation = (event: KeyboardEvent): void => {
    if (
      !isBlockedSingleItemNavigationKey(event.key) ||
      isAllowedInteractionTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private lock(element: HTMLElement): void {
    if (!this.originals.has(element)) {
      this.originals.set(element, {
        overflow: originalProperty(element, "overflow"),
        overscrollBehavior: originalProperty(element, "overscroll-behavior"),
      });
    }
    element.style.setProperty("overflow", "hidden", "important");
    element.style.setProperty("overscroll-behavior", "none", "important");
  }

  private scheduleScan(): void {
    if (this.scanTimer !== undefined) return;
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = undefined;
      this.updateActivation();
    }, 50);
  }

  private updateActivation(): void {
    const detected = (this.options.activationSelectors ?? []).some((selector) =>
      document.querySelector(selector),
    );
    if (!this.activateImmediately && !detected) {
      this.deactivate();
      return;
    }
    this.activate();
    this.enforceSingleItem();
  }

  private enforceSingleItem(): void {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>(this.options.itemSelector),
    )
      .map((item) => item.closest<HTMLElement>(this.options.itemRootSelector))
      .filter((item): item is HTMLElement => item !== null);
    const uniqueItems = [...new Set(items)];

    this.primaryItem ??= uniqueItems.find(isVisible) ?? uniqueItems[0];
    uniqueItems.forEach((item) => {
      if (item !== this.primaryItem) this.hide(item);
    });

    this.options.navigationSelectors.forEach((selector) => {
      document
        .querySelectorAll<HTMLElement>(selector)
        .forEach((element) => this.hide(element));
    });

    if (
      this.options.navigationControlSelector &&
      this.options.navigationControlTokens
    ) {
      document
        .querySelectorAll<HTMLElement>(this.options.navigationControlSelector)
        .forEach((element) => {
          if (
            matchesSingleItemNavigationControl(
              element.textContent,
              this.options.navigationControlTokens ?? [],
            )
          ) {
            this.hide(element);
          }
        });
    }
  }

  private hide(element: HTMLElement): void {
    if (!this.originalDisplays.has(element)) {
      this.originalDisplays.set(element, originalProperty(element, "display"));
    }
    element.style.setProperty("display", "none", "important");
  }
}

export function isBlockedSingleItemNavigationKey(key: string): boolean {
  return BLOCKED_KEYS.has(key);
}

export function matchesSingleItemNavigationControl(
  label: string | null,
  tokens: string[],
): boolean {
  const normalized = label?.trim().toLocaleLowerCase() ?? "";
  return tokens.some((token) => normalized === token);
}

function isAllowedInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"]',
    ),
  );
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function originalProperty(
  element: HTMLElement,
  property: string,
): OriginalProperty {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreProperty(
  element: HTMLElement,
  property: string,
  original: OriginalProperty,
): void {
  element.style.setProperty(property, original.value, original.priority);
}
