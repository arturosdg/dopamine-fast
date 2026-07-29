import {
  collectPosts,
  hasSuggestedMarker,
  type PlatformAdapter,
} from "./platforms";
import { dailyStateItem, reserveAllowance } from "./storage";
import { availableAllowance, normalizeDailyState, type Settings } from "./models";
import type { InterventionUi } from "./intervention-ui";

interface OriginalDisplay {
  value: string;
  priority: string;
}

export class FeedLimiter {
  private allowance: number;
  private readonly hidden = new Map<HTMLElement, OriginalDisplay>();
  private readonly boundaryObserver: IntersectionObserver;
  private readonly mutationObserver: MutationObserver;
  private observedBoundary?: HTMLElement;
  private processingTimer?: number;
  private endVisible = false;
  private destroyed = false;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly settings: Settings,
    private readonly ui: InterventionUi,
    initialAllowance: number,
  ) {
    this.allowance = initialAllowance;
    this.boundaryObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void this.presentEndOfBatch();
        }
      },
      { rootMargin: "0px 0px 180px 0px", threshold: 0.15 },
    );
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
    this.boundaryObserver.disconnect();
    if (this.processingTimer) window.clearTimeout(this.processingTimer);
    this.hidden.forEach((display, element) => {
      element.style.setProperty("display", display.value, display.priority);
      delete element.dataset.dopamineFastHidden;
    });
    this.hidden.clear();
    this.ui.hide();
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

    regularPosts.forEach((post, index) => {
      if (index < this.allowance) this.showElement(post);
      else this.hideElement(post);
    });

    const boundary = regularPosts[this.allowance - 1];
    if (boundary && boundary !== this.observedBoundary) {
      if (this.observedBoundary) {
        this.boundaryObserver.unobserve(this.observedBoundary);
      }
      this.observedBoundary = boundary;
      this.boundaryObserver.observe(boundary);
    }

    if (this.allowance === 0) void this.presentEndOfBatch();
  }

  private async presentEndOfBatch(): Promise<void> {
    if (this.endVisible || this.destroyed) return;
    this.endVisible = true;

    const state = normalizeDailyState(await dailyStateItem.getValue());
    const remainingToday = availableAllowance(this.settings, state);
    const balancedUnlockAvailable =
      this.settings.mode !== "balanced" || state.unlocks < 2;
    const canUnlock = remainingToday > 0 && balancedUnlockAvailable;

    this.ui.showEndOfBatch({
      platformLabel: this.adapter.label,
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
          this.endVisible = false;
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
