import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  availableAllowance,
  availableUsageSeconds,
  emptyDailyState,
  emptyDailyUsageState,
  localDateKey,
  normalizeDailyState,
  normalizeDailyUsageState,
  sanitizeSettings,
} from "../lib/models";

describe("settings", () => {
  it("uses safe defaults and clamps numeric values", () => {
    const settings = sanitizeSettings({
      openingDelaySeconds: 900,
      sessionDurationMinutes: 0,
      dailyUsageLimitMinutes: 900,
      batchSize: 0,
      unlockBatchSize: 300,
      dailyLimit: -10,
      holdSeconds: 0,
      xFollowingOnly: "yes" as unknown as boolean,
    });

    expect(settings.openingDelaySeconds).toBe(60);
    expect(settings.sessionDurationMinutes).toBe(1);
    expect(settings.dailyUsageLimitMinutes).toBe(240);
    expect(settings.batchSize).toBe(5);
    expect(settings.unlockBatchSize).toBe(50);
    expect(settings.dailyLimit).toBe(10);
    expect(settings.holdSeconds).toBe(1);
    expect(settings.xFollowingOnly).toBe(false);
    expect(settings.enabledSites).toEqual(DEFAULT_SETTINGS.enabledSites);
  });

  it("keeps an explicit X Following preference", () => {
    expect(sanitizeSettings({ xFollowingOnly: true }).xFollowingOnly).toBe(
      true,
    );
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
      revealed: 45,
      revealedByPlatform: {
        reddit: 35,
        x: 10,
        instagram: 0,
      },
    };
    expect(
      availableAllowance(
        { ...DEFAULT_SETTINGS, dailyLimit: 60 },
        state,
        "reddit",
      ),
    ).toBe(25);
    expect(
      availableAllowance(
        { ...DEFAULT_SETTINGS, dailyLimit: 60 },
        state,
        "instagram",
      ),
    ).toBe(60);
  });

  it("migrates legacy daily state to per-network unlock counters", () => {
    const legacy = {
      date: localDateKey(today),
      revealed: 30,
      revealedByPlatform: { reddit: 20, x: 10, instagram: 0 },
      unlocks: 2,
    };

    expect(normalizeDailyState(legacy, today)).toEqual({
      ...legacy,
      unlocks: 0,
      unlocksByPlatform: { reddit: 0, x: 0, instagram: 0 },
    });
  });

  it("resets stale time usage and calculates a per-network hard limit", () => {
    const staleUsage = {
      ...emptyDailyUsageState(new Date(2026, 6, 28), 10),
      usedSecondsByPlatform: {
        reddit: 900,
        x: 0,
        instagram: 0,
      },
    };
    const currentUsage = normalizeDailyUsageState(staleUsage, today, 10);

    expect(currentUsage).toEqual(emptyDailyUsageState(today, 10));

    currentUsage.usedSecondsByPlatform.reddit = 420;
    expect(
      availableUsageSeconds(
        { ...DEFAULT_SETTINGS, dailyUsageLimitMinutes: 10 },
        currentUsage,
        "reddit",
      ),
    ).toBe(180);
    expect(
      availableUsageSeconds(
        { ...DEFAULT_SETTINGS, dailyUsageLimitMinutes: 10 },
        currentUsage,
        "x",
      ),
    ).toBe(600);
  });

  it("keeps the effective time limit fixed until the next day", () => {
    const usage = emptyDailyUsageState(today, 20);
    const normalized = normalizeDailyUsageState(usage, today, 60);

    expect(normalized.dailyLimitMinutes).toBe(20);
    expect(
      availableUsageSeconds(
        { ...DEFAULT_SETTINGS, dailyUsageLimitMinutes: 60 },
        normalized,
        "reddit",
      ),
    ).toBe(1200);
  });
});
