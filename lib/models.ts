export type PlatformId = "reddit" | "x" | "instagram";
export type GuardMode = "gentle" | "balanced" | "strict";

export interface Settings {
  enabled: boolean;
  mode: GuardMode;
  openingDelaySeconds: number;
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

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  mode: "balanced",
  openingDelaySeconds: 5,
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

export function availableAllowance(
  settings: Settings,
  state: DailyState,
): number {
  return Math.max(0, settings.dailyLimit - state.revealed);
}
