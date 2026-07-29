import type { PlatformId } from "./models";

export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  postSelectors: string[];
  suggestedSelectors: string[];
  suggestedTokens: string[];
  isFeedRoute(url: URL): boolean;
}

const reddit: PlatformAdapter = {
  id: "reddit",
  label: "Reddit",
  postSelectors: [
    "shreddit-post",
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
