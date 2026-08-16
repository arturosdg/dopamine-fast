import { storage } from "#imports";
import {
  addUsageSecondsFromStorage,
  reserveAllowanceFromStorage,
} from "../lib/storage";
import {
  isRuntimeMessage,
  type ActiveSessionSnapshot,
} from "../lib/runtime-messages";
import { SerialQueue } from "../lib/serial-queue";

export type RuntimeMessageSender = Parameters<
  Parameters<typeof browser.runtime.onMessage.addListener>[0]
>[1];

const activeSessionKey = (
  tabId: number,
  platform: ActiveSessionSnapshot["platform"],
): `session:${string}` =>
  `session:dopamine-fast-active-session-${tabId}-${platform}`;

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
      case "dopamine-fast:set-active-session": {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return { ok: false };
        return mutations.run(async () => {
          await storage.setItem(
            activeSessionKey(tabId, message.session.platform),
            message.session,
          );
          return { ok: true };
        });
      }
      case "dopamine-fast:get-active-session": {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return { session: null };
        return mutations.run(async () => ({
          session: await storage.getItem<ActiveSessionSnapshot>(
            activeSessionKey(tabId, message.platform),
          ),
        }));
      }
      case "dopamine-fast:clear-active-session": {
        const tabId = sender.tab?.id;
        if (tabId === undefined) return { ok: false };
        return mutations.run(async () => {
          await storage.removeItem(activeSessionKey(tabId, message.platform));
          return { ok: true };
        });
      }
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
  browser.tabs.onRemoved.addListener((tabId) => {
    void Promise.all(
      (["reddit", "x", "instagram", "youtube"] as const).map((platform) =>
        storage.removeItem(activeSessionKey(tabId, platform)),
      ),
    );
  });
});
