import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  createRuntimeMessageHandler,
  type RuntimeMessageSender,
} from "../entrypoints/background";
import type { InterventionUi } from "../lib/intervention-ui";
import {
  availableUsageSeconds,
  DEFAULT_SETTINGS,
  localDateKey,
} from "../lib/models";
import {
  dailyStateItem,
  dailyUsageStateItem,
  getDailyUsageState,
  reserveAllowance,
  settingsItem,
  usageHistoryItem,
} from "../lib/storage";
import {
  UsageSession,
  type UsageSessionEnvironment,
} from "../lib/usage-session";
import { usageForDate } from "../lib/usage-history";

class FakeTabLifecycle implements UsageSessionEnvironment {
  private visibility: DocumentVisibilityState = "visible";
  private nextInterval = 1;
  private readonly intervals = new Map<number, () => void>();
  private readonly visibilityListeners = new Set<() => void>();
  private readonly pageHideListeners = new Set<() => void>();

  getVisibilityState(): DocumentVisibilityState {
    return this.visibility;
  }

  addVisibilityListener(listener: () => void): void {
    this.visibilityListeners.add(listener);
  }

  removeVisibilityListener(listener: () => void): void {
    this.visibilityListeners.delete(listener);
  }

  addPageHideListener(listener: () => void): void {
    this.pageHideListeners.add(listener);
  }

  removePageHideListener(listener: () => void): void {
    this.pageHideListeners.delete(listener);
  }

  setInterval(callback: () => void): number {
    const id = this.nextInterval++;
    this.intervals.set(id, callback);
    return id;
  }

  clearInterval(interval: number): void {
    this.intervals.delete(interval);
  }

  advance(seconds: number): void {
    for (let second = 0; second < seconds; second += 1) {
      for (const callback of [...this.intervals.values()]) callback();
    }
  }

  setVisibility(visibility: DocumentVisibilityState): void {
    this.visibility = visibility;
    for (const listener of this.visibilityListeners) listener();
  }

  pageHide(): void {
    for (const listener of this.pageHideListeners) listener();
  }
}

const createUi = () =>
  ({
    showUsageTimer: vi.fn(),
    hideUsageTimer: vi.fn(),
  }) as unknown as InterventionUi;

const createSession = (
  lifecycle: FakeTabLifecycle,
  availableSeconds = DEFAULT_SETTINGS.dailyUsageLimitMinutes * 60,
) =>
  new UsageSession(
    {
      platform: "reddit",
      platformLabel: "Reddit",
      plannedSeconds: 60,
      availableSeconds,
      ui: createUi(),
      onPlannedTimeElapsed: vi.fn(),
      onHardLimitReached: vi.fn(),
    },
    lifecycle,
  );

describe("extension lifecycle integration", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    const handleMessage = createRuntimeMessageHandler();
    vi.spyOn(fakeBrowser.runtime, "sendMessage").mockImplementation(
      ((message: unknown) =>
        Promise.resolve(
          handleMessage(message, {} as RuntimeMessageSender),
        )) as typeof fakeBrowser.runtime.sendMessage,
    );
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      dailyUsageLimitMinutes: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks unlimited post batches and serializes time usage from two tabs", async () => {
    const [firstGrant, secondGrant] = await Promise.all([
      reserveAllowance("reddit", 40),
      reserveAllowance("reddit", 40),
    ]);
    expect(firstGrant + secondGrant).toBe(80);

    const firstTab = new FakeTabLifecycle();
    const secondTab = new FakeTabLifecycle();
    const firstSession = createSession(firstTab, 300);
    const secondSession = createSession(secondTab, 300);
    const unwatchUsage = dailyUsageStateItem.watch((state) => {
      const remaining = availableUsageSeconds(
        DEFAULT_SETTINGS,
        state,
        "reddit",
      );
      firstSession.syncAvailableSeconds(remaining);
      secondSession.syncAvailableSeconds(remaining);
    });
    firstSession.start();
    secondSession.start();

    firstTab.advance(7);
    secondTab.advance(7);
    await vi.waitFor(async () => {
      expect(
        (await dailyUsageStateItem.getValue()).usedSecondsByPlatform.reddit,
      ).toBe(10);
    });
    expect(firstSession.getAvailableSeconds()).toBe(290);
    expect(secondSession.getAvailableSeconds()).toBe(290);

    await Promise.all([firstSession.destroy(), secondSession.destroy()]);
    unwatchUsage();

    const [postState, usageState] = await Promise.all([
      dailyStateItem.getValue(),
      dailyUsageStateItem.getValue(),
    ]);
    expect(postState.revealedByPlatform.reddit).toBe(80);
    expect(usageState.usedSecondsByPlatform.reddit).toBe(14);
  });

  it("flushes pending time on teardown and restores it after a reload", async () => {
    const firstTab = new FakeTabLifecycle();
    const firstSession = createSession(firstTab, 300);
    firstSession.start();
    firstTab.advance(3);
    await firstSession.destroy();

    const storedAfterUnload = await getDailyUsageState();
    const restoredSeconds = availableUsageSeconds(
      DEFAULT_SETTINGS,
      storedAfterUnload,
      "reddit",
    );
    expect(restoredSeconds).toBe(297);

    const reloadedTab = new FakeTabLifecycle();
    const reloadedSession = createSession(reloadedTab, restoredSeconds);
    reloadedSession.start();
    reloadedTab.advance(2);
    await reloadedSession.destroy();

    expect(
      (await dailyUsageStateItem.getValue()).usedSecondsByPlatform.reddit,
    ).toBe(5);
  });

  it("pauses while hidden and persists on visibility loss and page hide", async () => {
    const tab = new FakeTabLifecycle();
    const session = createSession(tab, 300);
    session.start();
    tab.advance(2);

    tab.setVisibility("hidden");
    tab.advance(20);
    tab.setVisibility("visible");
    tab.advance(3);
    tab.pageHide();
    await session.destroy();

    expect(
      (await dailyUsageStateItem.getValue()).usedSecondsByPlatform.reddit,
    ).toBe(5);
  });

  it("rolls post and time state over at local midnight and retains history", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const beforeMidnight = new Date(2026, 7, 6, 23, 59, 59);
    vi.setSystemTime(beforeMidnight);

    const tab = new FakeTabLifecycle();
    const session = createSession(tab, 300);
    session.start();
    tab.advance(10);
    await session.destroy();
    expect(await reserveAllowance("reddit", 20)).toBe(20);

    const afterMidnight = new Date(2026, 7, 7, 0, 0, 1);
    vi.setSystemTime(afterMidnight);
    const nextTab = new FakeTabLifecycle();
    const nextSession = createSession(nextTab, 300);
    nextSession.start();
    nextTab.advance(3);
    await nextSession.destroy();
    expect(await reserveAllowance("reddit", 5)).toBe(5);

    const [postState, usageState, history] = await Promise.all([
      dailyStateItem.getValue(),
      dailyUsageStateItem.getValue(),
      usageHistoryItem.getValue(),
    ]);
    expect(postState.date).toBe(localDateKey(afterMidnight));
    expect(postState.revealedByPlatform.reddit).toBe(5);
    expect(usageState.date).toBe(localDateKey(afterMidnight));
    expect(usageState.usedSecondsByPlatform.reddit).toBe(3);
    expect(
      usageForDate(history, localDateKey(beforeMidnight)).reddit,
    ).toBe(10);
  });
});
