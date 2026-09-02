import { describe, expect, it } from "vitest";
import { PageInteractionGuard } from "../lib/page-interaction-guard";

describe("page interaction guard", () => {
  it("blocks interaction until its current activation releases it", () => {
    const target = new EventTarget();
    const guard = new PageInteractionGuard(target);

    guard.engage(1);
    guard.engage(2);
    guard.release(1);
    const blockedClick = new Event("click", { cancelable: true });
    target.dispatchEvent(blockedClick);

    expect(blockedClick.defaultPrevented).toBe(true);

    guard.release(2);
    const allowedClick = new Event("click", { cancelable: true });
    target.dispatchEvent(allowedClick);

    expect(allowedClick.defaultPrevented).toBe(false);
  });

  it("restores interaction when destroyed", () => {
    const target = new EventTarget();
    const guard = new PageInteractionGuard(target);
    guard.engage(1);

    guard.destroy();
    const event = new Event("wheel", { cancelable: true });
    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("allows explicitly trusted extension interactions while active", () => {
    const target = new EventTarget();
    const guard = new PageInteractionGuard(
      target,
      (event) => event.type === "click",
    );
    guard.engage(1);

    const allowedClick = new Event("click", { cancelable: true });
    const blockedWheel = new Event("wheel", { cancelable: true });
    target.dispatchEvent(allowedClick);
    target.dispatchEvent(blockedWheel);

    expect(allowedClick.defaultPrevented).toBe(false);
    expect(blockedWheel.defaultPrevented).toBe(true);
  });
});
