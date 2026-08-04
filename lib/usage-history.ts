import type { DailyUsageState, PlatformId } from "./models";

export const USAGE_HISTORY_RETENTION_DAYS = 30;

export interface UsageHistoryDay {
  date: string;
  usedSecondsByPlatform: Record<PlatformId, number>;
}

export interface UsageHistory {
  days: UsageHistoryDay[];
}

const PLATFORM_IDS: PlatformId[] = ["reddit", "x", "instagram"];
const MAX_DAILY_SECONDS = 24 * 60 * 60;

export function emptyUsageHistory(): UsageHistory {
  return { days: [] };
}

export function normalizeUsageHistory(value: unknown): UsageHistory {
  if (!value || typeof value !== "object") return emptyUsageHistory();
  const days = (value as { days?: unknown }).days;
  if (!Array.isArray(days)) return emptyUsageHistory();

  const normalizedByDate = new Map<string, UsageHistoryDay>();
  for (const candidate of days) {
    const normalized = normalizeDay(candidate);
    if (normalized) normalizedByDate.set(normalized.date, normalized);
  }

  return {
    days: [...normalizedByDate.values()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-USAGE_HISTORY_RETENTION_DAYS),
  };
}

export function recordUsageState(
  history: unknown,
  state: DailyUsageState,
): UsageHistory {
  const normalized = normalizeUsageHistory(history);
  const day = normalizeDay(state);
  if (!day) return normalized;
  const previous = normalized.days.find((entry) => entry.date === day.date);
  const mergedDay: UsageHistoryDay = previous
    ? {
        date: day.date,
        usedSecondsByPlatform: {
          reddit: Math.max(
            previous.usedSecondsByPlatform.reddit,
            day.usedSecondsByPlatform.reddit,
          ),
          x: Math.max(
            previous.usedSecondsByPlatform.x,
            day.usedSecondsByPlatform.x,
          ),
          instagram: Math.max(
            previous.usedSecondsByPlatform.instagram,
            day.usedSecondsByPlatform.instagram,
          ),
        },
      }
    : day;
  if (
    !previous &&
    Object.values(mergedDay.usedSecondsByPlatform).every(
      (seconds) => seconds === 0,
    )
  ) {
    return normalized;
  }

  return normalizeUsageHistory({
    days: [
      ...normalized.days.filter((entry) => entry.date !== mergedDay.date),
      mergedDay,
    ],
  });
}

export function usageForDate(
  history: UsageHistory,
  date: string,
): Record<PlatformId, number> {
  return (
    history.days.find((day) => day.date === date)?.usedSecondsByPlatform ??
    emptyPlatformUsage()
  );
}

function normalizeDay(value: unknown): UsageHistoryDay | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as {
    date?: unknown;
    usedSecondsByPlatform?: unknown;
  };
  if (typeof candidate.date !== "string" || !isLocalDateKey(candidate.date)) {
    return undefined;
  }

  const counters =
    candidate.usedSecondsByPlatform &&
    typeof candidate.usedSecondsByPlatform === "object"
      ? (candidate.usedSecondsByPlatform as Record<string, unknown>)
      : {};
  const usedSecondsByPlatform = emptyPlatformUsage();
  for (const platform of PLATFORM_IDS) {
    usedSecondsByPlatform[platform] = normalizeSeconds(counters[platform]);
  }

  return { date: candidate.date, usedSecondsByPlatform };
}

function emptyPlatformUsage(): Record<PlatformId, number> {
  return { reddit: 0, x: 0, instagram: 0 };
}

function normalizeSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_DAILY_SECONDS, Math.max(0, Math.round(value)));
}

function isLocalDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}
