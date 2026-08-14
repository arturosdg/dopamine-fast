import "./style.css";
import {
  sanitizeSettings,
  type LimitScheduleMode,
  type PlatformId,
  type Settings,
  type WeekdayId,
  type WeeklyLimitSchedule,
} from "../../lib/models";
import {
  getSettings,
  saveSettings,
} from "../../lib/storage";

const form = requiredElement<HTMLFormElement>("#settings-form");
const status = requiredElement<HTMLElement>("#save-status");

const controls = {
  enabled: requiredElement<HTMLInputElement>("#enabled"),
  openingDelay: requiredElement<HTMLInputElement>("#opening-delay"),
  openingDelayOutput: requiredElement<HTMLOutputElement>(
    "#opening-delay-output",
  ),
  globalScheduleEnabled: requiredElement<HTMLInputElement>(
    "#global-schedule-enabled",
  ),
  globalScheduleFields: requiredElement<HTMLElement>(
    "#global-schedule-fields",
  ),
  unlockDelay: requiredElement<HTMLInputElement>("#unlock-delay"),
  unlockDelayOutput:
    requiredElement<HTMLOutputElement>("#unlock-delay-output"),
  batchSize: requiredElement<HTMLInputElement>("#batch-size"),
  unlockBatchSize:
    requiredElement<HTMLInputElement>("#unlock-batch-size"),
  holdSeconds: requiredElement<HTMLInputElement>("#hold-seconds"),
  holdOutput: requiredElement<HTMLOutputElement>("#hold-output"),
  reddit: requiredElement<HTMLInputElement>("#site-reddit"),
  x: requiredElement<HTMLInputElement>("#site-x"),
  xFollowingOnly: requiredElement<HTMLInputElement>("#x-following-only"),
  instagram: requiredElement<HTMLInputElement>("#site-instagram"),
  instagramFollowingOnly: requiredElement<HTMLInputElement>(
    "#instagram-following-only",
  ),
  youtube: requiredElement<HTMLInputElement>("#site-youtube"),
  youtubeSubscriptionsOnly: requiredElement<HTMLInputElement>(
    "#youtube-subscriptions-only",
  ),
  blockSuggested: requiredElement<HTMLInputElement>("#block-suggested"),
  disableAutoplay: requiredElement<HTMLInputElement>("#disable-autoplay"),
};

interface ScheduleControls {
  start: HTMLInputElement;
  end: HTMLInputElement;
  fields: HTMLElement;
  days: Record<WeekdayId, HTMLInputElement>;
}

interface NetworkControls {
  sessionDuration: HTMLInputElement;
  dailyUsageLimit: HTMLInputElement;
  scheduleMode: HTMLSelectElement;
  schedule: ScheduleControls;
}

const globalScheduleControls: ScheduleControls = createScheduleControls(
  "global",
  controls.globalScheduleFields,
);

const networkControls: Record<
  PlatformId,
  NetworkControls
> = {
  reddit: {
    sessionDuration: requiredElement("#reddit-session-duration"),
    dailyUsageLimit: requiredElement("#reddit-daily-usage-limit"),
    scheduleMode: requiredElement("#reddit-schedule-mode"),
    schedule: createScheduleControls("reddit"),
  },
  x: {
    sessionDuration: requiredElement("#x-session-duration"),
    dailyUsageLimit: requiredElement("#x-daily-usage-limit"),
    scheduleMode: requiredElement("#x-schedule-mode"),
    schedule: createScheduleControls("x"),
  },
  instagram: {
    sessionDuration: requiredElement("#instagram-session-duration"),
    dailyUsageLimit: requiredElement("#instagram-daily-usage-limit"),
    scheduleMode: requiredElement("#instagram-schedule-mode"),
    schedule: createScheduleControls("instagram"),
  },
  youtube: {
    sessionDuration: requiredElement("#youtube-session-duration"),
    dailyUsageLimit: requiredElement("#youtube-daily-usage-limit"),
    scheduleMode: requiredElement("#youtube-schedule-mode"),
    schedule: createScheduleControls("youtube"),
  },
};

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing options element: ${selector}`);
  return element;
}

function createScheduleControls(
  scope: "global" | PlatformId,
  fields = requiredElement<HTMLElement>(`#${scope}-schedule-fields`),
): ScheduleControls {
  const day = (weekday: WeekdayId) =>
    requiredElement<HTMLInputElement>(
      `[data-schedule-day="${scope}"][value="${weekday}"]`,
    );
  return {
    start: requiredElement(`#${scope}-schedule-start`),
    end: requiredElement(`#${scope}-schedule-end`),
    fields,
    days: {
      monday: day("monday"),
      tuesday: day("tuesday"),
      wednesday: day("wednesday"),
      thursday: day("thursday"),
      friday: day("friday"),
      saturday: day("saturday"),
      sunday: day("sunday"),
    },
  };
}

function updateOutputs(): void {
  controls.openingDelayOutput.value = `${controls.openingDelay.value}s`;
  controls.unlockDelayOutput.value = `${controls.unlockDelay.value}s`;
  controls.holdOutput.value = `${controls.holdSeconds.value}s`;
}

function render(settings: Settings): void {
  controls.enabled.checked = settings.enabled;
  controls.openingDelay.value = String(settings.openingDelaySeconds);
  controls.globalScheduleEnabled.checked =
    settings.limitSchedule.globalEnabled;
  renderSchedule(globalScheduleControls, settings.limitSchedule.global);
  for (const platform of Object.keys(networkControls) as PlatformId[]) {
    networkControls[platform].sessionDuration.value = String(
      settings.sessionDurationMinutesByPlatform[platform],
    );
    networkControls[platform].dailyUsageLimit.value = String(
      settings.dailyUsageLimitMinutesByPlatform[platform],
    );
    networkControls[platform].scheduleMode.value =
      settings.limitSchedule.modeByPlatform[platform];
    renderSchedule(
      networkControls[platform].schedule,
      settings.limitSchedule.byPlatform[platform],
    );
  }
  controls.unlockDelay.value = String(settings.unlockDelaySeconds);
  controls.batchSize.value = String(settings.batchSize);
  controls.unlockBatchSize.value = String(settings.unlockBatchSize);
  controls.holdSeconds.value = String(settings.holdSeconds);
  controls.reddit.checked = settings.enabledSites.reddit;
  controls.x.checked = settings.enabledSites.x;
  controls.xFollowingOnly.checked = settings.xFollowingOnly;
  controls.instagram.checked = settings.enabledSites.instagram;
  controls.instagramFollowingOnly.checked = settings.instagramFollowingOnly;
  controls.youtube.checked = settings.enabledSites.youtube;
  controls.youtubeSubscriptionsOnly.checked = settings.youtubeSubscriptionsOnly;
  controls.blockSuggested.checked = settings.blockSuggested;
  controls.disableAutoplay.checked = settings.disableAutoplay;
  updateOutputs();
  updateScheduleVisibility();
}

function renderSchedule(
  scheduleControls: ScheduleControls,
  schedule: WeeklyLimitSchedule,
): void {
  scheduleControls.start.value = schedule.startTime;
  scheduleControls.end.value = schedule.endTime;
  for (const weekday of Object.keys(scheduleControls.days) as WeekdayId[]) {
    scheduleControls.days[weekday].checked = schedule.days[weekday];
  }
}

function readSchedule(scheduleControls: ScheduleControls): WeeklyLimitSchedule {
  return {
    startTime: scheduleControls.start.value,
    endTime: scheduleControls.end.value,
    days: {
      monday: scheduleControls.days.monday.checked,
      tuesday: scheduleControls.days.tuesday.checked,
      wednesday: scheduleControls.days.wednesday.checked,
      thursday: scheduleControls.days.thursday.checked,
      friday: scheduleControls.days.friday.checked,
      saturday: scheduleControls.days.saturday.checked,
      sunday: scheduleControls.days.sunday.checked,
    },
  };
}

function updateScheduleVisibility(): void {
  controls.globalScheduleFields.hidden =
    !controls.globalScheduleEnabled.checked;
  for (const platform of Object.keys(networkControls) as PlatformId[]) {
    networkControls[platform].schedule.fields.hidden =
      networkControls[platform].scheduleMode.value !== "custom";
  }
}

function readSettings(): Settings {
  return sanitizeSettings({
    enabled: controls.enabled.checked,
    openingDelaySeconds: Number(controls.openingDelay.value),
    sessionDurationMinutesByPlatform: {
      reddit: Number(networkControls.reddit.sessionDuration.value),
      x: Number(networkControls.x.sessionDuration.value),
      instagram: Number(networkControls.instagram.sessionDuration.value),
      youtube: Number(networkControls.youtube.sessionDuration.value),
    },
    dailyUsageLimitMinutesByPlatform: {
      reddit: Number(networkControls.reddit.dailyUsageLimit.value),
      x: Number(networkControls.x.dailyUsageLimit.value),
      instagram: Number(networkControls.instagram.dailyUsageLimit.value),
      youtube: Number(networkControls.youtube.dailyUsageLimit.value),
    },
    unlockDelaySeconds: Number(controls.unlockDelay.value),
    batchSize: Number(controls.batchSize.value),
    unlockBatchSize: Number(controls.unlockBatchSize.value),
    holdSeconds: Number(controls.holdSeconds.value),
    blockSuggested: controls.blockSuggested.checked,
    disableAutoplay: controls.disableAutoplay.checked,
    xFollowingOnly: controls.xFollowingOnly.checked,
    instagramFollowingOnly: controls.instagramFollowingOnly.checked,
    youtubeSubscriptionsOnly: controls.youtubeSubscriptionsOnly.checked,
    enabledSites: {
      reddit: controls.reddit.checked,
      x: controls.x.checked,
      instagram: controls.instagram.checked,
      youtube: controls.youtube.checked,
    },
    limitSchedule: {
      globalEnabled: controls.globalScheduleEnabled.checked,
      global: readSchedule(globalScheduleControls),
      modeByPlatform: {
        reddit: networkControls.reddit.scheduleMode.value as LimitScheduleMode,
        x: networkControls.x.scheduleMode.value as LimitScheduleMode,
        instagram: networkControls.instagram.scheduleMode
          .value as LimitScheduleMode,
        youtube: networkControls.youtube.scheduleMode
          .value as LimitScheduleMode,
      },
      byPlatform: {
        reddit: readSchedule(networkControls.reddit.schedule),
        x: readSchedule(networkControls.x.schedule),
        instagram: readSchedule(networkControls.instagram.schedule),
        youtube: readSchedule(networkControls.youtube.schedule),
      },
    },
  });
}

[controls.openingDelay, controls.unlockDelay, controls.holdSeconds].forEach(
  (control) => control.addEventListener("input", updateOutputs),
);

controls.globalScheduleEnabled.addEventListener(
  "change",
  updateScheduleVisibility,
);
for (const platform of Object.keys(networkControls) as PlatformId[]) {
  networkControls[platform].scheduleMode.addEventListener(
    "change",
    updateScheduleVisibility,
  );
}

controls.xFollowingOnly.addEventListener("change", async () => {
  await saveSettings(readSettings());
  status.textContent = "X feed preference applied.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
});

controls.instagramFollowingOnly.addEventListener("change", async () => {
  await saveSettings(readSettings());
  status.textContent = "Instagram feed preference applied.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
});

controls.youtubeSubscriptionsOnly.addEventListener("change", async () => {
  await saveSettings(readSettings());
  status.textContent = "YouTube feed preference applied.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings(readSettings());
  status.textContent =
    "Saved. Schedules apply now; changes to today's time ceiling apply tomorrow.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
});

void getSettings().then(render);
