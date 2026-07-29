export type PlatformId = "reddit" | "x" | "instagram";
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
  enabledSites: Record<PlatformId, boolean>;
}

export interface DailyState {
  date: string;
  revealed: number;
  revealedByPlatform: Record<PlatformId, number>;
  unlocks: number;
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
  enabledSites: {
    reddit: true,
    x: true,
    instagram: true,
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
    enabledSites: {
      ...DEFAULT_SETTINGS.enabledSites,
      ...input.enabledSites,
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
    },
    unlocks: 0,
  };
}

export function normalizeDailyState(
  state: DailyState | null,
  date = new Date(),
): DailyState {
  return state?.date === localDateKey(date) ? state : emptyDailyState(date);
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
    },
  };
}

export function normalizeDailyUsageState(
  state: DailyUsageState | null,
  date = new Date(),
  configuredLimitMinutes = DEFAULT_SETTINGS.dailyUsageLimitMinutes,
): DailyUsageState {
  if (state?.date !== localDateKey(date)) {
    return emptyDailyUsageState(date, configuredLimitMinutes);
  }

  if (state.dailyLimitMinutes >= 5) return state;
  return {
    ...state,
    dailyLimitMinutes: configuredLimitMinutes,
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
): number {
  return Math.max(0, settings.dailyLimit - state.revealed);
}
