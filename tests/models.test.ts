import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
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
      sessionDurationMinutesByPlatform: {
        ...DEFAULT_SETTINGS.sessionDurationMinutesByPlatform,
        reddit: 0,
      },
      dailyUsageLimitMinutesByPlatform: {
        ...DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform,
        instagram: 900,
      },
      batchSize: 0,
      unlockBatchSize: 300,
      holdSeconds: 0,
      xFollowingOnly: "yes" as unknown as boolean,
      instagramFollowingOnly: "yes" as unknown as boolean,
      youtubeSubscriptionsOnly: "yes" as unknown as boolean,
      enabledSites: {
        ...DEFAULT_SETTINGS.enabledSites,
        youtube: "yes" as unknown as boolean,
      },
    });

    expect(settings.openingDelaySeconds).toBe(60);
    expect(settings.sessionDurationMinutesByPlatform.reddit).toBe(1);
    expect(settings.sessionDurationMinutesByPlatform.x).toBe(10);
    expect(settings.dailyUsageLimitMinutesByPlatform.instagram).toBe(240);
    expect(settings.dailyUsageLimitMinutesByPlatform.youtube).toBe(30);
    expect(settings.batchSize).toBe(5);
    expect(settings.unlockBatchSize).toBe(50);
    expect(settings.holdSeconds).toBe(1);
    expect(settings.xFollowingOnly).toBe(false);
    expect(settings.instagramFollowingOnly).toBe(false);
    expect(settings.youtubeSubscriptionsOnly).toBe(false);
    expect(settings.enabledSites).toEqual(DEFAULT_SETTINGS.enabledSites);
  });

  it("keeps an explicit X Following preference", () => {
    expect(sanitizeSettings({ xFollowingOnly: true }).xFollowingOnly).toBe(
      true,
    );
  });

  it("keeps an explicit Instagram Following preference", () => {
    expect(
      sanitizeSettings({ instagramFollowingOnly: true })
        .instagramFollowingOnly,
    ).toBe(true);
  });

  it("keeps an explicit YouTube subscriptions preference", () => {
    const settings = sanitizeSettings({
      youtubeSubscriptionsOnly: true,
      enabledSites: { ...DEFAULT_SETTINGS.enabledSites, youtube: false },
    });

    expect(settings.youtubeSubscriptionsOnly).toBe(true);
    expect(settings.enabledSites.youtube).toBe(false);
  });

  it("migrates legacy global time settings to every network", () => {
    const settings = sanitizeSettings({
      sessionDurationMinutes: 12,
      dailyUsageLimitMinutes: 45,
    });

    expect(settings.sessionDurationMinutesByPlatform).toEqual({
      reddit: 12,
      x: 12,
      instagram: 12,
      youtube: 12,
    });
    expect(settings.dailyUsageLimitMinutesByPlatform).toEqual({
      reddit: 45,
      x: 45,
      instagram: 45,
      youtube: 45,
    });
    expect(settings).not.toHaveProperty("sessionDurationMinutes");
    expect(settings).not.toHaveProperty("dailyUsageLimitMinutes");
  });

  it("sanitizes weekly schedules with backward-compatible defaults", () => {
    const settings = sanitizeSettings({
      limitSchedule: {
        globalEnabled: true,
        global: {
          startTime: "25:00",
          endTime: "08:30",
          days: { monday: false },
        },
        modeByPlatform: {
          reddit: "invalid",
          instagram: "custom",
        },
        byPlatform: {
          instagram: {
            startTime: "20:15",
            endTime: "06:45",
            days: { saturday: false },
          },
        },
      },
    });

    expect(settings.limitSchedule.globalEnabled).toBe(true);
    expect(settings.limitSchedule.global.startTime).toBe("09:00");
    expect(settings.limitSchedule.global.endTime).toBe("08:30");
    expect(settings.limitSchedule.global.days.monday).toBe(false);
    expect(settings.limitSchedule.global.days.tuesday).toBe(true);
    expect(settings.limitSchedule.modeByPlatform.reddit).toBe("global");
    expect(settings.limitSchedule.modeByPlatform.instagram).toBe("custom");
    expect(settings.limitSchedule.byPlatform.instagram.startTime).toBe(
      "20:15",
    );
    expect(settings.limitSchedule.byPlatform.instagram.days.saturday).toBe(
      false,
    );
  });

  it("sanitizes access-block schedules with blocking disabled by default", () => {
    const settings = sanitizeSettings({
      accessBlockSchedule: {
        globalEnabled: true,
        global: {
          startTime: "24:00",
          endTime: "06:30",
          days: { sunday: false },
        },
        modeByPlatform: {
          reddit: "custom",
          x: "invalid",
          instagram: "never",
        },
        byPlatform: {
          reddit: {
            startTime: "21:15",
            endTime: "07:45",
            days: { friday: false },
          },
        },
      },
    });

    expect(settings.accessBlockSchedule.globalEnabled).toBe(true);
    expect(settings.accessBlockSchedule.global.startTime).toBe("22:00");
    expect(settings.accessBlockSchedule.global.endTime).toBe("06:30");
    expect(settings.accessBlockSchedule.global.days.sunday).toBe(false);
    expect(settings.accessBlockSchedule.global.days.monday).toBe(true);
    expect(settings.accessBlockSchedule.modeByPlatform.reddit).toBe("custom");
    expect(settings.accessBlockSchedule.modeByPlatform.x).toBe("global");
    expect(settings.accessBlockSchedule.modeByPlatform.instagram).toBe(
      "never",
    );
    expect(settings.accessBlockSchedule.byPlatform.reddit.startTime).toBe(
      "21:15",
    );
    expect(settings.accessBlockSchedule.byPlatform.reddit.days.friday).toBe(
      false,
    );
    expect(sanitizeSettings({}).accessBlockSchedule.globalEnabled).toBe(false);
  });

  it("drops legacy post-limit and friction-mode settings", () => {
    const settings = sanitizeSettings({
      mode: "strict",
      dailyLimit: 10,
    } as Partial<typeof DEFAULT_SETTINGS> & {
      mode: string;
      dailyLimit: number;
    });

    expect(settings).not.toHaveProperty("mode");
    expect(settings).not.toHaveProperty("dailyLimit");
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

  it("migrates legacy daily state to per-network unlock counters", () => {
    const legacy = {
      date: localDateKey(today),
      revealed: 30,
      revealedByPlatform: { reddit: 20, x: 10, instagram: 0, youtube: 0 },
      unlocks: 2,
    };

    expect(normalizeDailyState(legacy, today)).toEqual({
      ...legacy,
      unlocks: 0,
      unlocksByPlatform: { reddit: 0, x: 0, instagram: 0, youtube: 0 },
    });
  });

  it("resets stale time usage and calculates a per-network hard limit", () => {
    const configuredLimits = {
      reddit: 10,
      x: 20,
      instagram: 30,
      youtube: 40,
    };
    const staleUsage = {
      ...emptyDailyUsageState(new Date(2026, 6, 28), configuredLimits),
      usedSecondsByPlatform: {
        reddit: 900,
        x: 0,
        instagram: 0,
        youtube: 0,
      },
    };
    const currentUsage = normalizeDailyUsageState(
      staleUsage,
      today,
      configuredLimits,
    );

    expect(currentUsage).toEqual(
      emptyDailyUsageState(today, configuredLimits),
    );

    currentUsage.usedSecondsByPlatform.reddit = 420;
    expect(
      availableUsageSeconds(
        {
          ...DEFAULT_SETTINGS,
          dailyUsageLimitMinutesByPlatform: configuredLimits,
        },
        currentUsage,
        "reddit",
      ),
    ).toBe(180);
    expect(
      availableUsageSeconds(
        {
          ...DEFAULT_SETTINGS,
          dailyUsageLimitMinutesByPlatform: configuredLimits,
        },
        currentUsage,
        "x",
      ),
    ).toBe(1200);
  });

  it("keeps each effective time limit fixed until the next day", () => {
    const storedLimits = {
      reddit: 20,
      x: 25,
      instagram: 30,
      youtube: 35,
    };
    const configuredLimits = {
      reddit: 60,
      x: 65,
      instagram: 70,
      youtube: 75,
    };
    const usage = emptyDailyUsageState(today, storedLimits);
    const normalized = normalizeDailyUsageState(
      usage,
      today,
      configuredLimits,
    );

    expect(normalized.dailyLimitMinutesByPlatform).toEqual(storedLimits);
    expect(
      availableUsageSeconds(
        {
          ...DEFAULT_SETTINGS,
          dailyUsageLimitMinutesByPlatform: configuredLimits,
        },
        normalized,
        "reddit",
      ),
    ).toBe(1200);
  });

  it("adds safe YouTube counters to current-day legacy usage", () => {
    const legacy = {
      date: localDateKey(today),
      dailyLimitMinutes: 30,
      usedSecondsByPlatform: { reddit: 60, x: 0, instagram: 0 },
    };

    expect(
      normalizeDailyUsageState(
        legacy,
        today,
        DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform,
      ),
    ).toEqual({
      date: legacy.date,
      dailyLimitMinutesByPlatform: {
        reddit: 30,
        x: 30,
        instagram: 30,
        youtube: 30,
      },
      usedSecondsByPlatform: {
        ...legacy.usedSecondsByPlatform,
        youtube: 0,
      },
    });
  });
});
