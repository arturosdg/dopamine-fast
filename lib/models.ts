export type PlatformId = "reddit" | "x" | "instagram" | "youtube";

export type PlatformMinutes = Record<PlatformId, number>;

export const WEEKDAY_IDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekdayId = (typeof WEEKDAY_IDS)[number];

export type LimitScheduleMode = "global" | "custom" | "always";

export type AccessBlockScheduleMode = "global" | "custom" | "never";

export interface WeeklyLimitSchedule {
  startTime: string;
  endTime: string;
  days: Record<WeekdayId, boolean>;
}

export interface LimitScheduleSettings {
  globalEnabled: boolean;
  global: WeeklyLimitSchedule;
  modeByPlatform: Record<PlatformId, LimitScheduleMode>;
  byPlatform: Record<PlatformId, WeeklyLimitSchedule>;
}

export interface AccessBlockScheduleSettings {
  globalEnabled: boolean;
  global: WeeklyLimitSchedule;
  modeByPlatform: Record<PlatformId, AccessBlockScheduleMode>;
  byPlatform: Record<PlatformId, WeeklyLimitSchedule>;
}

export interface Settings {
  enabled: boolean;
  openingDelaySeconds: number;
  sessionDurationMinutesByPlatform: PlatformMinutes;
  dailyUsageLimitMinutesByPlatform: PlatformMinutes;
  batchSize: number;
  unlockBatchSize: number;
  unlockDelaySeconds: number;
  holdSeconds: number;
  blockSuggested: boolean;
  disableAutoplay: boolean;
  xFollowingOnly: boolean;
  instagramFollowingOnly: boolean;
  youtubeSubscriptionsOnly: boolean;
  enabledSites: Record<PlatformId, boolean>;
  limitSchedule: LimitScheduleSettings;
  accessBlockSchedule: AccessBlockScheduleSettings;
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
  dailyLimitMinutesByPlatform: PlatformMinutes;
  usedSecondsByPlatform: Record<PlatformId, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  openingDelaySeconds: 5,
  sessionDurationMinutesByPlatform: {
    reddit: 10,
    x: 10,
    instagram: 10,
    youtube: 10,
  },
  dailyUsageLimitMinutesByPlatform: {
    reddit: 30,
    x: 30,
    instagram: 30,
    youtube: 30,
  },
  batchSize: 20,
  unlockBatchSize: 10,
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
  limitSchedule: {
    globalEnabled: false,
    global: createDefaultWeeklySchedule(),
    modeByPlatform: {
      reddit: "global",
      x: "global",
      instagram: "global",
      youtube: "global",
    },
    byPlatform: {
      reddit: createDefaultWeeklySchedule(),
      x: createDefaultWeeklySchedule(),
      instagram: createDefaultWeeklySchedule(),
      youtube: createDefaultWeeklySchedule(),
    },
  },
  accessBlockSchedule: {
    globalEnabled: false,
    global: createDefaultAccessBlockSchedule(),
    modeByPlatform: {
      reddit: "global",
      x: "global",
      instagram: "global",
      youtube: "global",
    },
    byPlatform: {
      reddit: createDefaultAccessBlockSchedule(),
      x: createDefaultAccessBlockSchedule(),
      instagram: createDefaultAccessBlockSchedule(),
      youtube: createDefaultAccessBlockSchedule(),
    },
  },
};

type WeeklyLimitScheduleInput = {
  startTime?: unknown;
  endTime?: unknown;
  days?: Partial<Record<WeekdayId, unknown>>;
};

type LimitScheduleSettingsInput = {
  globalEnabled?: unknown;
  global?: WeeklyLimitScheduleInput;
  modeByPlatform?: Partial<Record<PlatformId, unknown>>;
  byPlatform?: Partial<Record<PlatformId, WeeklyLimitScheduleInput>>;
};

type AccessBlockScheduleSettingsInput = {
  globalEnabled?: unknown;
  global?: WeeklyLimitScheduleInput;
  modeByPlatform?: Partial<Record<PlatformId, unknown>>;
  byPlatform?: Partial<Record<PlatformId, WeeklyLimitScheduleInput>>;
};

type SettingsInput = Partial<
  Omit<
    Settings,
    | "sessionDurationMinutesByPlatform"
    | "dailyUsageLimitMinutesByPlatform"
    | "limitSchedule"
    | "accessBlockSchedule"
  >
> & {
  sessionDurationMinutesByPlatform?: Partial<PlatformMinutes>;
  dailyUsageLimitMinutesByPlatform?: Partial<PlatformMinutes>;
  limitSchedule?: LimitScheduleSettingsInput;
  accessBlockSchedule?: AccessBlockScheduleSettingsInput;
  sessionDurationMinutes?: number;
  dailyUsageLimitMinutes?: number;
};

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value ?? fallback)));
}

export function sanitizeSettings(input: SettingsInput): Settings {
  const legacySessionDuration = clampInteger(
    input.sessionDurationMinutes,
    DEFAULT_SETTINGS.sessionDurationMinutesByPlatform.reddit,
    1,
    60,
  );
  const legacyDailyLimit = clampInteger(
    input.dailyUsageLimitMinutes,
    DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform.reddit,
    5,
    240,
  );

  return {
    enabled: sanitizeBoolean(input.enabled, DEFAULT_SETTINGS.enabled),
    openingDelaySeconds: clampInteger(
      input.openingDelaySeconds,
      DEFAULT_SETTINGS.openingDelaySeconds,
      0,
      60,
    ),
    sessionDurationMinutesByPlatform: sanitizePlatformMinutes(
      input.sessionDurationMinutesByPlatform,
      legacySessionDuration,
      1,
      60,
    ),
    dailyUsageLimitMinutesByPlatform: sanitizePlatformMinutes(
      input.dailyUsageLimitMinutesByPlatform,
      legacyDailyLimit,
      5,
      240,
    ),
    batchSize: clampInteger(
      input.batchSize,
      DEFAULT_SETTINGS.batchSize,
      5,
      100,
    ),
    unlockBatchSize: clampInteger(
      input.unlockBatchSize,
      DEFAULT_SETTINGS.unlockBatchSize,
      5,
      50,
    ),
    unlockDelaySeconds: clampInteger(
      input.unlockDelaySeconds,
      DEFAULT_SETTINGS.unlockDelaySeconds,
      0,
      60,
    ),
    holdSeconds: clampInteger(
      input.holdSeconds,
      DEFAULT_SETTINGS.holdSeconds,
      1,
      10,
    ),
    blockSuggested: sanitizeBoolean(
      input.blockSuggested,
      DEFAULT_SETTINGS.blockSuggested,
    ),
    disableAutoplay: sanitizeBoolean(
      input.disableAutoplay,
      DEFAULT_SETTINGS.disableAutoplay,
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
    limitSchedule: sanitizeLimitSchedule(input.limitSchedule),
    accessBlockSchedule: sanitizeAccessBlockSchedule(
      input.accessBlockSchedule,
    ),
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
  dailyLimitMinutesByPlatform: PlatformMinutes = {
    reddit: 0,
    x: 0,
    instagram: 0,
    youtube: 0,
  },
): DailyUsageState {
  return {
    date: localDateKey(date),
    dailyLimitMinutesByPlatform: { ...dailyLimitMinutesByPlatform },
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
    | (Partial<
        Omit<
          DailyUsageState,
          "dailyLimitMinutesByPlatform" | "usedSecondsByPlatform"
        >
      > & {
        dailyLimitMinutesByPlatform?: Partial<PlatformMinutes>;
        dailyLimitMinutes?: number;
        usedSecondsByPlatform?: Partial<Record<PlatformId, number>>;
      })
    | null,
  date = new Date(),
  configuredLimitMinutesByPlatform =
    DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform,
): DailyUsageState {
  if (state?.date !== localDateKey(date)) {
    return emptyDailyUsageState(date, configuredLimitMinutesByPlatform);
  }

  const legacyLimitMinutes = normalizeDailyLimit(state.dailyLimitMinutes);

  return {
    date: state.date,
    dailyLimitMinutesByPlatform: {
      reddit: resolveDailyLimit(
        state.dailyLimitMinutesByPlatform?.reddit,
        legacyLimitMinutes,
        configuredLimitMinutesByPlatform.reddit,
      ),
      x: resolveDailyLimit(
        state.dailyLimitMinutesByPlatform?.x,
        legacyLimitMinutes,
        configuredLimitMinutesByPlatform.x,
      ),
      instagram: resolveDailyLimit(
        state.dailyLimitMinutesByPlatform?.instagram,
        legacyLimitMinutes,
        configuredLimitMinutesByPlatform.instagram,
      ),
      youtube: resolveDailyLimit(
        state.dailyLimitMinutesByPlatform?.youtube,
        legacyLimitMinutes,
        configuredLimitMinutesByPlatform.youtube,
      ),
    },
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
    normalizeDailyLimit(state.dailyLimitMinutesByPlatform[platform]) ??
    settings.dailyUsageLimitMinutesByPlatform[platform];
  const dailyLimitSeconds = effectiveLimitMinutes * 60;
  return Math.max(
    0,
    dailyLimitSeconds - state.usedSecondsByPlatform[platform],
  );
}

function sanitizePlatformMinutes(
  values: Partial<PlatformMinutes> | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): PlatformMinutes {
  return {
    reddit: clampInteger(values?.reddit, fallback, minimum, maximum),
    x: clampInteger(values?.x, fallback, minimum, maximum),
    instagram: clampInteger(values?.instagram, fallback, minimum, maximum),
    youtube: clampInteger(values?.youtube, fallback, minimum, maximum),
  };
}

function createDefaultWeeklySchedule(): WeeklyLimitSchedule {
  return {
    startTime: "09:00",
    endTime: "22:00",
    days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    },
  };
}

function createDefaultAccessBlockSchedule(): WeeklyLimitSchedule {
  return {
    ...createDefaultWeeklySchedule(),
    startTime: "22:00",
    endTime: "07:00",
  };
}

function sanitizeLimitSchedule(
  input: LimitScheduleSettingsInput | undefined,
): LimitScheduleSettings {
  const fallback = DEFAULT_SETTINGS.limitSchedule;
  return {
    globalEnabled: sanitizeBoolean(
      input?.globalEnabled,
      fallback.globalEnabled,
    ),
    global: sanitizeWeeklySchedule(input?.global, fallback.global),
    modeByPlatform: {
      reddit: sanitizeScheduleMode(
        input?.modeByPlatform?.reddit,
        fallback.modeByPlatform.reddit,
      ),
      x: sanitizeScheduleMode(
        input?.modeByPlatform?.x,
        fallback.modeByPlatform.x,
      ),
      instagram: sanitizeScheduleMode(
        input?.modeByPlatform?.instagram,
        fallback.modeByPlatform.instagram,
      ),
      youtube: sanitizeScheduleMode(
        input?.modeByPlatform?.youtube,
        fallback.modeByPlatform.youtube,
      ),
    },
    byPlatform: {
      reddit: sanitizeWeeklySchedule(
        input?.byPlatform?.reddit,
        fallback.byPlatform.reddit,
      ),
      x: sanitizeWeeklySchedule(
        input?.byPlatform?.x,
        fallback.byPlatform.x,
      ),
      instagram: sanitizeWeeklySchedule(
        input?.byPlatform?.instagram,
        fallback.byPlatform.instagram,
      ),
      youtube: sanitizeWeeklySchedule(
        input?.byPlatform?.youtube,
        fallback.byPlatform.youtube,
      ),
    },
  };
}

function sanitizeAccessBlockSchedule(
  input: AccessBlockScheduleSettingsInput | undefined,
): AccessBlockScheduleSettings {
  const fallback = DEFAULT_SETTINGS.accessBlockSchedule;
  return {
    globalEnabled: sanitizeBoolean(
      input?.globalEnabled,
      fallback.globalEnabled,
    ),
    global: sanitizeWeeklySchedule(input?.global, fallback.global),
    modeByPlatform: {
      reddit: sanitizeAccessBlockScheduleMode(
        input?.modeByPlatform?.reddit,
        fallback.modeByPlatform.reddit,
      ),
      x: sanitizeAccessBlockScheduleMode(
        input?.modeByPlatform?.x,
        fallback.modeByPlatform.x,
      ),
      instagram: sanitizeAccessBlockScheduleMode(
        input?.modeByPlatform?.instagram,
        fallback.modeByPlatform.instagram,
      ),
      youtube: sanitizeAccessBlockScheduleMode(
        input?.modeByPlatform?.youtube,
        fallback.modeByPlatform.youtube,
      ),
    },
    byPlatform: {
      reddit: sanitizeWeeklySchedule(
        input?.byPlatform?.reddit,
        fallback.byPlatform.reddit,
      ),
      x: sanitizeWeeklySchedule(
        input?.byPlatform?.x,
        fallback.byPlatform.x,
      ),
      instagram: sanitizeWeeklySchedule(
        input?.byPlatform?.instagram,
        fallback.byPlatform.instagram,
      ),
      youtube: sanitizeWeeklySchedule(
        input?.byPlatform?.youtube,
        fallback.byPlatform.youtube,
      ),
    },
  };
}

function sanitizeWeeklySchedule(
  input: WeeklyLimitScheduleInput | undefined,
  fallback: WeeklyLimitSchedule,
): WeeklyLimitSchedule {
  return {
    startTime: sanitizeClockTime(input?.startTime, fallback.startTime),
    endTime: sanitizeClockTime(input?.endTime, fallback.endTime),
    days: {
      monday: sanitizeBoolean(input?.days?.monday, fallback.days.monday),
      tuesday: sanitizeBoolean(input?.days?.tuesday, fallback.days.tuesday),
      wednesday: sanitizeBoolean(
        input?.days?.wednesday,
        fallback.days.wednesday,
      ),
      thursday: sanitizeBoolean(
        input?.days?.thursday,
        fallback.days.thursday,
      ),
      friday: sanitizeBoolean(input?.days?.friday, fallback.days.friday),
      saturday: sanitizeBoolean(
        input?.days?.saturday,
        fallback.days.saturday,
      ),
      sunday: sanitizeBoolean(input?.days?.sunday, fallback.days.sunday),
    },
  };
}

function sanitizeScheduleMode(
  value: unknown,
  fallback: LimitScheduleMode,
): LimitScheduleMode {
  return value === "global" || value === "custom" || value === "always"
    ? value
    : fallback;
}

function sanitizeAccessBlockScheduleMode(
  value: unknown,
  fallback: AccessBlockScheduleMode,
): AccessBlockScheduleMode {
  return value === "global" || value === "custom" || value === "never"
    ? value
    : fallback;
}

function sanitizeClockTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function normalizeDailyLimit(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || (value ?? 0) < 5) return undefined;
  return Math.min(240, Math.round(value ?? 0));
}

function resolveDailyLimit(
  stored: number | undefined,
  legacy: number | undefined,
  configured: number,
): number {
  return (
    normalizeDailyLimit(stored) ??
    legacy ??
    normalizeDailyLimit(configured) ??
    DEFAULT_SETTINGS.dailyUsageLimitMinutesByPlatform.reddit
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
