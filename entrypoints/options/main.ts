import "./style.css";
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type GuardMode,
  type Settings,
} from "../../lib/models";
import {
  getSettings,
  resetDailyState,
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
  sessionDuration: requiredElement<HTMLInputElement>("#session-duration"),
  dailyUsageLimit: requiredElement<HTMLInputElement>("#daily-usage-limit"),
  unlockDelay: requiredElement<HTMLInputElement>("#unlock-delay"),
  unlockDelayOutput:
    requiredElement<HTMLOutputElement>("#unlock-delay-output"),
  batchSize: requiredElement<HTMLInputElement>("#batch-size"),
  unlockBatchSize:
    requiredElement<HTMLInputElement>("#unlock-batch-size"),
  dailyLimit: requiredElement<HTMLInputElement>("#daily-limit"),
  holdSeconds: requiredElement<HTMLInputElement>("#hold-seconds"),
  holdOutput: requiredElement<HTMLOutputElement>("#hold-output"),
  reddit: requiredElement<HTMLInputElement>("#site-reddit"),
  x: requiredElement<HTMLInputElement>("#site-x"),
  instagram: requiredElement<HTMLInputElement>("#site-instagram"),
  blockSuggested: requiredElement<HTMLInputElement>("#block-suggested"),
  disableAutoplay: requiredElement<HTMLInputElement>("#disable-autoplay"),
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
  controls.sessionDuration.value = String(settings.sessionDurationMinutes);
  controls.dailyUsageLimit.value = String(settings.dailyUsageLimitMinutes);
  controls.unlockDelay.value = String(settings.unlockDelaySeconds);
  controls.batchSize.value = String(settings.batchSize);
  controls.unlockBatchSize.value = String(settings.unlockBatchSize);
  controls.dailyLimit.value = String(settings.dailyLimit);
  controls.holdSeconds.value = String(settings.holdSeconds);
  controls.reddit.checked = settings.enabledSites.reddit;
  controls.x.checked = settings.enabledSites.x;
  controls.instagram.checked = settings.enabledSites.instagram;
  controls.blockSuggested.checked = settings.blockSuggested;
  controls.disableAutoplay.checked = settings.disableAutoplay;
  requiredElement<HTMLInputElement>(
    `input[name="mode"][value="${settings.mode}"]`,
  ).checked = true;
  updateOutputs();
}

function readSettings(): Settings {
  const mode =
    document.querySelector<HTMLInputElement>('input[name="mode"]:checked')
      ?.value ?? DEFAULT_SETTINGS.mode;

  return sanitizeSettings({
    enabled: controls.enabled.checked,
    mode: mode as GuardMode,
    openingDelaySeconds: Number(controls.openingDelay.value),
    sessionDurationMinutes: Number(controls.sessionDuration.value),
    dailyUsageLimitMinutes: Number(controls.dailyUsageLimit.value),
    unlockDelaySeconds: Number(controls.unlockDelay.value),
    batchSize: Number(controls.batchSize.value),
    unlockBatchSize: Number(controls.unlockBatchSize.value),
    dailyLimit: Number(controls.dailyLimit.value),
    holdSeconds: Number(controls.holdSeconds.value),
    blockSuggested: controls.blockSuggested.checked,
    disableAutoplay: controls.disableAutoplay.checked,
    enabledSites: {
      reddit: controls.reddit.checked,
      x: controls.x.checked,
      instagram: controls.instagram.checked,
    },
  });
}

[controls.openingDelay, controls.unlockDelay, controls.holdSeconds].forEach(
  (control) => control.addEventListener("input", updateOutputs),
);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings(readSettings());
  status.textContent =
    "Saved. If you already used a network today, its new ceiling applies tomorrow.";
  window.setTimeout(() => {
    status.textContent = "";
  }, 2400);
});

requiredElement<HTMLButtonElement>("#reset-day").addEventListener(
  "click",
  async () => {
    await resetDailyState();
    status.textContent = "Today's post count has been reset.";
  },
);

void getSettings().then(render);
