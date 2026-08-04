import { storage } from "#imports";
import {
  DEFAULT_SETTINGS,
  emptyDailyState,
  emptyDailyUsageState,
  normalizeDailyState,
  normalizeDailyUsageState,
  sanitizeSettings,
  type DailyState,
  type DailyUsageState,
  type PlatformId,
  type Settings,
} from "./models";
import type {
  AddUsageSecondsResponse,
  ReserveAllowanceResponse,
  RuntimeMessage,
} from "./runtime-messages";
import {
  emptyUsageHistory,
  normalizeUsageHistory,
  recordUsageState,
  type UsageHistory,
} from "./usage-history";

export const settingsItem = storage.defineItem<Settings>(
  "local:dopamine-fast-settings",
  {
    defaultValue: DEFAULT_SETTINGS,
  },
);

export const dailyStateItem = storage.defineItem<DailyState>(
  "local:dopamine-fast-daily-state",
  {
    defaultValue: emptyDailyState(),
  },
);

export const dailyUsageStateItem = storage.defineItem<DailyUsageState>(
  "local:dopamine-fast-daily-usage-state",
  {
    defaultValue: emptyDailyUsageState(),
  },
);

export const usageHistoryItem = storage.defineItem<UsageHistory>(
  "local:dopamine-fast-usage-history",
  {
    defaultValue: emptyUsageHistory(),
  },
);

export async function getSettings(): Promise<Settings> {
  return sanitizeSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsItem.setValue(sanitizeSettings(settings));
}

export async function reserveAllowance(
  platform: PlatformId,
  requested: number,
  isUnlock = false,
): Promise<number> {
  const response = await browser.runtime.sendMessage<
    RuntimeMessage,
    ReserveAllowanceResponse
  >({
    type: "dopamine-fast:reserve-allowance",
    platform,
    requested,
    isUnlock,
  });
  return response.granted;
}

export async function reserveAllowanceFromStorage(
  platform: PlatformId,
  requested: number,
  isUnlock = false,
): Promise<number> {
  const settings = await getSettings();
  const stored = await dailyStateItem.getValue();
  const current = normalizeDailyState(stored);
  const granted = Math.min(
    Math.max(0, requested),
    Math.max(0, settings.dailyLimit - current.revealed),
  );

  if (granted === 0) {
    if (current.date !== stored.date) {
      await dailyStateItem.setValue(current);
    }
    return 0;
  }

  await dailyStateItem.setValue({
    ...current,
    revealed: current.revealed + granted,
    revealedByPlatform: {
      ...current.revealedByPlatform,
      [platform]: current.revealedByPlatform[platform] + granted,
    },
    unlocks: current.unlocks + (isUnlock ? 1 : 0),
  });

  return granted;
}

export async function getDailyUsageState(): Promise<DailyUsageState> {
  const settings = await getSettings();
  return normalizeDailyUsageState(
    await dailyUsageStateItem.getValue(),
    new Date(),
    settings.dailyUsageLimitMinutes,
  );
}

export async function addUsageSeconds(
  platform: PlatformId,
  elapsedSeconds: number,
): Promise<number> {
  const response = await browser.runtime.sendMessage<
    RuntimeMessage,
    AddUsageSecondsResponse
  >({
    type: "dopamine-fast:add-usage-seconds",
    platform,
    elapsedSeconds,
  });
  return response.remainingSeconds;
}

export async function getUsageHistory(): Promise<UsageHistory> {
  const [storedHistory, currentUsage] = await Promise.all([
    usageHistoryItem.getValue(),
    getDailyUsageState(),
  ]);
  return recordUsageState(normalizeUsageHistory(storedHistory), currentUsage);
}

export async function addUsageSecondsFromStorage(
  platform: PlatformId,
  elapsedSeconds: number,
): Promise<number> {
  const settings = await getSettings();
  const [stored, storedHistory] = await Promise.all([
    dailyUsageStateItem.getValue(),
    usageHistoryItem.getValue(),
  ]);
  const historyWithStoredDay = recordUsageState(storedHistory, stored);
  const current = normalizeDailyUsageState(
    stored,
    new Date(),
    settings.dailyUsageLimitMinutes,
  );
  const dailyLimitSeconds = current.dailyLimitMinutes * 60;
  const increment = Math.max(0, Math.round(elapsedSeconds));
  const usedSeconds = Math.min(
    dailyLimitSeconds,
    current.usedSecondsByPlatform[platform] + increment,
  );

  const nextState: DailyUsageState = {
    ...current,
    usedSecondsByPlatform: {
      ...current.usedSecondsByPlatform,
      [platform]: usedSeconds,
    },
  };

  await dailyUsageStateItem.setValue(nextState);
  await usageHistoryItem.setValue(
    recordUsageState(historyWithStoredDay, nextState),
  );

  return Math.max(0, dailyLimitSeconds - usedSeconds);
}

export async function resetDailyState(): Promise<void> {
  await browser.runtime.sendMessage<RuntimeMessage>({
    type: "dopamine-fast:reset-daily-state",
  });
}

export async function resetDailyStateFromStorage(): Promise<void> {
  await dailyStateItem.setValue(emptyDailyState());
}
