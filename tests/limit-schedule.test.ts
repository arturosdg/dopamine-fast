import { describe, expect, it } from "vitest";
import {
  areLimitsActive,
  isWithinWeeklySchedule,
} from "../lib/limit-schedule";
import {
  DEFAULT_SETTINGS,
  type WeeklyLimitSchedule,
} from "../lib/models";

const mondayOnly = (
  startTime: string,
  endTime: string,
): WeeklyLimitSchedule => ({
  startTime,
  endTime,
  days: {
    monday: true,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  },
});

describe("weekly limit schedules", () => {
  it("uses an inclusive start and exclusive end on selected days", () => {
    const schedule = mondayOnly("09:00", "17:00");

    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 10, 9, 0)),
    ).toBe(true);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 10, 16, 59)),
    ).toBe(true);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 10, 17, 0)),
    ).toBe(false);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 11, 10, 0)),
    ).toBe(false);
  });

  it("carries an overnight window into the following day", () => {
    const schedule = mondayOnly("22:00", "07:00");

    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 10, 23, 0)),
    ).toBe(true);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 11, 6, 59)),
    ).toBe(true);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 11, 7, 0)),
    ).toBe(false);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 11, 23, 0)),
    ).toBe(false);
  });

  it("treats equal start and end times as the full selected day", () => {
    const schedule = mondayOnly("00:00", "00:00");

    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 10, 15, 30)),
    ).toBe(true);
    expect(
      isWithinWeeklySchedule(schedule, new Date(2026, 7, 11, 15, 30)),
    ).toBe(false);
  });

  it("supports global, custom and always-active modes per network", () => {
    const mondayMorning = mondayOnly("09:00", "12:00");
    const mondayEvening = mondayOnly("18:00", "21:00");
    const settings = {
      ...DEFAULT_SETTINGS,
      limitSchedule: {
        ...DEFAULT_SETTINGS.limitSchedule,
        globalEnabled: true,
        global: mondayMorning,
        modeByPlatform: {
          reddit: "global" as const,
          x: "custom" as const,
          instagram: "always" as const,
          youtube: "global" as const,
        },
        byPlatform: {
          ...DEFAULT_SETTINGS.limitSchedule.byPlatform,
          x: mondayEvening,
        },
      },
    };

    const mondayAtTen = new Date(2026, 7, 10, 10, 0);
    const mondayAtNineteen = new Date(2026, 7, 10, 19, 0);
    expect(areLimitsActive(settings, "reddit", mondayAtTen)).toBe(true);
    expect(areLimitsActive(settings, "reddit", mondayAtNineteen)).toBe(false);
    expect(areLimitsActive(settings, "x", mondayAtTen)).toBe(false);
    expect(areLimitsActive(settings, "x", mondayAtNineteen)).toBe(true);
    expect(areLimitsActive(settings, "instagram", mondayAtTen)).toBe(true);
  });

  it("keeps inherited limits active all day when global scheduling is off", () => {
    expect(
      areLimitsActive(
        DEFAULT_SETTINGS,
        "youtube",
        new Date(2026, 7, 11, 3, 0),
      ),
    ).toBe(true);
  });
});
