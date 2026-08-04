import type { RuntimeMessage } from "./runtime-messages";
import { sessionMinuteChoices } from "./session-time";

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
  private previousHtmlOverflow = "";
  private previousBodyOverflow = "";
  private pageLocked = false;
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
    this.unlockPage();
  }

  hideAll(): void {
    this.hide();
    this.hideUsageTimer();
  }

  showOpening(options: OpeningOptions): Promise<number> {
    this.lockPage();
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
    this.overlay.innerHTML = `
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-opening-title">
        <article class="df-card df-card--opening">
          <p class="df-kicker">A pause before entering</p>
          ${
            options.delaySeconds > 0
              ? `<div class="df-countdown" aria-live="polite">${options.delaySeconds}</div>`
              : `<div class="df-pause-mark df-pause-mark--centered" aria-hidden="true"></div>`
          }
          <h1 id="df-opening-title">How much time do you want to spend on ${options.platformLabel}?</h1>
          <p class="df-copy">
            Choose a defined session now. The timer will remain visible as you browse.
          </p>
          <section class="df-usage-summary" aria-labelledby="df-usage-summary-title">
            <p id="df-usage-summary-title">Time spent today</p>
            <div class="df-usage-summary__items">
              ${options.usageMetrics
                .map(
                  (metric) => `
                    <div class="df-usage-summary__item">
                      <span>${metric.label}</span>
                      <strong>${this.formatUsageDuration(metric.usedSeconds)}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>
          <div class="df-time-choice df-time-stepper">
            <span>This session</span>
            <output aria-live="polite">${defaultSessionLabel}</output>
            <div class="df-time-buttons" role="group" aria-label="Adjust session length">
              <button type="button" data-action="time-less" aria-label="Choose a shorter session">Less</button>
              <button type="button" data-action="time-more" aria-label="Add more session time">Add time</button>
            </div>
          </div>
          <p class="df-hard-limit-note">
            You have <strong>${this.formatFriendlyDuration(options.availableSeconds)}</strong>
            left in today's limit for this network.
          </p>
          <div class="df-actions">
            <button class="df-button df-button--quiet" data-action="leave">Leave</button>
            <button class="df-button df-button--primary" data-action="continue" disabled>
              ${
                options.delaySeconds > 0
                  ? `Continue in ${options.delaySeconds}s`
                  : `Start ${defaultSessionLabel} session`
              }
            </button>
          </div>
          <button class="df-settings-link" data-action="settings">Adjust time and limits</button>
        </article>
      </section>
    `;

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
    this.lockPage();
    this.overlay.innerHTML = `
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-session-end-title">
        <article class="df-card">
          <div class="df-rule"></div>
          <p class="df-kicker">Planned time complete</p>
          <h1 id="df-session-end-title">Your session has ended.</h1>
          <p class="df-copy">
            You chose to stop here. Leave now, or pause before deliberately planning more time.
          </p>
          <p class="df-hard-limit-note">
            Your daily ceiling cannot be extended:
            <strong>${this.formatFriendlyDuration(options.availableSeconds)}</strong> remaining.
          </p>
          <div class="df-actions">
            <button class="df-button df-button--primary" data-action="leave">Leave ${options.platformLabel}</button>
            <button class="df-button df-button--quiet" data-action="plan" disabled>
              Plan another block in ${SESSION_REPLAN_DELAY_SECONDS}s
            </button>
          </div>
          <p class="df-wait" aria-live="polite">Take a moment before deciding.</p>
          <button class="df-settings-link" data-action="settings">Change the default</button>
        </article>
      </section>
    `;

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
    card.innerHTML = `
      <p class="df-kicker">Plan another block</p>
      <h1>How much longer?</h1>
      <p class="df-copy">Choose a defined block within today's remaining ceiling.</p>
      <div class="df-time-choice df-time-stepper">
        <span>New block</span>
        <output aria-live="polite">${defaultSessionLabel}</output>
        <div class="df-time-buttons" role="group" aria-label="Adjust new block length">
          <button type="button" data-action="time-less" aria-label="Choose a shorter block">Less</button>
          <button type="button" data-action="time-more" aria-label="Add more time to the block">Add time</button>
        </div>
      </div>
      <div class="df-actions">
        <button class="df-button df-button--quiet" data-action="leave">Leave ${options.platformLabel}</button>
        <button class="df-button df-button--primary" data-action="extend">Start ${defaultSessionLabel} block</button>
      </div>
      <button class="df-settings-link" data-action="settings">Change the default</button>
    `;

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
    this.lockPage();
    this.overlay.innerHTML = `
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-hard-limit-title">
        <article class="df-card">
          <div class="df-lock-mark" aria-hidden="true"></div>
          <p class="df-kicker">Daily limit reached</p>
          <h1 id="df-hard-limit-title">${platformLabel} ends here for today.</h1>
          <p class="df-copy">
            This limit cannot be unlocked. It will be available again tomorrow.
          </p>
          <div class="df-actions df-actions--stack">
            <button class="df-button df-button--primary" data-action="leave">Leave ${platformLabel}</button>
          </div>
          <button class="df-settings-link" data-action="settings">View settings</button>
        </article>
      </section>
    `;

    this.requiredElement<HTMLButtonElement>('[data-action="leave"]')
      .addEventListener("click", () => this.leaveFeed());
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => this.openOptions());
  }

  showUsageTimer(options: UsageTimerOptions): void {
    if (this.timer.childElementCount === 0) {
      this.timer.innerHTML = `
        <button class="df-usage-timer" type="button" title="Open Dopamine Fast settings">
          <span class="df-usage-timer__pulse" aria-hidden="true"></span>
          <span class="df-usage-timer__copy">
            <strong data-timer="planned"></strong>
            <small><span data-timer="platform"></span> · <span data-timer="daily"></span> today</small>
          </span>
        </button>
      `;
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

  private lockPage(): void {
    if (this.pageLocked) return;
    this.pageLocked = true;
    this.previousHtmlOverflow = document.documentElement.style.overflow;
    this.previousBodyOverflow = document.body?.style.overflow ?? "";
    document.documentElement.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";
  }

  private unlockPage(): void {
    if (!this.pageLocked) return;
    this.pageLocked = false;
    document.documentElement.style.overflow = this.previousHtmlOverflow;
    if (document.body) document.body.style.overflow = this.previousBodyOverflow;
  }
}
