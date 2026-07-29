import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  availableAllowance,
  emptyDailyState,
  localDateKey,
  normalizeDailyState,
  sanitizeSettings,
} from "../lib/models";

describe("settings", () => {
  it("uses safe defaults and clamps numeric values", () => {
    const settings = sanitizeSettings({
      openingDelaySeconds: 900,
      batchSize: 0,
      unlockBatchSize: 300,
      dailyLimit: -10,
      holdSeconds: 0,
    });

    expect(settings.openingDelaySeconds).toBe(60);
    expect(settings.batchSize).toBe(5);
    expect(settings.unlockBatchSize).toBe(50);
    expect(settings.dailyLimit).toBe(10);
    expect(settings.holdSeconds).toBe(1);
    expect(settings.enabledSites).toEqual(DEFAULT_SETTINGS.enabledSites);
  });
});

describe("daily state", () => {
  const today = new Date(2026, 6, 29, 9, 30);

  it("uses the local calendar day", () => {
    expect(localDateKey(today)).toBe("2026-07-29");
  });

  it("resets stale state", () => {
    const stale = {
      ...emptyDailyState(new Date(2026, 6, 28)),
      revealed: 55,
    };

    expect(normalizeDailyState(stale, today)).toEqual(emptyDailyState(today));
  });

  it("calculates the remaining allowance", () => {
    const state = {
      ...emptyDailyState(today),
      revealed: 35,
    };
    expect(
      availableAllowance({ ...DEFAULT_SETTINGS, dailyLimit: 60 }, state),
    ).toBe(25);
  });
});
