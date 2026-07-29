import { storage } from "#imports";
import {
  DEFAULT_SETTINGS,
  emptyDailyState,
  normalizeDailyState,
  sanitizeSettings,
  type DailyState,
  type PlatformId,
  type Settings,
} from "./models";

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

export async function resetDailyState(): Promise<void> {
  await dailyStateItem.setValue(emptyDailyState());
}
