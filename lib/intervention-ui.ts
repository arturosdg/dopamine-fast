export interface EndOfBatchOptions {
  platformLabel: string;
  unlockSize: number;
  remainingToday: number;
  canUnlock: boolean;
  unlockDelaySeconds: number;
  holdSeconds: number;
  onUnlock(): Promise<number>;
}

const intentions = [
  ["specific", "Busco algo concreto"],
  ["reply", "Quiero responder o interactuar"],
  ["deliberate", "Quiero seguir leyendo"],
  ["automatic", "Estoy bajando por inercia"],
] as const;

export class InterventionUi {
  private readonly root: HTMLElement;
  private previousHtmlOverflow = "";
  private previousBodyOverflow = "";
  private pageLocked = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  hide(): void {
    this.root.replaceChildren();
    this.root.dataset.visible = "false";
    this.unlockPage();
  }

  async showOpening(
    platformLabel: string,
    delaySeconds: number,
  ): Promise<void> {
    if (delaySeconds <= 0) return;

    this.lockPage();
    this.root.dataset.visible = "true";
    this.root.innerHTML = `
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-opening-title">
        <article class="df-card df-card--opening">
          <p class="df-kicker">Una pausa antes de entrar</p>
          <div class="df-countdown" aria-live="polite">${delaySeconds}</div>
          <h1 id="df-opening-title">¿A qué vienes a ${platformLabel}?</h1>
          <p class="df-copy">No tienes que responder. Solo deja que pase el impulso automático.</p>
          <div class="df-actions">
            <button class="df-button df-button--quiet" data-action="leave">Salir</button>
            <button class="df-button df-button--primary" data-action="continue" disabled>
              Continuar en ${delaySeconds}s
            </button>
          </div>
          <button class="df-settings-link" data-action="settings">Ajustar esta pausa</button>
        </article>
      </section>
    `;

    const countdown = this.requiredElement<HTMLElement>(".df-countdown");
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

    await new Promise<void>((resolve) => {
      let remaining = delaySeconds;
      const interval = window.setInterval(() => {
        remaining -= 1;
        countdown.textContent = String(Math.max(0, remaining));
        continueButton.textContent =
          remaining > 0 ? `Continuar en ${remaining}s` : "Entrar con intención";

        if (remaining <= 0) {
          window.clearInterval(interval);
          continueButton.disabled = false;
        }
      }, 1000);

      continueButton.addEventListener("click", () => {
        window.clearInterval(interval);
        this.hide();
        resolve();
      });
    });
  }

  showEndOfBatch(options: EndOfBatchOptions): void {
    this.lockPage();
    this.root.dataset.visible = "true";
    this.root.innerHTML = `
      <section class="df-backdrop" role="dialog" aria-modal="true" aria-labelledby="df-end-title">
        <article class="df-card">
          <div class="df-rule"></div>
          <p class="df-kicker">Fin del lote</p>
          <h1 id="df-end-title">Ya has terminado por ahora.</h1>
          <p class="df-copy">
            ${options.remainingToday > 0
              ? `Quedan ${options.remainingToday} publicaciones en tu límite de hoy.`
              : "Has alcanzado tu límite diario."}
          </p>
          <div class="df-actions df-actions--stack">
            <button class="df-button df-button--primary" data-action="leave">Salir de ${options.platformLabel}</button>
            ${
              options.canUnlock
                ? `<button class="df-button df-button--quiet" data-action="unlock">Desbloquear ${options.unlockSize} más</button>`
                : ""
            }
          </div>
          <button class="df-settings-link" data-action="settings">Cambiar límites</button>
        </article>
      </section>
    `;

    this.requiredElement<HTMLButtonElement>('[data-action="leave"]')
      .addEventListener("click", () => history.back());
    this.requiredElement<HTMLButtonElement>('[data-action="settings"]')
      .addEventListener("click", () => browser.runtime.openOptionsPage());
    this.root
      .querySelector<HTMLButtonElement>('[data-action="unlock"]')
      ?.addEventListener("click", () => this.showIntentionStep(options));
  }

  private showIntentionStep(options: EndOfBatchOptions): void {
    const card = this.requiredElement<HTMLElement>(".df-card");
    card.innerHTML = `
      <p class="df-step">Paso 1 de 2</p>
      <h1>¿Para qué quieres continuar?</h1>
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
      <button class="df-settings-link" data-action="back">Volver</button>
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
      <p class="df-step">Paso 2 de 2</p>
      <div class="df-pause-mark" aria-hidden="true"></div>
      <h1>Espera un momento.</h1>
      <p class="df-copy">Después mantén pulsado para abrir otro lote.</p>
      <button class="df-hold" data-action="hold" disabled style="--df-hold-progress: 0%">
        <span>Mantén pulsado</span>
        <span class="df-hold__progress" aria-hidden="true"></span>
      </button>
      <p class="df-wait" aria-live="polite"></p>
      <button class="df-settings-link" data-action="back">Volver</button>
    `;

    const holdButton =
      this.requiredElement<HTMLButtonElement>('[data-action="hold"]');
    const waitLabel = this.requiredElement<HTMLElement>(".df-wait");
    let remaining = options.unlockDelaySeconds;

    const updateWait = () => {
      waitLabel.textContent =
        remaining > 0 ? `Disponible en ${remaining}s` : "Cuando quieras.";
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
        holdButton.querySelector("span")!.textContent = "Preparando…";
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
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing intervention UI element: ${selector}`);
    return element;
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
