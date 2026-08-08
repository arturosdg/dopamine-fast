const BLOCKED_EVENT_TYPES = [
  "auxclick",
  "click",
  "keydown",
  "pointerdown",
  "touchmove",
  "touchstart",
  "wheel",
] as const;
const LISTENER_OPTIONS: AddEventListenerOptions = {
  capture: true,
  passive: false,
};

export class PageInteractionGuard {
  private active = false;
  private owner: number | undefined;

  constructor(private readonly target: EventTarget = window) {}

  engage(owner: number): void {
    this.owner = owner;
    if (this.active) return;
    this.active = true;
    BLOCKED_EVENT_TYPES.forEach((type) => {
      this.target.addEventListener(type, this.blockInteraction, LISTENER_OPTIONS);
    });
  }

  release(owner: number): void {
    if (owner !== this.owner) return;
    this.releaseAll();
  }

  releaseAll(): void {
    if (!this.active) return;
    this.active = false;
    this.owner = undefined;
    BLOCKED_EVENT_TYPES.forEach((type) => {
      this.target.removeEventListener(
        type,
        this.blockInteraction,
        LISTENER_OPTIONS,
      );
    });
  }

  destroy(): void {
    this.releaseAll();
  }

  private readonly blockInteraction = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
}
