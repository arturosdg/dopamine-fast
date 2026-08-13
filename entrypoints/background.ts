import {
  addUsageSecondsFromStorage,
  reserveAllowanceFromStorage,
} from "../lib/storage";
import { isRuntimeMessage } from "../lib/runtime-messages";
import { SerialQueue } from "../lib/serial-queue";

export type RuntimeMessageSender = Parameters<
  Parameters<typeof browser.runtime.onMessage.addListener>[0]
>[1];

export function createRuntimeMessageHandler() {
  const mutations = new SerialQueue();

  return (message: unknown, sender: RuntimeMessageSender) => {
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
      case "dopamine-fast:open-options":
        return browser.runtime.openOptionsPage().then(() => ({ ok: true }));
      case "dopamine-fast:leave-feed":
        if (sender.tab?.id === undefined) return { ok: false };
        return browser.tabs
          .update(sender.tab.id, { url: "about:blank" })
          .then(() => ({ ok: true }));
    }
  };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(createRuntimeMessageHandler());
});
