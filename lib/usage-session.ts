import type { InterventionUi } from "./intervention-ui";
import type { PlatformId } from "./models";
import { addUsageSeconds } from "./storage";

export interface UsageSessionOptions {
  platform: PlatformId;
  platformLabel: string;
  plannedSeconds: number;
  availableSeconds: number;
  ui: InterventionUi;
  onPlannedTimeElapsed(availableSeconds: number): void;
  onHardLimitReached(): void;
}

export class UsageSession {
  private plannedSeconds: number;
  private availableSeconds: number;
  private pendingSeconds = 0;
  private interval?: number;
  private persistence = Promise.resolve();
  private state: "idle" | "running" | "planned-end" | "hard-end" | "destroyed" =
    "idle";
  private readonly persistWhenHidden = () => {
    if (document.visibilityState !== "visible") void this.persistPending();
  };
  private readonly persistBeforeLeaving = () => {
    void this.persistPending();
  };

  constructor(private readonly options: UsageSessionOptions) {
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
    document.addEventListener("visibilitychange", this.persistWhenHidden);
    window.addEventListener("pagehide", this.persistBeforeLeaving);
    this.interval = window.setInterval(() => this.tick(), 1000);
  }

  extend(plannedSeconds: number): void {
    if (this.state !== "planned-end" || this.availableSeconds <= 0) return;
    this.plannedSeconds = Math.min(
      Math.max(1, Math.round(plannedSeconds)),
      this.availableSeconds,
    );
    this.state = "running";
    this.render();
    this.interval = window.setInterval(() => this.tick(), 1000);
  }

  async destroy(): Promise<void> {
    if (this.state === "destroyed") return;
    this.stopInterval();
    this.state = "destroyed";
    document.removeEventListener("visibilitychange", this.persistWhenHidden);
    window.removeEventListener("pagehide", this.persistBeforeLeaving);
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
    if (this.availableSeconds <= 0) this.finishHardLimit();
  }

  private tick(): void {
    if (this.state !== "running" || document.visibilityState !== "visible") {
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
      window.clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
