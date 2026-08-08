import { describe, expect, it } from "vitest";
import {
  isBlockedSingleItemNavigationKey,
  matchesSingleItemNavigationControl,
} from "../lib/single-item-view";

describe("single item view", () => {
  it("blocks vertical feed navigation while preserving media controls", () => {
    expect(isBlockedSingleItemNavigationKey("ArrowDown")).toBe(true);
    expect(isBlockedSingleItemNavigationKey("PageDown")).toBe(true);
    expect(isBlockedSingleItemNavigationKey(" ")).toBe(true);
    expect(isBlockedSingleItemNavigationKey("ArrowLeft")).toBe(false);
    expect(isBlockedSingleItemNavigationKey("Enter")).toBe(false);
  });

  it("recognizes localized reel navigation without matching media controls", () => {
    const tokens = ["back", "atrás", "next", "siguiente"];

    expect(matchesSingleItemNavigationControl("Siguiente", tokens)).toBe(true);
    expect(matchesSingleItemNavigationControl(" Back ", tokens)).toBe(true);
    expect(matchesSingleItemNavigationControl("Me gusta", tokens)).toBe(false);
  });
});
