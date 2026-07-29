export interface EndOfBatchOptions {
  platformLabel: string;
  unlockSize: number;
  remainingToday: number;
  canUnlock: boolean;
  unlockDelaySeconds: number;
  holdSeconds: number;
  onUnlock(): Promise<number>;
}

export interface OpeningOptions {
  platformLabel: string;
  delaySeconds: number;
  defaultSessionMinutes: number;
  availableSeconds: number;
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

const intentions = [
  ["specific", "I'm looking for something specific"],
  ["reply", "I want to reply or interact"],
  ["deliberate", "I want to keep reading"],
  ["automatic", "I'm scrolling on autopilot"],
] as const;

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
          <label class="df-time-choice">
            <span>This session</span>
            <output for="df-session-minutes">${defaultSessionLabel}</output>
            <input
              id="df-session-minutes"
              type="range"
              min="1"
              max="${maximumMinutes}"
              value="${defaultMinutes}"
              step="1"
              ${options.availableSeconds < 60 ? "disabled" : ""}
            />
          </label>
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
    const sessionInput =
      this.requiredElement<HTMLInputElement>("#df-session-minutes");
    const sessionOutput =
      this.requiredElement<HTMLOutputElement>(".df-time-choice output");
    const continueButton =
      this.requiredElement<HTMLButtonElement>('[data-action="continue"]');
    const leaveButton =
      this.requiredElement<HTMLButtonElement>('[data-action="leave"]');
    const settingsButton =
      this.requiredElement<HTMLButtonElement>('[data-action="settings"]');

    leaveButton.addEventListener("click", () => history.back());
    settingsButton.addEventListener("click", () =>
      browser.runtime.openOptionsPage(),
    );

    sessionInput.addEventListener("input", () => {
      const label =
        options.availableSeconds < 60 ? "<1 min" : `${sessionInput.value} min`;
      sessionOutput.value = label;
      if (!continueButton.disabled) {
        continueButton.textContent = `Start ${label} session`;
      }
    });

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
              : `Start ${
                  options.availableSeconds < 60
                    ? "<1 min"
                    : `${sessionInput.value} min`
                } session`;

          if (remaining <= 0) {
            if (interval !== undefined) window.clearInterval(interval);
            continueButton.disabled = false;
          }
        }, 1000);
      }

      continueButton.addEventListener("click", () => {
        if (interval !== undefined) window.clearInterval(interval);
        const selectedSeconds = Math.min(
          Number(sessionInput.value) * 60,
          options.availableSeconds,
        );
        this.cancelPendingInteraction = undefined;
        this.hide();
        resolve(selectedSeconds);
      });
    });
  }

  showEndOfBatch(options: EndOfBatchOptions): void {
    this.lockPage();
    this.overlay.innerHTML = `
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-end-title">
        <article class="df-card">
          <div class="df-rule"></div>
          <p class="df-kicker">End of batch</p>
          <h1 id="df-end-title">That's enough for now.</h1>
          <p class="df-copy">
            ${options.remainingToday > 0
              ? `You have ${options.remainingToday} posts left in today's limit.`
              : "You've reached today's limit."}
          </p>
          <div class="df-actions df-actions--stack">
            <button class="df-button df-button--primary" data-action="leave">Leave ${options.platformLabel}</button>
            ${
              options.canUnlock
                ? `<button class="df-button df-button--quiet" data-action="unlock">Unlock ${options.unlockSize} more</button>`
                : ""
            }
          </div>
          <button class="df-settings-link" data-action="settings">Change limits</button>
        </article>
      </section>
    `;

    this.requiredElement<HTMLButtonElement>('[data-action="leave"]')
      .addEventListener("click", () => history.back());
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => browser.runtime.openOptionsPage());
    this.overlay
      .querySelector<HTMLButtonElement>('[data-action="unlock"]')
      ?.addEventListener("click", () => this.showIntentionStep(options));
  }

  showSessionEnded(options: SessionEndedOptions): Promise<number> {
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
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-session-end-title">
        <article class="df-card">
          <div class="df-rule"></div>
          <p class="df-kicker">Planned time complete</p>
          <h1 id="df-session-end-title">Your session has ended.</h1>
          <p class="df-copy">
            You chose to stop here. If you still have a specific reason, you can plan another block.
          </p>
          <label class="df-time-choice">
            <span>New block</span>
            <output for="df-extra-minutes">${defaultSessionLabel}</output>
            <input
              id="df-extra-minutes"
              type="range"
              min="1"
              max="${maximumMinutes}"
              value="${defaultMinutes}"
              step="1"
              ${options.availableSeconds < 60 ? "disabled" : ""}
            />
          </label>
          <p class="df-hard-limit-note">
            Your daily ceiling cannot be extended:
            <strong>${this.formatFriendlyDuration(options.availableSeconds)}</strong> remaining.
          </p>
          <div class="df-actions">
            <button class="df-button df-button--primary" data-action="leave">Leave ${options.platformLabel}</button>
            <button class="df-button df-button--quiet" data-action="extend">Plan another block</button>
          </div>
          <button class="df-settings-link" data-action="settings">Change the default</button>
        </article>
      </section>
    `;

    const input = this.requiredElement<HTMLInputElement>("#df-extra-minutes");
    const output =
      this.requiredElement<HTMLOutputElement>(".df-time-choice output");
    input.addEventListener("input", () => {
      output.value =
        options.availableSeconds < 60 ? "<1 min" : `${input.value} min`;
    });
    this.requiredElement<HTMLButtonElement>('[data-action="leave"]')
      .addEventListener("click", () => history.back());
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => browser.runtime.openOptionsPage());

    return new Promise<number>((resolve) => {
      this.cancelPendingInteraction = () => resolve(0);
      this.requiredElement<HTMLButtonElement>('[data-action="extend"]')
        .addEventListener("click", () => {
          const selectedSeconds = Math.min(
            Number(input.value) * 60,
            options.availableSeconds,
          );
          this.cancelPendingInteraction = undefined;
          this.hide();
          resolve(selectedSeconds);
        });
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
      .addEventListener("click", () => history.back());
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => browser.runtime.openOptionsPage());
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
        ?.addEventListener("click", () => browser.runtime.openOptionsPage());
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
    daily.textContent = this.formatFriendlyDuration(options.availableSeconds);
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

  private showIntentionStep(options: EndOfBatchOptions): void {
    const card = this.requiredElement<HTMLElement>(".df-card");
    card.innerHTML = `
      <p class="df-step">Step 1 of 2</p>
      <h1>Why do you want to continue?</h1>
      <div class="df-intentions">
        ${intentions
          .map(
            ([value, label]) => `
              <button class="df-intention" data-intention="${value}">
                <span>${label}</span><span aria-hidden="true">→</span>
              </button>
            `,
          )
          .join("")}
      </div>
      <button class="df-settings-link" data-action="back">Back</button>
    `;

    card
      .querySelectorAll<HTMLButtonElement>("[data-intention]")
      .forEach((button) => {
        button.addEventListener("click", () => this.showHoldStep(options));
      });
    this.requiredElement<HTMLButtonElement>('[data-action="back"]')
      .addEventListener("click", () => this.showEndOfBatch(options));
  }

  private showHoldStep(options: EndOfBatchOptions): void {
    const card = this.requiredElement<HTMLElement>(".df-card");
    card.innerHTML = `
      <p class="df-step">Step 2 of 2</p>
      <div class="df-pause-mark" aria-hidden="true"></div>
      <h1>Pause for a moment.</h1>
      <p class="df-copy">Then press and hold to open another batch.</p>
      <button class="df-hold" data-action="hold" disabled style="--df-hold-progress: 0%">
        <span>Press and hold</span>
        <span class="df-hold__progress" aria-hidden="true"></span>
      </button>
      <p class="df-wait" aria-live="polite"></p>
      <button class="df-settings-link" data-action="back">Back</button>
    `;

    const holdButton =
      this.requiredElement<HTMLButtonElement>('[data-action="hold"]');
    const waitLabel = this.requiredElement<HTMLElement>(".df-wait");
    let remaining = options.unlockDelaySeconds;

    const updateWait = () => {
      waitLabel.textContent =
        remaining > 0 ? `Available in ${remaining}s` : "Whenever you're ready.";
    };
    updateWait();

    const countdown = window.setInterval(() => {
      remaining -= 1;
      updateWait();
      if (remaining <= 0) {
        window.clearInterval(countdown);
        holdButton.disabled = false;
      }
    }, 1000);

    let holdStarted = 0;
    let animationFrame = 0;
    let completed = false;

    const cancelHold = () => {
      if (completed) return;
      holdStarted = 0;
      window.cancelAnimationFrame(animationFrame);
      holdButton.style.setProperty("--df-hold-progress", "0%");
    };

    const updateHold = async (now: number) => {
      const duration = options.holdSeconds * 1000;
      const progress = Math.min(1, (now - holdStarted) / duration);
      holdButton.style.setProperty(
        "--df-hold-progress",
        `${Math.round(progress * 100)}%`,
      );

      if (progress >= 1) {
        completed = true;
        holdButton.disabled = true;
        holdButton.querySelector("span")!.textContent = "Preparing…";
        const granted = await options.onUnlock();
        if (granted > 0) {
          this.hide();
        } else {
          this.showEndOfBatch({
            ...options,
            canUnlock: false,
            remainingToday: 0,
          });
        }
        return;
      }

      animationFrame = window.requestAnimationFrame(updateHold);
    };

    holdButton.addEventListener("pointerdown", (event) => {
      if (holdButton.disabled) return;
      event.preventDefault();
      holdStarted = performance.now();
      holdButton.setPointerCapture(event.pointerId);
      animationFrame = window.requestAnimationFrame(updateHold);
    });
    holdButton.addEventListener("pointerup", cancelHold);
    holdButton.addEventListener("pointercancel", cancelHold);
    holdButton.addEventListener("lostpointercapture", cancelHold);

    this.requiredElement<HTMLButtonElement>('[data-action="back"]')
      .addEventListener("click", () => {
        window.clearInterval(countdown);
        cancelHold();
        this.showEndOfBatch(options);
      });
  }

  private requiredElement<T extends Element>(selector: string): T {
    const element = this.overlay.querySelector<T>(selector);
    if (!element) throw new Error(`Missing intervention UI element: ${selector}`);
    return element;
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
