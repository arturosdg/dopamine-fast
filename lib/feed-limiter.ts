import {
  collectPosts,
  hasSuggestedMarker,
  type PlatformAdapter,
} from "./platforms";
import { BatchGateUi } from "./batch-gate-ui";
import { dailyStateItem, reserveAllowance } from "./storage";
import { availableAllowance, normalizeDailyState, type Settings } from "./models";

interface OriginalDisplay {
  value: string;
  priority: string;
}

export class FeedLimiter {
  private allowance: number;
  private readonly hidden = new Map<HTMLElement, OriginalDisplay>();
  private readonly revealedPostKeys = new Set<string>();
  private readonly fallbackPostKeys = new WeakMap<HTMLElement, string>();
  private readonly gate = new BatchGateUi();
  private readonly mutationObserver: MutationObserver;
  private processingTimer?: number;
  private gateRequestId = 0;
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

  destroy(): void {
    this.destroyed = true;
    this.mutationObserver.disconnect();
    if (this.processingTimer) window.clearTimeout(this.processingTimer);
    this.hidden.forEach((display, element) => {
      element.style.setProperty("display", display.value, display.priority);
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
        media.autoplay = false;
        media.pause();
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

    let firstBlockedPost: HTMLElement | undefined;
    let lastVisiblePost: HTMLElement | undefined;
    regularPosts.forEach((post) => {
      const postKey = this.getPostKey(post);
      if (
        this.revealedPostKeys.has(postKey) ||
        this.revealedPostKeys.size < this.allowance
      ) {
        this.revealedPostKeys.add(postKey);
        this.showElement(post);
        lastVisiblePost = post;
      } else {
        firstBlockedPost ??= post;
        this.hideElement(post);
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
      this.gateRequestId += 1;
      this.gate.hide();
      return;
    }
    if (this.gate.isFor(boundary, placement)) {
      this.gate.ensurePlacement(boundary, placement);
      return;
    }
    const requestId = ++this.gateRequestId;
    void this.loadGate(boundary, placement, requestId);
  }

  private async loadGate(
    boundary: HTMLElement,
    placement: "before" | "after",
    requestId: number,
  ): Promise<void> {
    const state = normalizeDailyState(await dailyStateItem.getValue());
    if (this.destroyed || requestId !== this.gateRequestId) return;
    const remainingToday = availableAllowance(this.settings, state);
    const balancedUnlockAvailable =
      this.settings.mode !== "balanced" || state.unlocks < 2;
    const canUnlock = remainingToday > 0 && balancedUnlockAvailable;

    const showGate = placement === "after"
      ? this.gate.showAfter.bind(this.gate)
      : this.gate.showBefore.bind(this.gate);
    showGate(boundary, {
      unlockSize: Math.min(this.settings.unlockBatchSize, remainingToday),
      remainingToday,
      canUnlock,
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

  private hideElement(element: HTMLElement): void {
    if (!this.hidden.has(element)) {
      this.hidden.set(element, {
        value: element.style.getPropertyValue("display"),
        priority: element.style.getPropertyPriority("display"),
      });
    }
    element.dataset.dopamineFastHidden = "true";
    element.style.setProperty("display", "none", "important");
  }

  private showElement(element: HTMLElement): void {
    const original = this.hidden.get(element);
    if (!original) return;
    element.style.setProperty("display", original.value, original.priority);
    delete element.dataset.dopamineFastHidden;
    this.hidden.delete(element);
  }
}
