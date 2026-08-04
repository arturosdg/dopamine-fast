import { describe, expect, it } from "vitest";
import { isBlockedSingleItemNavigationKey } from "../lib/single-item-view";

describe("single item view", () => {
  it("blocks vertical feed navigation while preserving media controls", () => {
    expect(isBlockedSingleItemNavigationKey("ArrowDown")).toBe(true);
    expect(isBlockedSingleItemNavigationKey("PageDown")).toBe(true);
    expect(isBlockedSingleItemNavigationKey(" ")).toBe(true);
    expect(isBlockedSingleItemNavigationKey("ArrowLeft")).toBe(false);
    expect(isBlockedSingleItemNavigationKey("Enter")).toBe(false);
  });
});
