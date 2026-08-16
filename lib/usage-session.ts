import type { InterventionUi } from "./intervention-ui";
import type { PlatformId } from "./models";
import { addUsageSeconds } from "./storage";

export interface UsageSessionOptions {
  platform: PlatformId;
  platformLabel: string;
  plannedSeconds: number;
  availableSeconds: number;
  ui: InterventionUi;
  onCheckpoint?(plannedSeconds: number): void;
  onFinished?(): void;
  onPlannedTimeElapsed(availableSeconds: number): void;
  onHardLimitReached(): void;
}

export interface UsageSessionEnvironment {
  getVisibilityState(): DocumentVisibilityState;
  addVisibilityListener(listener: () => void): void;
  removeVisibilityListener(listener: () => void): void;
  addPageHideListener(listener: () => void): void;
  removePageHideListener(listener: () => void): void;
  setInterval(callback: () => void, delayMs: number): number;
  clearInterval(interval: number): void;
}

const browserEnvironment: UsageSessionEnvironment = {
  getVisibilityState: () => document.visibilityState,
  addVisibilityListener: (listener) =>
    document.addEventListener("visibilitychange", listener),
  removeVisibilityListener: (listener) =>
    document.removeEventListener("visibilitychange", listener),
  addPageHideListener: (listener) =>
    window.addEventListener("pagehide", listener),
  removePageHideListener: (listener) =>
    window.removeEventListener("pagehide", listener),
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: (interval) => window.clearInterval(interval),
};

export class UsageSession {
  private plannedSeconds: number;
  private availableSeconds: number;
  private pendingSeconds = 0;
  private interval?: number;
  private persistence = Promise.resolve();
  private state: "idle" | "running" | "planned-end" | "hard-end" | "destroyed" =
    "idle";
  private readonly persistWhenHidden = () => {
    if (this.environment.getVisibilityState() !== "visible") {
      void this.persistPending();
    }
  };
  private readonly persistBeforeLeaving = () => {
    void this.persistPending();
  };

  constructor(
    private readonly options: UsageSessionOptions,
    private readonly environment: UsageSessionEnvironment = browserEnvironment,
  ) {
    this.availableSeconds = Math.max(0, options.availableSeconds);
    this.plannedSeconds = Math.min(
      Math.max(1, options.plannedSeconds),
      this.availableSeconds,
    );
  }

  start(): void {
    if (this.state === "destroyed" || this.availableSeconds <= 0) {
      this.finishHardLimit();
      return;
    }

    this.state = "running";
    this.render();
    this.checkpoint();
    this.environment.addVisibilityListener(this.persistWhenHidden);
    this.environment.addPageHideListener(this.persistBeforeLeaving);
    this.interval = this.environment.setInterval(() => this.tick(), 1000);
  }

  extend(plannedSeconds: number): void {
    if (this.state !== "planned-end" || this.availableSeconds <= 0) return;
    this.plannedSeconds = Math.min(
      Math.max(1, Math.round(plannedSeconds)),
      this.availableSeconds,
    );
    this.state = "running";
    this.render();
    this.checkpoint();
    this.interval = this.environment.setInterval(() => this.tick(), 1000);
  }

  async destroy(): Promise<void> {
    if (this.state === "destroyed") return;
    this.stopInterval();
    this.checkpoint();
    this.state = "destroyed";
    this.environment.removeVisibilityListener(this.persistWhenHidden);
    this.environment.removePageHideListener(this.persistBeforeLeaving);
    await this.persistPending();
    this.options.ui.hideUsageTimer();
  }

  getAvailableSeconds(): number {
    return this.availableSeconds;
  }

  syncAvailableSeconds(availableSeconds: number): void {
    if (this.state === "destroyed" || this.state === "hard-end") return;
    this.availableSeconds = Math.min(
      this.availableSeconds,
      Math.max(0, Math.round(availableSeconds)),
    );
    this.plannedSeconds = Math.min(this.plannedSeconds, this.availableSeconds);
    this.render();
    if (this.availableSeconds <= 0) {
      this.finishHardLimit();
      return;
    }
    this.checkpoint();
  }

  private tick(): void {
    if (
      this.state !== "running" ||
      this.environment.getVisibilityState() !== "visible"
    ) {
      return;
    }

    this.plannedSeconds = Math.max(0, this.plannedSeconds - 1);
    this.availableSeconds = Math.max(0, this.availableSeconds - 1);
    this.pendingSeconds += 1;
    this.render();

    if (this.availableSeconds <= 0) {
      this.finishHardLimit();
      return;
    }

    if (this.plannedSeconds <= 0) {
      this.finishPlannedTime();
      return;
    }

    this.checkpoint();

    if (this.pendingSeconds >= 5) {
      void this.persistPending();
    }
  }

  private render(): void {
    this.options.ui.showUsageTimer({
      platformLabel: this.options.platformLabel,
      plannedSeconds: this.plannedSeconds,
      availableSeconds: this.availableSeconds,
    });
  }

  private finishPlannedTime(): void {
    if (this.state !== "running") return;
    this.stopInterval();
    this.state = "planned-end";
    this.options.onFinished?.();
    void this.persistPending().then(() => {
      if (this.state !== "planned-end") return;
      if (this.availableSeconds <= 0) {
        this.finishHardLimit();
        return;
      }
      this.options.onPlannedTimeElapsed(this.availableSeconds);
    });
  }

  private finishHardLimit(): void {
    if (this.state === "hard-end" || this.state === "destroyed") return;
    this.stopInterval();
    this.state = "hard-end";
    this.plannedSeconds = 0;
    this.availableSeconds = 0;
    this.render();
    this.options.onFinished?.();
    void this.persistPending().then(() => {
      if (this.state === "hard-end") this.options.onHardLimitReached();
    });
  }

  private persistPending(): Promise<void> {
    const seconds = this.pendingSeconds;
    this.pendingSeconds = 0;
    if (seconds <= 0) return this.persistence;

    this.persistence = this.persistence.then(async () => {
      const storedRemaining = await addUsageSeconds(
        this.options.platform,
        seconds,
      );
      this.availableSeconds = Math.min(
        this.availableSeconds,
        storedRemaining,
      );

      if (this.state !== "destroyed") {
        this.render();
        if (this.availableSeconds <= 0 && this.state !== "hard-end") {
          this.finishHardLimit();
        }
      }
    });
    return this.persistence;
  }

  private stopInterval(): void {
    if (this.interval !== undefined) {
      this.environment.clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private checkpoint(): void {
    if (this.state !== "running" || this.plannedSeconds <= 0) return;
    this.options.onCheckpoint?.(this.plannedSeconds);
  }
}
