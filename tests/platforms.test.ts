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

  it("includes the current narrow Reddit post-unit fallback", () => {
    const reddit = getPlatformAdapter("reddit.com")!;

    expect(reddit.postSelectors).toContain('[data-testid="post-unit"]');
  });

  it("uses Reddit's stable post id across virtualized DOM replacements", () => {
    const reddit = getPlatformAdapter("reddit.com")!;
    const post = {
      id: "t3_example",
      getAttribute: () => null,
      querySelector: () => null,
    } as unknown as HTMLElement;

    expect(reddit.getPostKey(post)).toBe("t3_example");
  });

  it("defines deliberate search surfaces without broad page selectors", () => {
    const reddit = getPlatformAdapter("reddit.com")!;
    const x = getPlatformAdapter("x.com")!;

    expect(reddit.intentionalSearch?.suggestionSelectors).toContain(
      'reddit-search-large [role="listbox"]',
    );
    expect(reddit.intentionalSearch?.navigationSelectors).toContain(
      'reddit-sidebar-nav a[href*="/r/popular"]',
    );
    expect(reddit.intentionalSearch?.navigationSelectors).toContain(
      'nav a[href*="/r/news"]',
    );
    expect(x.intentionalSearch?.routeRules?.[0]?.selectors).toContain(
      '[data-testid="primaryColumn"] [role="tablist"]',
    );
  });
});
