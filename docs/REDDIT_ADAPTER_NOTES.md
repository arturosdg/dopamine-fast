# Reddit adapter notes

This document records observations from manual and remote inspection of the
authenticated Reddit web feed. It is intended to make future selector and
finite-feed work reproducible.

## Verified environment

- Date: 2026-08-02
- Browser: Firefox 153.0.1 on Windows
- Page: authenticated `https://www.reddit.com/` desktop feed with Spanish Reddit UI
- Extension: Firefox MV2 production build loaded temporarily through `web-ext`
- Profile: temporary copy of the maintainer's normal Firefox profile
- Observed viewport height: 860 CSS pixels

Android and Chromium were not manually verified during this inspection.

## Current post structure

The inspected desktop feed used `shreddit-post` as its top-level post element.
Each post exposed a stable Reddit fullname through its `id`, for example
`t3_1vcwk92`, and was wrapped by an `article.w-full.m-0` element.

Observed selector counts before limiting:

| Selector | Matches |
| --- | ---: |
| `shreddit-post` | 28 |
| `[data-testid="post-unit"]` | 0 |
| `[data-testid="post-container"]` | 0 |
| `article[data-testid="post"]` | 0 |

The fallback selectors remain useful for other Reddit layouts, but
`shreddit-post[id]` is the verified contract for this one. Selector confidence
must remain narrow; do not hide a broad feed ancestor when this contract is
missing.

## Virtualization discovery

Reddit recycles the feed DOM during long scrolls. In one inspection the page
was at approximately `scrollY = 98,759` while only 28 `shreddit-post` elements
remained in the document. Old posts had been removed and replaced with newer
ones while Reddit preserved virtual scroll height.

Limiting `regularPosts.slice(0, allowance)` is therefore incorrect. It limits
only the current DOM window and effectively grants a fresh allowance whenever
Reddit removes earlier nodes.

The limiter now keeps stable post identities in memory for the active page
session:

- Reddit uses the `t3_*` element id.
- Already revealed identities remain allowed if Reddit recreates their nodes.
- New identities are hidden once the reserved batch is full.
- Post identities are never persisted or transmitted.
- Elements without a stable platform key receive an element-scoped fallback
  key, which fails closed when virtualization replaces them.

## Inline batch boundary

The batch boundary is not a modal. The extension inserts an isolated inline
control immediately after the last revealed post, or immediately before the
first blocked post when Reddit has already appended more content.

Reddit may remove extension-owned nodes while reconciling its feed. The
mutation observer therefore restores the control beside the current boundary.
The control also clamps the document scroll position while the batch is
closed. This is necessary because Reddit can preserve virtual height or append
loader space even when every new post element is hidden.

Completing the configured wait and press-and-hold action reserves and reveals
only the next configured batch. The scroll clamp is removed until the next
boundary is reached.

## Real-session results

With an initial allowance of 20 posts:

1. Reddit initially exposed 28 posts.
2. The limiter left 20 visible and hid 8.
3. A forced long scroll caused Reddit to recycle old nodes and expose 34
   current post elements.
4. Only one previously revealed element remained in the virtualized DOM; all
   33 new elements were hidden.
5. The inline gate was held at approximately 16 CSS pixels from the top of the
   viewport, preventing further scrolling until another batch was requested.

These numbers describe the current DOM, not the total number of posts Reddit
had fetched during the entire test.

## Known limitations

- This is finite-feed pagination at the presentation layer. Reddit may still
  prefetch hidden posts or loader data in the background.
- The extension does not intercept Reddit requests, use Reddit APIs or request
  additional network permissions.
- Reddit selectors and wrappers are volatile and require signed-in desktop and
  mobile smoke tests after platform changes.
- A browser-level test should eventually simulate DOM recycling and verify
  that stable post identities cannot reopen a consumed batch.

## Manual verification checklist

1. Open the authenticated Reddit home feed in a fresh tab.
2. Start a Dopamine Fast session and confirm the configured first batch size.
3. Scroll through the full batch and confirm that no full-screen batch dialog
   appears.
4. Confirm the inline control is visible and the document cannot scroll past
   it.
5. Complete the wait and hold action and confirm exactly the configured extra
   batch becomes visible.
6. Continue far enough to trigger Reddit virtualization and confirm the next
   inline boundary still appears.
7. Navigate to a post detail, messages and settings to confirm those routes
   remain outside the limiter.
