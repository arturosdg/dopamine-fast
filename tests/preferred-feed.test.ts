import { describe, expect, it } from "vitest";
import { matchesFeedTab } from "../lib/preferred-feed";

describe("preferred feed tabs", () => {
  const followingTokens = ["following", "siguiendo"];

  it("recognizes supported X tab labels", () => {
    expect(matchesFeedTab(" Following ", followingTokens)).toBe(true);
    expect(matchesFeedTab("Siguiendo", followingTokens)).toBe(true);
  });

  it("does not match unrelated or partial labels", () => {
    expect(matchesFeedTab("Followers", followingTokens)).toBe(false);
    expect(matchesFeedTab("Following topics", followingTokens)).toBe(false);
  });
});
