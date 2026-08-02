import { describe, expect, it } from "vitest";
import { SerialQueue } from "../lib/serial-queue";

describe("SerialQueue", () => {
  it("does not overlap state mutations", async () => {
    const queue = new SerialQueue();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run(async () => {
      order.push("first:start");
      await firstGate;
      order.push("first:end");
    });
    const second = queue.run(async () => {
      order.push("second:start");
      order.push("second:end");
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("continues after a failed mutation", async () => {
    const queue = new SerialQueue();
    const failed = queue.run(async () => {
      throw new Error("failed mutation");
    });
    const recovered = queue.run(async () => 42);

    await expect(failed).rejects.toThrow("failed mutation");
    await expect(recovered).resolves.toBe(42);
  });
});
