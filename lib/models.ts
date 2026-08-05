export type PlatformId = "reddit" | "x" | "instagram" | "youtube";
export type GuardMode = "gentle" | "balanced" | "strict";

export interface Settings {
  enabled: boolean;
  mode: GuardMode;
  openingDelaySeconds: number;
  sessionDurationMinutes: number;
  dailyUsageLimitMinutes: number;
  batchSize: number;
  unlockBatchSize: number;
  dailyLimit: number;
  unlockDelaySeconds: number;
  holdSeconds: number;
  blockSuggested: boolean;
  disableAutoplay: boolean;
  xFollowingOnly: boolean;
  instagramFollowingOnly: boolean;
  youtubeSubscriptionsOnly: boolean;
  enabledSites: Record<PlatformId, boolean>;
}

export interface DailyState {
  date: string;
  revealed: number;
  revealedByPlatform: Record<PlatformId, number>;
  unlocks: number;
  unlocksByPlatform: Record<PlatformId, number>;
}

export interface DailyUsageState {
  date: string;
  dailyLimitMinutes: number;
  usedSecondsByPlatform: Record<PlatformId, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: "balanced",
  openingDelaySeconds: 5,
  sessionDurationMinutes: 10,
  dailyUsageLimitMinutes: 30,
  batchSize: 20,
  unlockBatchSize: 10,
  dailyLimit: 60,
  unlockDelaySeconds: 5,
  holdSeconds: 2,
  blockSuggested: true,
  disableAutoplay: true,
  xFollowingOnly: false,
  instagramFollowingOnly: false,
  youtubeSubscriptionsOnly: false,
  enabledSites: {
    reddit: true,
    x: true,
    instagram: true,
    youtube: true,
  },
};

const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.round(value)));

export function sanitizeSettings(input: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    mode:
      input.mode === "gentle" ||
      input.mode === "balanced" ||
      input.mode === "strict"
        ? input.mode
        : DEFAULT_SETTINGS.mode,
    openingDelaySeconds: clampInteger(
      input.openingDelaySeconds ?? DEFAULT_SETTINGS.openingDelaySeconds,
      0,
      60,
    ),
    sessionDurationMinutes: clampInteger(
      input.sessionDurationMinutes ?? DEFAULT_SETTINGS.sessionDurationMinutes,
      1,
      60,
    ),
    dailyUsageLimitMinutes: clampInteger(
      input.dailyUsageLimitMinutes ?? DEFAULT_SETTINGS.dailyUsageLimitMinutes,
      5,
      240,
    ),
    batchSize: clampInteger(
      input.batchSize ?? DEFAULT_SETTINGS.batchSize,
      5,
      100,
    ),
    unlockBatchSize: clampInteger(
      input.unlockBatchSize ?? DEFAULT_SETTINGS.unlockBatchSize,
      5,
      50,
    ),
    dailyLimit: clampInteger(
      input.dailyLimit ?? DEFAULT_SETTINGS.dailyLimit,
      10,
      500,
    ),
    unlockDelaySeconds: clampInteger(
      input.unlockDelaySeconds ?? DEFAULT_SETTINGS.unlockDelaySeconds,
      0,
      60,
    ),
    holdSeconds: clampInteger(
      input.holdSeconds ?? DEFAULT_SETTINGS.holdSeconds,
      1,
      10,
    ),
    xFollowingOnly:
      typeof input.xFollowingOnly === "boolean"
        ? input.xFollowingOnly
        : DEFAULT_SETTINGS.xFollowingOnly,
    instagramFollowingOnly:
      typeof input.instagramFollowingOnly === "boolean"
        ? input.instagramFollowingOnly
        : DEFAULT_SETTINGS.instagramFollowingOnly,
    youtubeSubscriptionsOnly:
      typeof input.youtubeSubscriptionsOnly === "boolean"
        ? input.youtubeSubscriptionsOnly
        : DEFAULT_SETTINGS.youtubeSubscriptionsOnly,
    enabledSites: {
      reddit: sanitizeBoolean(
        input.enabledSites?.reddit,
        DEFAULT_SETTINGS.enabledSites.reddit,
      ),
      x: sanitizeBoolean(
        input.enabledSites?.x,
        DEFAULT_SETTINGS.enabledSites.x,
      ),
      instagram: sanitizeBoolean(
        input.enabledSites?.instagram,
        DEFAULT_SETTINGS.enabledSites.instagram,
      ),
      youtube: sanitizeBoolean(
        input.enabledSites?.youtube,
        DEFAULT_SETTINGS.enabledSites.youtube,
      ),
    },
  };
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyDailyState(date = new Date()): DailyState {
  return {
    date: localDateKey(date),
    revealed: 0,
    revealedByPlatform: {
      reddit: 0,
      x: 0,
      instagram: 0,
      youtube: 0,
    },
    unlocks: 0,
    unlocksByPlatform: {
      reddit: 0,
      x: 0,
      instagram: 0,
      youtube: 0,
    },
  };
}

export function normalizeDailyState(
  state: Partial<DailyState> | null,
  date = new Date(),
): DailyState {
  if (state?.date !== localDateKey(date)) return emptyDailyState(date);

  const revealedByPlatform = normalizePlatformCounts(state.revealedByPlatform);
  const unlocksByPlatform = normalizePlatformCounts(state.unlocksByPlatform);
  return {
    date: state.date,
    revealed: sumPlatformCounts(revealedByPlatform),
    revealedByPlatform,
    unlocks: sumPlatformCounts(unlocksByPlatform),
    unlocksByPlatform,
  };
}

export function emptyDailyUsageState(
  date = new Date(),
  dailyLimitMinutes = 0,
): DailyUsageState {
  return {
    date: localDateKey(date),
    dailyLimitMinutes,
    usedSecondsByPlatform: {
      reddit: 0,
      x: 0,
      instagram: 0,
      youtube: 0,
    },
  };
}

export function normalizeDailyUsageState(
  state:
    | (Partial<Omit<DailyUsageState, "usedSecondsByPlatform">> & {
        usedSecondsByPlatform?: Partial<Record<PlatformId, number>>;
      })
    | null,
  date = new Date(),
  configuredLimitMinutes = DEFAULT_SETTINGS.dailyUsageLimitMinutes,
): DailyUsageState {
  if (state?.date !== localDateKey(date)) {
    return emptyDailyUsageState(date, configuredLimitMinutes);
  }

  return {
    date: state.date,
    dailyLimitMinutes:
      typeof state.dailyLimitMinutes === "number" &&
      state.dailyLimitMinutes >= 5
        ? state.dailyLimitMinutes
        : configuredLimitMinutes,
    usedSecondsByPlatform: normalizePlatformCounts(
      state.usedSecondsByPlatform,
    ),
  };
}

export function availableUsageSeconds(
  settings: Settings,
  state: DailyUsageState,
  platform: PlatformId,
): number {
  const effectiveLimitMinutes =
    state.dailyLimitMinutes >= 5
      ? state.dailyLimitMinutes
      : settings.dailyUsageLimitMinutes;
  const dailyLimitSeconds = effectiveLimitMinutes * 60;
  return Math.max(
    0,
    dailyLimitSeconds - state.usedSecondsByPlatform[platform],
  );
}

export function availableAllowance(
  settings: Settings,
  state: DailyState,
  platform: PlatformId,
): number {
  return Math.max(
    0,
    settings.dailyLimit - state.revealedByPlatform[platform],
  );
}

function normalizePlatformCounts(
  counts: Partial<Record<PlatformId, number>> | undefined,
): Record<PlatformId, number> {
  return {
    reddit: normalizeCount(counts?.reddit),
    x: normalizeCount(counts?.x),
    instagram: normalizeCount(counts?.instagram),
    youtube: normalizeCount(counts?.youtube),
  };
}

function normalizeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value ?? 0)) : 0;
}

function sumPlatformCounts(counts: Record<PlatformId, number>): number {
  return counts.reddit + counts.x + counts.instagram + counts.youtube;
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
