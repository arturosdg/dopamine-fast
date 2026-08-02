import { describe, expect, it } from "vitest";
import { sessionMinuteChoices } from "../lib/session-time";

describe("session time choices", () => {
  it("requires deliberate steps through common five-minute blocks", () => {
    expect(sessionMinuteChoices(30, 10)).toEqual([
      1, 5, 10, 15, 20, 25, 30,
    ]);
  });

  it("keeps configured and final partial choices available", () => {
    expect(sessionMinuteChoices(17, 7)).toEqual([1, 5, 7, 10, 15, 17]);
  });
});
