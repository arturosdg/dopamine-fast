# Instagram adapter notes

This document records authenticated DOM observations used by the Instagram
adapter. Selectors here are deliberately scoped to the relevant route because
Instagram's structure changes frequently.

## Verified environment

- Date: 2026-08-04
- Browser: authenticated Chrome desktop session on Windows
- Page language: Spanish
- Pages: `https://www.instagram.com/` and an observed `/reels/{id}/` link
- Observed viewport: 1175 by 827 CSS pixels

Firefox MV2 and Chromium MV3 production builds were validated, but the signed-in
selector inspection used Chrome. Mobile Instagram remains a manual testing gap.

## Reels navigation

The desktop sidebar exposed its generic Reels destination as an exact
`a[href="/reels/"]` link. The adapter hides that destination independently of
the general suggestion setting. It does not hide account-specific `/reels/`
links or reel links embedded in requested content.

## Direct reel route

Instagram currently uses both `/reel/{id}/` and `/reels/{id}/` shapes. The
authenticated feed exposed the plural form. A direct plural route immediately
rendered five `[role="group"][aria-label="Video player"]` elements even without
scrolling and exposed a `main [role="toolbar"]` with previous/next controls.

Each video group was nested inside a route-local item container carrying an
inline `--x-height` property. On a direct reel route the controller therefore:

- retains the first visible item container;
- hides other preloaded item containers and the Reels navigation toolbar;
- blocks wheel, touch and vertical keyboard navigation;
- observes later DOM additions and applies the same boundary; and
- restores every changed inline style, listener and observer on teardown.

This is a presentation-layer boundary. Instagram may still prefetch additional
media, and the extension does not intercept requests or use Instagram APIs.

## Manual verification checklist

1. Reload the unpacked extension after building the Chromium target.
2. Confirm the generic Reels link is absent from the Instagram sidebar.
3. Open a reel through a user-requested post or direct URL.
4. Confirm the opened reel remains playable and its normal action buttons work.
5. Try wheel, touchpad, Page Down, arrow keys and the previous/next controls;
   none should expose another reel.
6. Navigate back to the home feed and confirm page scrolling is restored.
