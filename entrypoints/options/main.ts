import "./style.css";
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type PlatformId,
  type Settings,
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

const timeControls: Record<
  PlatformId,
  { sessionDuration: HTMLInputElement; dailyUsageLimit: HTMLInputElement }
> = {
  reddit: {
    sessionDuration: requiredElement("#reddit-session-duration"),
    dailyUsageLimit: requiredElement("#reddit-daily-usage-limit"),
  },
  x: {
    sessionDuration: requiredElement("#x-session-duration"),
    dailyUsageLimit: requiredElement("#x-daily-usage-limit"),
  },
  instagram: {
    sessionDuration: requiredElement("#instagram-session-duration"),
    dailyUsageLimit: requiredElement("#instagram-daily-usage-limit"),
  },
  youtube: {
    sessionDuration: requiredElement("#youtube-session-duration"),
    dailyUsageLimit: requiredElement("#youtube-daily-usage-limit"),
  },
};

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing options element: ${selector}`);
  return element;
}

function updateOutputs(): void {
  controls.openingDelayOutput.value = `${controls.openingDelay.value}s`;
  controls.unlockDelayOutput.value = `${controls.unlockDelay.value}s`;
  controls.holdOutput.value = `${controls.holdSeconds.value}s`;
}

function render(settings: Settings): void {
  controls.enabled.checked = settings.enabled;
  controls.openingDelay.value = String(settings.openingDelaySeconds);
  for (const platform of Object.keys(timeControls) as PlatformId[]) {
    timeControls[platform].sessionDuration.value = String(
      settings.sessionDurationMinutesByPlatform[platform],
    );
    timeControls[platform].dailyUsageLimit.value = String(
      settings.dailyUsageLimitMinutesByPlatform[platform],
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
}

function readSettings(): Settings {
  return sanitizeSettings({
    enabled: controls.enabled.checked,
    openingDelaySeconds: Number(controls.openingDelay.value),
    sessionDurationMinutesByPlatform: {
      reddit: Number(timeControls.reddit.sessionDuration.value),
      x: Number(timeControls.x.sessionDuration.value),
      instagram: Number(timeControls.instagram.sessionDuration.value),
      youtube: Number(timeControls.youtube.sessionDuration.value),
    },
    dailyUsageLimitMinutesByPlatform: {
      reddit: Number(timeControls.reddit.dailyUsageLimit.value),
      x: Number(timeControls.x.dailyUsageLimit.value),
      instagram: Number(timeControls.instagram.dailyUsageLimit.value),
      youtube: Number(timeControls.youtube.dailyUsageLimit.value),
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
  });
}

[controls.openingDelay, controls.unlockDelay, controls.holdSeconds].forEach(
  (control) => control.addEventListener("input", updateOutputs),
);

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
    "Saved. Changes to today's time ceiling apply tomorrow.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
});

void getSettings().then(render);
