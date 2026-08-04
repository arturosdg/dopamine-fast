import type { PlatformId } from "./models";

export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  postSelectors: string[];
  suggestedSelectors: string[];
  suggestedTokens: string[];
  preferredFeed?: {
    tabSelector: string;
    preferredTokens: string[];
    hiddenTokens: string[];
  };
  intentionalSearch?: {
    inputSelectors: string[];
    suggestionSelectors: string[];
    alwaysHideNavigation?: boolean;
    shadowHostSelectors?: string[];
    shadowInputSelectors?: string[];
    shadowSuggestionSelectors?: string[];
    navigationShadowHostSelectors?: string[];
    shadowNavigationSelectors?: string[];
    routeRules?: Array<{
      paths: string[];
      selectors: string[];
    }>;
    navigationSelectors?: string[];
  };
  singleItemView?: {
    isRoute(url: URL): boolean;
    itemSelector: string;
    itemRootSelector: string;
    navigationSelectors: string[];
  };
  getPostKey(element: HTMLElement): string | undefined;
  isFeedRoute(url: URL): boolean;
}

const reddit: PlatformAdapter = {
  id: "reddit",
  label: "Reddit",
  postSelectors: [
    "shreddit-post",
    '[data-testid="post-unit"]',
    '[data-testid="post-container"]',
    'article[data-testid="post"]',
  ],
  suggestedSelectors: [
    'shreddit-post[promoted="true"]',
    'shreddit-post[is-promoted="true"]',
    '[data-testid="recommended-post"]',
    'faceplate-tracker[noun="recommendation"]',
  ],
  suggestedTokens: [
    "promoted",
    "promocionado",
    "because you visited",
    "porque visitaste",
    "recommended for you",
    "recomendado para ti",
  ],
  intentionalSearch: {
    inputSelectors: [
      "reddit-search-large input",
      'header input[name="q"]',
      'header input[type="search"]',
    ],
    suggestionSelectors: [
      'reddit-search-large [role="menu"]',
      "reddit-search-large ul",
      'reddit-search-large [role="listbox"]',
      'reddit-search-large [role="option"]',
      '[data-testid="search-suggestions"]',
      '[id*="search-suggestion"]',
    ],
    shadowHostSelectors: ["reddit-search-large", "faceplate-search-input"],
    shadowInputSelectors: ["input"],
    shadowSuggestionSelectors: [
      '[role="menu"]',
      "ul",
      '[role="listbox"]',
      '[role="option"]',
      '[id*="search-suggestion"]',
    ],
    navigationSelectors: [
      'reddit-sidebar-nav a[href*="/r/popular"]',
      'reddit-sidebar-nav a[href*="/r/news"]',
      'reddit-sidebar-nav a[href*="/explore"]',
      'nav a[href*="/r/popular"]',
      'nav a[href*="/r/news"]',
      'nav a[href*="/explore"]',
      '[role="navigation"] a[href*="/r/popular"]',
      '[role="navigation"] a[href*="/r/news"]',
      '[role="navigation"] a[href*="/explore"]',
    ],
    navigationShadowHostSelectors: ["reddit-sidebar-nav"],
    shadowNavigationSelectors: [
      'a[href*="/r/popular"]',
      'a[href*="/r/news"]',
      'a[href*="/explore"]',
      'nav [href*="/r/popular"]',
      'nav [href*="/r/news"]',
      'nav [href*="/explore"]',
    ],
  },
  getPostKey(element) {
    return (
      element.id ||
      element.getAttribute("thingid") ||
      element.querySelector<HTMLElement>("shreddit-post[id]")?.id ||
      undefined
    );
  },
  isFeedRoute(url) {
    return (
      !url.pathname.includes("/comments/") &&
      !url.pathname.startsWith("/message/") &&
      !url.pathname.startsWith("/settings/")
    );
  },
};

const x: PlatformAdapter = {
  id: "x",
  label: "X",
  postSelectors: ['article[data-testid="tweet"]'],
  suggestedSelectors: [
    '[data-testid="trend"]',
    '[aria-label*="Timeline: Trending"]',
    '[aria-label*="Cronología: Tendencias"]',
    'aside[aria-label*="Relevant people"]',
  ],
  suggestedTokens: [
    "promoted",
    "promocionado",
    "discover more",
    "descubre más",
    "who to follow",
    "a quién seguir",
  ],
  preferredFeed: {
    tabSelector: 'main [role="tablist"] [role="tab"]',
    preferredTokens: ["following", "siguiendo"],
    hiddenTokens: ["for you", "para ti"],
  },
  intentionalSearch: {
    inputSelectors: ['input[data-testid="SearchBox_Search_Input"]'],
    suggestionSelectors: ['[data-testid="typeaheadDropdown"]'],
    routeRules: [
      {
        paths: ["/explore"],
        selectors: [
          '[data-testid="primaryColumn"] [role="tablist"]',
          '[data-testid="primaryColumn"] [role="region"]',
          '[data-testid="primaryColumn"] [role="status"]',
          '[data-testid="sidebarColumn"]',
        ],
      },
      {
        paths: ["/search"],
        selectors: [
          '[data-testid="primaryColumn"] [role="tablist"]',
          '[data-testid="sidebarColumn"]',
        ],
      },
    ],
  },
  getPostKey(element) {
    const href = element
      .querySelector<HTMLAnchorElement>('a[href*="/status/"]')
      ?.getAttribute("href");
    const match = href?.match(/\/status\/(\d+)/);
    return match?.[1] ? `status:${match[1]}` : undefined;
  },
  isFeedRoute(url) {
    return url.pathname === "/home" || url.pathname.startsWith("/i/lists/");
  },
};

const instagram: PlatformAdapter = {
  id: "instagram",
  label: "Instagram",
  postSelectors: ["main article"],
  suggestedSelectors: [
    'nav a[href^="/explore/"]',
    'nav a[href^="/reels/"]',
    'main a[href^="/explore/people/"]',
  ],
  suggestedTokens: [
    "suggested for you",
    "sugerencias para ti",
    "suggested post",
    "publicación sugerida",
    "sponsored",
    "patrocinado",
  ],
  preferredFeed: {
    tabSelector: 'main [role="tablist"] [role="tab"]',
    preferredTokens: ["following", "siguiendo"],
    hiddenTokens: ["for you", "para ti"],
  },
  intentionalSearch: {
    inputSelectors: [],
    suggestionSelectors: [],
    alwaysHideNavigation: true,
    navigationSelectors: [
      'a[href="/reels/"]',
      'nav a[href^="/reels/"]',
      '[role="navigation"] a[href^="/reels/"]',
    ],
  },
  singleItemView: {
    isRoute(url) {
      return (
        url.pathname === "/reels/" ||
        /^\/reels?\/[^/]+\/?$/.test(url.pathname)
      );
    },
    itemSelector: 'main [role="group"][aria-label="Video player"]',
    itemRootSelector: '[style*="--x-height"]',
    navigationSelectors: ['main [role="toolbar"]'],
  },
  getPostKey(element) {
    const href = element
      .querySelector<HTMLAnchorElement>(
        'a[href^="/p/"], a[href^="/reel/"], a[href^="/reels/"]',
      )
      ?.getAttribute("href");
    const match = href?.match(/^\/(p|reels?)\/([^/]+)/);
    const type = match?.[1] === "reels" ? "reel" : match?.[1];
    return match?.[1] && match[2]
      ? `${type}:${match[2]}`
      : undefined;
  },
  isFeedRoute(url) {
    return url.pathname === "/";
  },
};

const adapters = [reddit, x, instagram];

export function getPlatformAdapter(
  hostname: string,
): PlatformAdapter | undefined {
  const normalized = hostname.replace(/^www\./, "").toLowerCase();
  if (normalized === "reddit.com") return reddit;
  if (normalized === "x.com" || normalized === "twitter.com") return x;
  if (normalized === "instagram.com") return instagram;
  return undefined;
}

export function collectPosts(adapter: PlatformAdapter): HTMLElement[] {
  const candidates = adapter.postSelectors.flatMap((selector) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)),
  );

  return [...new Set(candidates)].filter(
    (candidate) =>
      !candidates.some(
        (other) => other !== candidate && other.contains(candidate),
      ),
  );
}

export function hasSuggestedMarker(
  element: HTMLElement,
  adapter: PlatformAdapter,
): boolean {
  if (
    adapter.suggestedSelectors.some(
      (selector) => element.matches(selector) || element.querySelector(selector),
    )
  ) {
    return true;
  }

  const marker =
    element.querySelector<HTMLElement>(
      '[aria-label], [data-testid="socialContext"], header',
    ) ?? element;
  const text = (marker.getAttribute("aria-label") ?? marker.textContent ?? "")
    .slice(0, 320)
    .toLocaleLowerCase();

  return adapter.suggestedTokens.some((token) => text.includes(token));
}
