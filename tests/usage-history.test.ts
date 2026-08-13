import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, emptyDailyUsageState } from "../lib/models";
import {
  USAGE_HISTORY_RETENTION_DAYS,
  normalizeUsageHistory,
  recordUsageState,
  usageForDate,
} from "../lib/usage-history";

describe("usage history", () => {
  it("sanitizes dates and per-platform counters", () => {
    const history = normalizeUsageHistory({
      days: [
        {
          date: "2026-08-03",
          usedSecondsByPlatform: {
            reddit: 62.4,
            x: -8,
            instagram: Number.POSITIVE_INFINITY,
            youtube: 12.8,
          },
        },
        { date: "2026-02-31", usedSecondsByPlatform: { reddit: 500 } },
      ],
    });

    expect(history.days).toEqual([
      {
        date: "2026-08-03",
        usedSecondsByPlatform: {
          reddit: 62,
          x: 0,
          instagram: 0,
          youtube: 13,
        },
      },
    ]);
  });

  it("keeps only the most recent retained days", () => {
    const days = Array.from(
      { length: USAGE_HISTORY_RETENTION_DAYS + 2 },
      (_, index) => {
        const date = new Date(2026, 6, index + 1);
        const key = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
        return {
          date: key,
          usedSecondsByPlatform: {
            reddit: index,
            x: 0,
            instagram: 0,
            youtube: 0,
          },
        };
      },
    );

    const history = normalizeUsageHistory({ days });

    expect(history.days).toHaveLength(USAGE_HISTORY_RETENTION_DAYS);
    expect(history.days[0]?.date).toBe("2026-07-03");
    expect(history.days.at(-1)?.date).toBe("2026-08-01");
  });

  it("records a current snapshot without discarding previous days", () => {
    const previous = emptyDailyUsageState(
      new Date(2026, 7, 2),
      DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform,
    );
    previous.usedSecondsByPlatform.reddit = 300;
    const current = emptyDailyUsageState(
      new Date(2026, 7, 3),
      DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform,
    );
    current.usedSecondsByPlatform.instagram = 125;

    const history = recordUsageState(
      recordUsageState({ days: [] }, previous),
      current,
    );

    expect(usageForDate(history, "2026-08-02").reddit).toBe(300);
    expect(usageForDate(history, "2026-08-03").instagram).toBe(125);
    expect(usageForDate(history, "2026-08-04")).toEqual({
      reddit: 0,
      x: 0,
      instagram: 0,
      youtube: 0,
    });
  });

  it("never lowers an already persisted cumulative counter", () => {
    const state = emptyDailyUsageState(
      new Date(2026, 7, 3),
      DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform,
    );
    state.usedSecondsByPlatform.reddit = 60;
    const history = recordUsageState(
      {
        days: [
          {
            date: "2026-08-03",
            usedSecondsByPlatform: {
              reddit: 120,
              x: 30,
              instagram: 0,
              youtube: 0,
            },
          },
        ],
      },
      state,
    );

    expect(usageForDate(history, "2026-08-03")).toEqual({
      reddit: 120,
      x: 30,
      instagram: 0,
      youtube: 0,
    });
  });
});
