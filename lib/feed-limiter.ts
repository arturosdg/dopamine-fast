import {
  collectPosts,
  hasSuggestedMarker,
  type PlatformAdapter,
} from "./platforms";
import { BatchGateUi } from "./batch-gate-ui";
import { planFeedVisibility } from "./feed-boundary";
import { MediaAutoplayGuard } from "./media-autoplay";
import { reserveAllowance } from "./storage";
import type { Settings } from "./models";

interface OriginalProperty {
  value: string;
  priority: string;
}

interface OriginalStyles {
  display: OriginalProperty;
  visibility: OriginalProperty;
  pointerEvents: OriginalProperty;
}

export class FeedLimiter {
  private allowance: number;
  private readonly hidden = new Map<HTMLElement, OriginalStyles>();
  private readonly revealedPostKeys = new Set<string>();
  private readonly fallbackPostKeys = new WeakMap<HTMLElement, string>();
  private readonly gate = new BatchGateUi();
  private readonly mediaAutoplay = new MediaAutoplayGuard();
  private readonly mutationObserver: MutationObserver;
  private processingTimer?: number;
  private nextFallbackPostKey = 1;
  private destroyed = false;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly settings: Settings,
    initialAllowance: number,
  ) {
    this.allowance = initialAllowance;
    this.mutationObserver = new MutationObserver(() => this.scheduleProcess());
  }

  start(): void {
    this.process();
    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  getAllowance(): number {
    return this.allowance;
  }

  destroy(): void {
    this.destroyed = true;
    this.mutationObserver.disconnect();
    if (this.processingTimer) window.clearTimeout(this.processingTimer);
    this.hidden.forEach((styles, element) => {
      this.restoreHiddenStyles(element, styles);
      delete element.dataset.dopamineFastHidden;
    });
    this.hidden.clear();
    this.gate.destroy();
  }

  private scheduleProcess(): void {
    if (this.destroyed || this.processingTimer) return;
    this.processingTimer = window.setTimeout(() => {
      this.processingTimer = undefined;
      this.process();
    }, 120);
  }

  private process(): void {
    if (this.destroyed) return;

    if (this.settings.disableAutoplay) {
      document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => {
        this.mediaAutoplay.prevent(media);
      });
    }

    if (this.settings.blockSuggested) {
      this.adapter.suggestedSelectors.forEach((selector) => {
        document
          .querySelectorAll<HTMLElement>(selector)
          .forEach((element) => this.hideElement(element));
      });
    }

    const chronologicalPosts = collectPosts(this.adapter);
    const regularPosts = chronologicalPosts.filter((post) => {
      const suggested =
        this.settings.blockSuggested &&
        hasSuggestedMarker(post, this.adapter);
      if (suggested) this.hideElement(post);
      return !suggested;
    });

    const visibility = planFeedVisibility(
      regularPosts.map((post) => this.getPostKey(post)),
      this.revealedPostKeys,
      this.allowance,
    );
    visibility.newlyRevealedKeys.forEach((postKey) =>
      this.revealedPostKeys.add(postKey),
    );

    let firstBlockedPost: HTMLElement | undefined;
    let lastVisiblePost: HTMLElement | undefined;
    regularPosts.forEach((post, index) => {
      if (visibility.visible[index] === true) {
        this.showElement(post);
        lastVisiblePost = post;
      } else {
        firstBlockedPost ??= post;
        this.hideElement(post, true);
      }
    });

    if (this.revealedPostKeys.size < this.allowance) {
      this.renderGate(undefined, "after");
    } else if (firstBlockedPost) {
      this.renderGate(firstBlockedPost, "before");
    } else {
      this.renderGate(lastVisiblePost, "after");
    }
  }

  private getPostKey(post: HTMLElement): string {
    const platformKey = this.adapter.getPostKey(post);
    if (platformKey) return `${this.adapter.id}:${platformKey}`;

    const existing = this.fallbackPostKeys.get(post);
    if (existing) return existing;
    const fallback = `${this.adapter.id}:element:${this.nextFallbackPostKey++}`;
    this.fallbackPostKeys.set(post, fallback);
    return fallback;
  }

  private renderGate(
    boundary: HTMLElement | undefined,
    placement: "before" | "after",
  ): void {
    if (!boundary) {
      this.gate.hide();
      return;
    }
    if (this.gate.isFor(boundary, placement)) {
      this.gate.ensurePlacement(boundary, placement);
      return;
    }
    this.showGate(boundary, placement);
  }

  private showGate(
    boundary: HTMLElement,
    placement: "before" | "after",
  ): void {
    const showGate = placement === "after"
      ? this.gate.showAfter.bind(this.gate)
      : this.gate.showBefore.bind(this.gate);
    showGate(boundary, {
      unlockSize: this.settings.unlockBatchSize,
      unlockDelaySeconds: this.settings.unlockDelaySeconds,
      holdSeconds: this.settings.holdSeconds,
      onUnlock: async () => {
        const granted = await reserveAllowance(
          this.adapter.id,
          this.settings.unlockBatchSize,
          true,
        );
        if (granted > 0) {
          this.allowance += granted;
          this.gate.hide();
          this.process();
        }
        return granted;
      },
    });
  }

  private hideElement(element: HTMLElement, preserveLayout = false): void {
    if (!this.hidden.has(element)) {
      this.hidden.set(element, {
        display: this.originalProperty(element, "display"),
        visibility: this.originalProperty(element, "visibility"),
        pointerEvents: this.originalProperty(element, "pointer-events"),
      });
    }
    element.dataset.dopamineFastHidden = "true";
    if (preserveLayout) {
      element.style.setProperty("visibility", "hidden", "important");
      element.style.setProperty("pointer-events", "none", "important");
      return;
    }
    element.style.setProperty("display", "none", "important");
  }

  private showElement(element: HTMLElement): void {
    const original = this.hidden.get(element);
    if (!original) return;
    this.restoreHiddenStyles(element, original);
    delete element.dataset.dopamineFastHidden;
    this.hidden.delete(element);
  }

  private originalProperty(
    element: HTMLElement,
    property: string,
  ): OriginalProperty {
    return {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    };
  }

  private restoreHiddenStyles(
    element: HTMLElement,
    styles: OriginalStyles,
  ): void {
    element.style.setProperty(
      "display",
      styles.display.value,
      styles.display.priority,
    );
    element.style.setProperty(
      "visibility",
      styles.visibility.value,
      styles.visibility.priority,
    );
    element.style.setProperty(
      "pointer-events",
      styles.pointerEvents.value,
      styles.pointerEvents.priority,
    );
  }
}
