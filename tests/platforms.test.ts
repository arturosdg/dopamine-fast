import { describe, expect, it } from "vitest";
import { getPlatformAdapter } from "../lib/platforms";

describe("platform adapters", () => {
  it("recognizes supported hosts", () => {
    expect(getPlatformAdapter("www.reddit.com")?.id).toBe("reddit");
    expect(getPlatformAdapter("x.com")?.id).toBe("x");
    expect(getPlatformAdapter("twitter.com")?.id).toBe("x");
    expect(getPlatformAdapter("www.instagram.com")?.id).toBe("instagram");
    expect(getPlatformAdapter("www.youtube.com")?.id).toBe("youtube");
    expect(getPlatformAdapter("m.youtube.com")?.id).toBe("youtube");
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

  it("recognizes Instagram reel routes as single-item views", () => {
    const instagram = getPlatformAdapter("instagram.com")!;

    expect(
      instagram.singleItemView?.isRoute(
        new URL("https://instagram.com/reel/ABC123/"),
      ),
    ).toBe(true);
    expect(
      instagram.singleItemView?.isRoute(
        new URL("https://instagram.com/reels/ABC123/"),
      ),
    ).toBe(true);
    expect(
      instagram.singleItemView?.isRoute(
        new URL("https://instagram.com/reels/"),
      ),
    ).toBe(true);
    expect(
      instagram.singleItemView?.isRoute(
        new URL("https://instagram.com/direct/inbox/"),
      ),
    ).toBe(false);
  });

  it("hides Instagram's generic Reels navigation destination", () => {
    const instagram = getPlatformAdapter("instagram.com")!;

    expect(instagram.intentionalSearch?.navigationSelectors).toContain(
      'a[href="/reels/"]',
    );
    expect(instagram.intentionalSearch?.alwaysHideNavigation).toBe(true);
    expect(instagram.singleItemView?.navigationSelectors).toContain(
      'main [role="toolbar"]',
    );
  });

  it("limits YouTube feeds but leaves requested videos outside the limiter", () => {
    const youtube = getPlatformAdapter("youtube.com")!;

    expect(youtube.isFeedRoute(new URL("https://youtube.com/"))).toBe(true);
    expect(
      youtube.isFeedRoute(
        new URL("https://youtube.com/feed/subscriptions"),
      ),
    ).toBe(true);
    expect(
      youtube.isFeedRoute(new URL("https://youtube.com/watch?v=example")),
    ).toBe(false);
    expect(
      youtube.isFeedRoute(new URL("https://youtube.com/results?search_query=x")),
    ).toBe(false);
  });

  it("converts a requested YouTube Short into the standard player", () => {
    const youtube = getPlatformAdapter("youtube.com")!;
    const canonical = youtube.surfaceSuppression?.canonicalUrl(
      new URL("https://youtube.com/shorts/ABC_123"),
    );

    expect(canonical?.href).toBe("https://youtube.com/watch?v=ABC_123");
    expect(
      youtube.surfaceSuppression?.canonicalUrl(
        new URL("https://youtube.com/watch?v=ABC_123"),
      ),
    ).toBeUndefined();
  });

  it("scopes YouTube Shorts and watch recommendations to platform containers", () => {
    const youtube = getPlatformAdapter("youtube.com")!;
    const config = youtube.surfaceSuppression!;

    expect(config.subscriptionsPath).toBe("/feed/subscriptions");
    expect(config.always.some((rule) => rule.selector.includes('/shorts/'))).toBe(
      true,
    );
    expect(
      config.subscriptionsOnly.some((rule) =>
        rule.selector.includes("ytm-single-column-watch-next-results-renderer"),
      ),
    ).toBe(true);
  });

  it("defines Instagram's Following feed tabs narrowly", () => {
    const instagram = getPlatformAdapter("instagram.com")!;

    expect(instagram.preferredFeed).toEqual({
      tabSelector: 'main [role="tablist"] [role="tab"]',
      preferredTokens: ["following", "siguiendo"],
      hiddenTokens: ["for you", "para ti"],
    });
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
