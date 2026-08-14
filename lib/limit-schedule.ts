import type {
  PlatformId,
  Settings,
  WeekdayId,
  WeeklyLimitSchedule,
} from "./models";

const WEEKDAY_BY_JS_DAY: WeekdayId[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function areLimitsActive(
  settings: Settings,
  platform: PlatformId,
  date = new Date(),
): boolean {
  const mode = settings.limitSchedule.modeByPlatform[platform];
  if (mode === "always") return true;
  if (mode === "global" && !settings.limitSchedule.globalEnabled) return true;

  const schedule =
    mode === "custom"
      ? settings.limitSchedule.byPlatform[platform]
      : settings.limitSchedule.global;
  return isWithinWeeklySchedule(schedule, date);
}

export function isWithinWeeklySchedule(
  schedule: WeeklyLimitSchedule,
  date: Date,
): boolean {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = parseClockMinutes(schedule.startTime);
  const endMinutes = parseClockMinutes(schedule.endTime);
  const today = weekdayFor(date);

  if (startMinutes === endMinutes) return schedule.days[today];
  if (startMinutes < endMinutes) {
    return (
      schedule.days[today] &&
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    );
  }

  if (currentMinutes >= startMinutes) return schedule.days[today];
  if (currentMinutes >= endMinutes) return false;

  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  return schedule.days[weekdayFor(previousDate)];
}

function weekdayFor(date: Date): WeekdayId {
  return WEEKDAY_BY_JS_DAY[date.getDay()] ?? "monday";
}

function parseClockMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}
