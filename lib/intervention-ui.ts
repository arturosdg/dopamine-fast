import type { RuntimeMessage } from "./runtime-messages";
import { sessionMinuteChoices } from "./session-time";
import {
  createHardLimitView,
  createOpeningView,
  createSessionEndedView,
  createSessionPlanningView,
  createUsageTimerView,
} from "./intervention-views";

export interface OpeningOptions {
  platformLabel: string;
  delaySeconds: number;
  defaultSessionMinutes: number;
  availableSeconds: number;
  usageMetrics: Array<{ label: string; usedSeconds: number }>;
}

export interface UsageTimerOptions {
  platformLabel: string;
  plannedSeconds: number;
  availableSeconds: number;
}

export interface SessionEndedOptions {
  platformLabel: string;
  defaultSessionMinutes: number;
  availableSeconds: number;
}

const SESSION_REPLAN_DELAY_SECONDS = 10;

export class InterventionUi {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly timer: HTMLElement;
  private cancelPendingInteraction?: () => void;

  constructor(root: HTMLElement) {
    this.root = root;
    this.overlay = document.createElement("div");
    this.overlay.className = "df-overlay-slot";
    this.timer = document.createElement("div");
    this.timer.className = "df-timer-slot";
    this.root.replaceChildren(this.overlay, this.timer);
  }

  hide(): void {
    const cancelPendingInteraction = this.cancelPendingInteraction;
    this.cancelPendingInteraction = undefined;
    cancelPendingInteraction?.();
    this.overlay.replaceChildren();
  }

  hideAll(): void {
    this.hide();
    this.hideUsageTimer();
  }

  showOpening(options: OpeningOptions): Promise<number> {
    const maximumMinutes = Math.max(
      1,
      Math.min(60, Math.ceil(options.availableSeconds / 60)),
    );
    const defaultMinutes = Math.min(
      options.defaultSessionMinutes,
      maximumMinutes,
    );
    const defaultSessionLabel =
      options.availableSeconds < 60 ? "<1 min" : `${defaultMinutes} min`;
    this.overlay.replaceChildren(
      createOpeningView({
        platformLabel: options.platformLabel,
        delaySeconds: options.delaySeconds,
        defaultSessionLabel,
        availableLabel: this.formatFriendlyDuration(options.availableSeconds),
        usageMetrics: options.usageMetrics.map((metric) => ({
          label: metric.label,
          duration: this.formatUsageDuration(metric.usedSeconds),
        })),
      }),
    );

    const countdown = this.overlay.querySelector<HTMLElement>(".df-countdown");
    const continueButton =
      this.requiredElement<HTMLButtonElement>('[data-action="continue"]');
    const leaveButton =
      this.requiredElement<HTMLButtonElement>('[data-action="leave"]');
    const settingsButton =
      this.requiredElement<HTMLButtonElement>('[data-action="settings"]');

    leaveButton.addEventListener("click", () => this.leaveFeed());
    settingsButton.addEventListener("click", () => this.openOptions());
    const timeStepper = this.bindTimeStepper(
      this.overlay,
      maximumMinutes,
      defaultMinutes,
      options.availableSeconds,
      (label) => {
        if (!continueButton.disabled) {
          continueButton.textContent = `Start ${label} session`;
        }
      },
    );

    return new Promise<number>((resolve) => {
      let remaining = options.delaySeconds;
      let interval: number | undefined;
      this.cancelPendingInteraction = () => {
        if (interval !== undefined) window.clearInterval(interval);
        resolve(0);
      };
      if (remaining <= 0) {
        continueButton.disabled = false;
      } else {
        interval = window.setInterval(() => {
          remaining -= 1;
          if (countdown) countdown.textContent = String(Math.max(0, remaining));
          continueButton.textContent =
            remaining > 0
              ? `Continue in ${remaining}s`
              : `Start ${timeStepper.getLabel()} session`;

          if (remaining <= 0) {
            if (interval !== undefined) window.clearInterval(interval);
            continueButton.disabled = false;
          }
        }, 1000);
      }

      continueButton.addEventListener("click", () => {
        if (interval !== undefined) window.clearInterval(interval);
        const selectedSeconds = Math.min(
          timeStepper.getMinutes() * 60,
          options.availableSeconds,
        );
        this.cancelPendingInteraction = undefined;
        this.hide();
        resolve(selectedSeconds);
      });
    });
  }

  showSessionEnded(options: SessionEndedOptions): Promise<number> {
    this.overlay.replaceChildren(
      createSessionEndedView({
        platformLabel: options.platformLabel,
        availableLabel: this.formatFriendlyDuration(options.availableSeconds),
        replanDelaySeconds: SESSION_REPLAN_DELAY_SECONDS,
      }),
    );

    const leaveButton =
      this.requiredElement<HTMLButtonElement>('[data-action="leave"]');
    const planButton =
      this.requiredElement<HTMLButtonElement>('[data-action="plan"]');
    const waitLabel = this.requiredElement<HTMLElement>(".df-wait");
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => this.openOptions());

    return new Promise<number>((resolve) => {
      let remaining = SESSION_REPLAN_DELAY_SECONDS;
      const interval = window.setInterval(() => {
        remaining -= 1;
        planButton.textContent =
          remaining > 0
            ? `Plan another block in ${remaining}s`
            : "Plan another block";
        if (remaining <= 0) {
          window.clearInterval(interval);
          planButton.disabled = false;
          waitLabel.textContent = "You can now plan another block.";
        }
      }, 1000);

      const finishWithoutExtension = () => {
        window.clearInterval(interval);
        this.cancelPendingInteraction = undefined;
        resolve(0);
      };
      this.cancelPendingInteraction = () => {
        window.clearInterval(interval);
        resolve(0);
      };
      leaveButton.addEventListener("click", () => {
        finishWithoutExtension();
        this.leaveFeed();
      });
      planButton.addEventListener("click", () => {
        if (planButton.disabled) return;
        window.clearInterval(interval);
        this.showSessionPlanning(options, resolve);
      });
    });
  }

  private showSessionPlanning(
    options: SessionEndedOptions,
    resolve: (seconds: number) => void,
  ): void {
    const maximumMinutes = Math.max(
      1,
      Math.min(60, Math.ceil(options.availableSeconds / 60)),
    );
    const defaultMinutes = Math.min(
      options.defaultSessionMinutes,
      maximumMinutes,
    );
    const defaultSessionLabel =
      options.availableSeconds < 60 ? "<1 min" : `${defaultMinutes} min`;
    const card = this.requiredElement<HTMLElement>(".df-card");
    card.replaceChildren(
      createSessionPlanningView({
        platformLabel: options.platformLabel,
        defaultSessionLabel,
      }),
    );

    const extendButton =
      this.requiredElement<HTMLButtonElement>('[data-action="extend"]');
    const timeStepper = this.bindTimeStepper(
      card,
      maximumMinutes,
      defaultMinutes,
      options.availableSeconds,
      (label) => {
        extendButton.textContent = `Start ${label} block`;
      },
    );
    this.requiredElement<HTMLButtonElement>('[data-action="leave"]')
      .addEventListener("click", () => {
        this.cancelPendingInteraction = undefined;
        resolve(0);
        this.leaveFeed();
      });
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => this.openOptions());
    this.cancelPendingInteraction = () => resolve(0);
    extendButton.addEventListener("click", () => {
      const selectedSeconds = Math.min(
        timeStepper.getMinutes() * 60,
        options.availableSeconds,
      );
      this.cancelPendingInteraction = undefined;
      this.hide();
      resolve(selectedSeconds);
    });
  }

  showHardLimitReached(platformLabel: string): void {
    const cancelPendingInteraction = this.cancelPendingInteraction;
    this.cancelPendingInteraction = undefined;
    cancelPendingInteraction?.();
    this.overlay.replaceChildren(createHardLimitView(platformLabel));

    this.requiredElement<HTMLButtonElement>('[data-action="leave"]')
      .addEventListener("click", () => this.leaveFeed());
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => this.openOptions());
  }

  showUsageTimer(options: UsageTimerOptions): void {
    if (this.timer.childElementCount === 0) {
      this.timer.replaceChildren(createUsageTimerView());
      this.timer
        .querySelector<HTMLButtonElement>(".df-usage-timer")
        ?.addEventListener("click", () => this.openOptions());
    }

    const timer = this.timer.querySelector<HTMLElement>(".df-usage-timer");
    const planned =
      this.timer.querySelector<HTMLElement>('[data-timer="planned"]');
    const platform =
      this.timer.querySelector<HTMLElement>('[data-timer="platform"]');
    const daily = this.timer.querySelector<HTMLElement>('[data-timer="daily"]');
    if (!timer || !planned || !platform || !daily) return;

    planned.textContent = this.formatClock(options.plannedSeconds);
    platform.textContent = options.platformLabel;
    daily.textContent = this.formatClock(options.availableSeconds);
    timer.dataset.urgent =
      options.plannedSeconds <= 60 || options.availableSeconds <= 60
        ? "true"
        : "false";
    timer.setAttribute(
      "aria-label",
      `${this.formatClock(options.plannedSeconds)} left in this session; ${this.formatFriendlyDuration(options.availableSeconds)} available today on ${options.platformLabel}`,
    );
  }

  hideUsageTimer(): void {
    this.timer.replaceChildren();
  }

  private requiredElement<T extends Element>(selector: string): T {
    const element = this.overlay.querySelector<T>(selector);
    if (!element) throw new Error(`Missing intervention UI element: ${selector}`);
    return element;
  }

  private bindTimeStepper(
    root: ParentNode,
    maximumMinutes: number,
    initialMinutes: number,
    availableSeconds: number,
    onChange: (label: string) => void,
  ): { getMinutes(): number; getLabel(): string } {
    const output = root.querySelector<HTMLOutputElement>(
      ".df-time-stepper output",
    );
    const lessButton = root.querySelector<HTMLButtonElement>(
      '[data-action="time-less"]',
    );
    const moreButton = root.querySelector<HTMLButtonElement>(
      '[data-action="time-more"]',
    );
    if (!output || !lessButton || !moreButton) {
      throw new Error("Missing session time stepper element");
    }

    const choices = sessionMinuteChoices(maximumMinutes, initialMinutes);
    let selectedIndex = Math.max(0, choices.indexOf(initialMinutes));

    const getMinutes = () => choices[selectedIndex] ?? 1;
    const getLabel = () =>
      availableSeconds < 60 ? "<1 min" : `${getMinutes()} min`;
    const render = () => {
      const label = getLabel();
      output.value = label;
      lessButton.disabled = selectedIndex === 0 || availableSeconds < 60;
      moreButton.disabled =
        selectedIndex === choices.length - 1 || availableSeconds < 60;
      onChange(label);
    };

    lessButton.addEventListener("click", () => {
      if (selectedIndex === 0) return;
      selectedIndex -= 1;
      render();
    });
    moreButton.addEventListener("click", () => {
      if (selectedIndex >= choices.length - 1) return;
      selectedIndex += 1;
      render();
    });
    render();

    return { getMinutes, getLabel };
  }

  private openOptions(): void {
    void browser.runtime.sendMessage<RuntimeMessage>({
      type: "dopamine-fast:open-options",
    });
  }

  private leaveFeed(): void {
    void browser.runtime.sendMessage<RuntimeMessage>({
      type: "dopamine-fast:leave-feed",
    });
  }

  private formatClock(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  private formatFriendlyDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
    if (safeSeconds < 60) return "<1 min";
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.ceil((safeSeconds % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  private formatUsageDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    if (safeSeconds === 0) return "0 min";
    if (safeSeconds < 60) return "<1 min";
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
}
