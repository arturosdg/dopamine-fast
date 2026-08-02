import {
  addUsageSecondsFromStorage,
  reserveAllowanceFromStorage,
  resetDailyStateFromStorage,
} from "../lib/storage";
import { isRuntimeMessage } from "../lib/runtime-messages";
import { SerialQueue } from "../lib/serial-queue";

export default defineBackground(() => {
  const mutations = new SerialQueue();

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (!isRuntimeMessage(message)) return undefined;

    switch (message.type) {
      case "dopamine-fast:reserve-allowance":
        return mutations.run(async () => ({
          granted: await reserveAllowanceFromStorage(
            message.platform,
            message.requested,
            message.isUnlock,
          ),
        }));
      case "dopamine-fast:add-usage-seconds":
        return mutations.run(async () => ({
          remainingSeconds: await addUsageSecondsFromStorage(
            message.platform,
            message.elapsedSeconds,
          ),
        }));
      case "dopamine-fast:reset-daily-state":
        return mutations.run(async () => {
          await resetDailyStateFromStorage();
          return { ok: true };
        });
      case "dopamine-fast:open-options":
        return browser.runtime.openOptionsPage().then(() => ({ ok: true }));
      case "dopamine-fast:leave-feed":
        if (sender.tab?.id === undefined) return { ok: false };
        return browser.tabs
          .update(sender.tab.id, { url: "about:blank" })
          .then(() => ({ ok: true }));
    }
  });
});
