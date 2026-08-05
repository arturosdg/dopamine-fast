# YouTube adapter notes

This document records authenticated DOM observations used by the YouTube
adapter. YouTube serves substantially different desktop and responsive/mobile
renderers, so every selector remains scoped to a named platform component.

## Verified environment

- Date: 2026-08-05
- Browser: authenticated Chrome desktop session on Windows
- Page language: Spanish
- Responsive viewport: 391 by 844 CSS pixels
- Pages: `/`, `/feed/subscriptions`, `/results?search_query={query}`, and
  `/watch?v={id}`

The verified layout used YouTube's responsive `ytm-*` renderers. The adapter
also includes narrow `ytd-*` equivalents for desktop, but a wide desktop and
Firefox Android smoke test remain required before release.

## Navigation and routes

The bottom navigation exposed `Inicio`, `Shorts`, and `Suscripciones` as exact
`[role="tab"]` labels inside `ytm-pivot-bar-item-renderer`. Subscriptions used
`aria-selected="true"` at `/feed/subscriptions`.

Short links used `/shorts/{id}`. Dopamine Fast hides the exact Shorts
navigation item and converts a directly requested Short to `/watch?v={id}`.
This preserves the requested video in YouTube's standard player without
opening the vertical Shorts feed.

## Feed items and Shorts shelves

On the responsive Home and Subscriptions feeds, regular cards used
`ytm-rich-item-renderer`. A regular subscription video nested its `/watch`
link inside `ytm-video-with-context-renderer` and `ytm-rich-item-renderer`.
Stable post identity comes from the `v` query parameter rather than visible
text.

The inspected Subscriptions route rendered:

- 8 current `ytm-rich-item-renderer` feed items;
- 15 `/shorts/{id}` links inside one `ytm-rich-section-renderer` and
  `ytm-reel-shelf-renderer`; and
- 24 current `/watch` links as YouTube continued populating the feed.

The inspected search route rendered 16 `/shorts/{id}` links inside a
`grid-shelf-view-model`. The same scoped shelf rule therefore removes Shorts
from user-requested search results without hiding regular results.

Shorts are suppressed by locating a `/shorts/` anchor and walking only to a
known Shorts shelf or item renderer. The rule never hides an arbitrary broad
parent when no known container exists.

## Watch recommendations

On the inspected watch route, comments occupied an `ytm-item-section-renderer`
whose parent was a regular `div`. Recommendation groups were separate direct
children of `ytm-single-column-watch-next-results-renderer`:

- two regular recommendation sections containing `/watch` links; and
- one Shorts recommendation section containing 15 `/shorts/` links.

Subscriptions-only mode hides only those direct recommendation sections.
The player, title, channel controls, actions and comments remain available.

## Known limitations

- Suppression is presentation-layer only; YouTube may still prefetch hidden
  recommendations or Shorts.
- Desktop `ytd-*` selectors are narrow fallbacks but were not visually verified
  in this responsive inspection.
- YouTube frequently replaces renderer families and requires signed-in mobile
  and desktop verification after selector changes.

## Manual verification checklist

1. Confirm Shorts is absent from the responsive and desktop navigation.
2. Confirm Shorts shelves are absent from Home, Subscriptions and watch pages.
3. Open a direct `/shorts/{id}` URL and confirm it becomes `/watch?v={id}`.
4. Enable Subscriptions only and open `/`; confirm navigation reaches
   `/feed/subscriptions` and Home is hidden.
5. Open a normal video and confirm recommendations and next-video surfaces are
   absent while comments and playback controls still work.
6. Start a feed session and verify the finite batch counts regular subscription
   items without counting the removed Shorts shelf.
