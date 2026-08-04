import { describe, expect, it } from "vitest";
import { planFeedVisibility } from "../lib/feed-boundary";

describe("finite feed boundary", () => {
  it("reveals new posts until the allowance is filled", () => {
    expect(
      planFeedVisibility(["a", "b", "c"], new Set<string>(), 2),
    ).toEqual({
      visible: [true, true, false],
      newlyRevealedKeys: ["a", "b"],
    });
  });

  it("keeps a contiguous boundary when virtualized posts are reordered", () => {
    expect(
      planFeedVisibility(
        ["revealed-a", "new-blocked", "revealed-b"],
        new Set(["revealed-a", "revealed-b"]),
        2,
      ).visible,
    ).toEqual([true, false, false]);
  });
});
