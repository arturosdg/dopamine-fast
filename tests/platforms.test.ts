import { describe, expect, it } from "vitest";
import { getPlatformAdapter } from "../lib/platforms";

describe("platform adapters", () => {
  it("recognizes supported hosts", () => {
    expect(getPlatformAdapter("www.reddit.com")?.id).toBe("reddit");
    expect(getPlatformAdapter("x.com")?.id).toBe("x");
    expect(getPlatformAdapter("twitter.com")?.id).toBe("x");
    expect(getPlatformAdapter("www.instagram.com")?.id).toBe("instagram");
  });

  it("limits only feed routes on X and Instagram", () => {
    const x = getPlatformAdapter("x.com")!;
    const instagram = getPlatformAdapter("instagram.com")!;

    expect(x.isFeedRoute(new URL("https://x.com/home"))).toBe(true);
    expect(x.isFeedRoute(new URL("https://x.com/someone"))).toBe(false);
    expect(instagram.isFeedRoute(new URL("https://instagram.com/"))).toBe(true);
    expect(
      instagram.isFeedRoute(new URL("https://instagram.com/direct/inbox/")),
    ).toBe(false);
  });

  it("keeps Reddit comments and settings outside the limiter", () => {
    const reddit = getPlatformAdapter("reddit.com")!;

    expect(reddit.isFeedRoute(new URL("https://reddit.com/r/rss/"))).toBe(true);
    expect(
      reddit.isFeedRoute(new URL("https://reddit.com/r/rss/comments/123/post/")),
    ).toBe(false);
    expect(
      reddit.isFeedRoute(new URL("https://reddit.com/settings/privacy")),
    ).toBe(false);
  });
});
