export interface BatchGateOptions {
  unlockSize: number;
  remainingToday: number;
  canUnlock: boolean;
  unlockDelaySeconds: number;
  holdSeconds: number;
  onUnlock(): Promise<number>;
}

export class BatchGateUi {
  private readonly host = document.createElement("div");
  private readonly shadow = this.host.attachShadow({ mode: "closed" });
  private boundary?: HTMLElement;
  private placement: "before" | "after" = "after";
  private renderKey = "";
  private countdownTimer?: number;
  private animationFrame?: number;
  private scrollGuardActive = false;

  constructor() {
    this.host.dataset.dopamineFastBatchGate = "true";
  }

  showAfter(boundary: HTMLElement, options: BatchGateOptions): void {
    this.showAt(boundary, "after", options);
  }

  showBefore(boundary: HTMLElement, options: BatchGateOptions): void {
    this.showAt(boundary, "before", options);
  }

  private showAt(
    boundary: HTMLElement,
    placement: "before" | "after",
    options: BatchGateOptions,
  ): void {
    const renderKey = [
      options.unlockSize,
      options.remainingToday,
      options.canUnlock,
      options.unlockDelaySeconds,
      options.holdSeconds,
    ].join(":");

    if (
      this.boundary !== boundary ||
      this.placement !== placement ||
      this.renderKey !== renderKey
    ) {
      this.boundary = boundary;
      this.placement = placement;
      this.renderKey = renderKey;
      this.render(options);
    }

    this.ensurePlacement(boundary, placement);
    this.startScrollGuard();
  }

  isFor(boundary: HTMLElement, placement: "before" | "after"): boolean {
    return (
      this.boundary === boundary &&
      this.placement === placement &&
      this.renderKey.length > 0
    );
  }

  ensurePlacement(
    boundary: HTMLElement,
    placement: "before" | "after",
  ): void {
    if (!this.isFor(boundary, placement)) return;
    const correctlyPlaced =
      placement === "after"
        ? boundary.nextElementSibling === this.host
        : boundary.previousElementSibling === this.host;
    if (!correctlyPlaced) {
      boundary.insertAdjacentElement(
        placement === "after" ? "afterend" : "beforebegin",
        this.host,
      );
    }
  }

  hide(): void {
    this.clearTimers();
    this.stopScrollGuard();
    this.host.remove();
    this.boundary = undefined;
    this.placement = "after";
    this.renderKey = "";
  }

  destroy(): void {
    this.hide();
  }

  private render(options: BatchGateOptions): void {
    this.clearTimers();
    this.shadow.replaceChildren();

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; width: 100%; }
      .gate { box-sizing: border-box; width: min(100%, 680px); margin: 20px auto; padding: 24px; border: 1px solid rgba(128, 128, 128, .35); border-radius: 12px; background: #151716; color: #f0f1ed; font: 14px/1.45 system-ui, sans-serif; text-align: center; }
      .label { margin: 0 0 6px; color: #a5aaa6; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .copy { margin: 0 0 16px; font-size: 15px; }
      button { position: relative; overflow: hidden; width: 100%; min-height: 48px; padding: 12px 16px; border: 1px solid #929a94; border-radius: 8px; background: transparent; color: #f0f1ed; font: inherit; font-weight: 800; cursor: pointer; touch-action: none; }
      button::before { position: absolute; inset: 0; width: var(--progress, 0%); background: rgba(146, 154, 148, .25); content: ""; pointer-events: none; }
      button span { position: relative; }
      button:disabled { cursor: default; opacity: .55; }
    `;
    const gate = document.createElement("section");
    gate.className = "gate";
    gate.setAttribute("aria-label", "End of current post batch");

    const label = document.createElement("p");
    label.className = "label";
    label.textContent = "End of this batch";
    const copy = document.createElement("p");
    copy.className = "copy";

    gate.append(label, copy);

    if (!options.canUnlock) {
      copy.textContent = "You have reached today's post limit.";
      this.shadow.append(style, gate);
      return;
    }

    copy.textContent = `${options.remainingToday} posts remain in today's limit.`;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = options.unlockDelaySeconds > 0;
    const buttonLabel = document.createElement("span");
    button.append(buttonLabel);
    gate.append(button);
    this.shadow.append(style, gate);

    let remaining = options.unlockDelaySeconds;
    const readyLabel = `Hold to load ${options.unlockSize} more posts`;
    const updateCountdown = () => {
      buttonLabel.textContent =
        remaining > 0
          ? `Load ${options.unlockSize} more posts in ${remaining}s`
          : readyLabel;
    };
    updateCountdown();

    if (remaining > 0) {
      this.countdownTimer = window.setInterval(() => {
        remaining -= 1;
        updateCountdown();
        if (remaining <= 0) {
          if (this.countdownTimer) window.clearInterval(this.countdownTimer);
          this.countdownTimer = undefined;
          button.disabled = false;
        }
      }, 1000);
    }

    let holdStarted = 0;
    let completed = false;
    const cancelHold = () => {
      if (completed) return;
      holdStarted = 0;
      if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
      button.style.setProperty("--progress", "0%");
    };
    const updateHold = (now: number) => {
      const progress = Math.min(
        1,
        (now - holdStarted) / (options.holdSeconds * 1000),
      );
      button.style.setProperty("--progress", `${Math.round(progress * 100)}%`);
      if (progress < 1) {
        this.animationFrame = window.requestAnimationFrame(updateHold);
        return;
      }

      completed = true;
      button.disabled = true;
      buttonLabel.textContent = "Loading posts…";
      void options
        .onUnlock()
        .then((granted) => {
          if (granted <= 0) {
            this.render({ ...options, canUnlock: false, remainingToday: 0 });
          }
        })
        .catch(() => {
          completed = false;
          holdStarted = 0;
          button.disabled = false;
          buttonLabel.textContent = readyLabel;
          button.style.setProperty("--progress", "0%");
        });
    };
    const startHold = () => {
      if (button.disabled || holdStarted > 0) return;
      holdStarted = performance.now();
      this.animationFrame = window.requestAnimationFrame(updateHold);
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (button.disabled) return;
      button.setPointerCapture(event.pointerId);
      startHold();
    });
    button.addEventListener("pointerup", cancelHold);
    button.addEventListener("pointercancel", cancelHold);
    button.addEventListener("lostpointercapture", cancelHold);
    button.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      startHold();
    });
    button.addEventListener("keyup", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      cancelHold();
    });
  }

  private clearTimers(): void {
    if (this.countdownTimer) window.clearInterval(this.countdownTimer);
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
    this.countdownTimer = undefined;
    this.animationFrame = undefined;
  }

  private startScrollGuard(): void {
    if (this.scrollGuardActive) return;
    this.scrollGuardActive = true;
    window.addEventListener("scroll", this.keepGateInView, { passive: true });
    this.keepGateInView();
  }

  private stopScrollGuard(): void {
    if (!this.scrollGuardActive) return;
    this.scrollGuardActive = false;
    window.removeEventListener("scroll", this.keepGateInView);
  }

  private readonly keepGateInView = (): void => {
    if (!this.scrollGuardActive || !this.host.isConnected) return;
    const top = this.host.getBoundingClientRect().top;
    if (top >= 16) return;
    window.scrollTo({
      top: Math.max(0, window.scrollY + top - 16),
      behavior: "auto",
    });
  };
}
