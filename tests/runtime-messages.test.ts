import { describe, expect, it } from "vitest";
import { isRuntimeMessage } from "../lib/runtime-messages";

describe("runtime messages", () => {
  it("accepts valid state and navigation messages", () => {
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:add-usage-seconds",
        platform: "reddit",
        elapsedSeconds: 5,
      }),
    ).toBe(true);
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:set-active-session",
        session: {
          platform: "instagram",
          date: "2026-08-16",
          plannedSeconds: 240,
        },
      }),
    ).toBe(true);
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:get-active-session",
        platform: "reddit",
      }),
    ).toBe(true);
    expect(isRuntimeMessage({ type: "dopamine-fast:leave-feed" })).toBe(true);
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:add-usage-seconds",
        platform: "youtube",
        elapsedSeconds: 5,
      }),
    ).toBe(true);
  });

  it("rejects malformed and unknown messages", () => {
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:add-usage-seconds",
        platform: "tiktok",
        elapsedSeconds: 5,
      }),
    ).toBe(false);
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:reserve-allowance",
        platform: "x",
        requested: Number.POSITIVE_INFINITY,
        isUnlock: false,
      }),
    ).toBe(false);
    expect(isRuntimeMessage({ type: "dopamine-fast:unknown" })).toBe(false);
    expect(
      isRuntimeMessage({
        type: "dopamine-fast:set-active-session",
        session: {
          platform: "reddit",
          date: "today",
          plannedSeconds: 0,
        },
      }),
    ).toBe(false);
  });
});
