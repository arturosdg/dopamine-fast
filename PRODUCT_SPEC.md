# Dopamine Fast — MVP product specification

## Promise

Keep the useful parts of social networks while giving every feed a real end.

## Initial target

- Firefox for Android
- Reddit, X, Instagram and YouTube mobile websites
- English-language application interface
- Authenticated browser sessions, including private content the user is already
  authorized to see

## Default experience

1. The user opens a supported social-network page.
2. A configurable opening pause interrupts automatic entry.
3. The user chooses how many minutes the session should last.
4. A floating countdown remains visible while the supported feed is active.
5. Dopamine Fast removes promoted and suggested content.
6. The first 20 top-level post elements remain visible.
7. The native feed ends with an inline load-more control after the twentieth
   post; no full-screen intervention is shown for a batch boundary.
8. The user can deliberately reveal 10 additional posts from that control.
9. Per-network daily hard limits for both time and posts stop further use.

## Time budgets

- Before entry, the user selects an intentional session duration.
- The opening screen shows today's elapsed time for Reddit, X, Instagram and YouTube
  before another session is planned.
- Session duration changes use discrete buttons instead of a slider, so adding
  more time requires a separate deliberate press for each step.
- The configured default is 10 minutes and can be adjusted from 1 to 60
  minutes at entry.
- A compact floating counter shows the planned session time and the remaining
  daily time for the current network.
- Time advances only while the tab is visible.
- When planned time ends, the user can leave or deliberately plan another
  block after a 10-second pause. The next duration cannot be selected until
  that pause has completed.
- Leaving an intervention replaces the current social-feed tab with a blank
  tab instead of relying on browser history.
- A separate daily limit applies to each supported network. It persists across
  reloads and sessions, resets on the next local calendar day and has no
  in-page unlock.
- Daily post and time mutations are serialized by the extension background
  context, and active tabs reconcile against persisted usage from other tabs.
- Aggregate elapsed seconds are retained locally for the 30 most recent days
  with activity so usage statistics survive calendar resets. Active session
  countdowns are not stored as history.
- The effective ceiling is fixed for the day. Configuration changes apply on
  the next local calendar day, and the settings page cannot reset elapsed time.

## Unlock flow

The end of a batch is rendered inside the native feed. The inline control shows
how many posts remain in that network's daily allowance, waits through the configured
pause and requires holding the load-more button for the configured duration.
Completing it reveals only the next configured batch.
Virtualized feeds are counted by stable post identity for the active page
session, so recycling DOM elements cannot reset the batch.
Blocked posts retain their layout geometry while becoming invisible and
non-interactive. Together with a terminal control that reserves the remaining
viewport, this keeps a platform's native infinite-loader sentinel outside the
visible area while the batch is closed.

## Modes

### Gentle

- Batch limit is active.
- Additional batches can be unlocked repeatedly.
- Suggested and promoted content remains blocked.

### Balanced

- One initial batch and two additional batches per network.
- The inline pause and hold are required.

### Strict

- Fixed daily maximum.
- Limit increases take effect the following day.
- Supported feeds fail closed if their adapter becomes uncertain.

## Platform scope

### Reddit

- Keep explicitly visited subreddits and subscribed content.
- Hide promoted posts, recommended communities and related-post modules.
- Hide search autocomplete and recommended results so a query must be entered
  deliberately before Reddit returns content.
- Hide Reddit's Popular, News and Explore navigation shortcuts while suggested
  content blocking is enabled.
- Limit listing pages to the active batch.

### X

- Prefer the Following feed.
- When the optional Following-only setting is enabled, select Following and
  hide the For You tab. If the expected tabs cannot be identified confidently,
  leave X's navigation unchanged.
- Hide For You, trends, promoted posts, Discover more and follow suggestions.
- Keep the Explore search box available while hiding its discovery tabs,
  trending content, account suggestions and autocomplete until the user submits
  a query.
- Hide the result-category tabs and discovery sidebar after a submitted X
  search, leaving only the query and its results.
- Limit the timeline to the active batch.

### Instagram

- Keep followed-account posts and direct profile visits.
- When the optional Following-only setting is enabled, select Following and
  hide For You while the home feed is active.
- Hide suggested posts, Explore recommendations, Reels surfaces and promoted
  posts.
- Hide the generic Reels navigation destination. When an individual reel or
  the Reels route is opened directly, keep the first opened item usable while
  blocking vertical wheel, keyboard and touch navigation to another reel.
- Stop after the active batch or after Instagram's own caught-up marker,
  whichever comes first.

### YouTube

- Limit Home and the Subscriptions feed to the active finite batch while
  leaving search, channels, comments and explicitly opened videos available.
- Hide Shorts navigation and Shorts shelves. Convert an explicitly opened
  `/shorts/{id}` route to the standard `/watch?v={id}` player so the requested
  video remains available without vertical Shorts navigation.
- When the optional Subscriptions-only setting is enabled, redirect Home to
  `/feed/subscriptions` and hide Home navigation.
- Always hide next-video, related-video, Shorts and end-screen recommendation
  surfaces on requested video pages.
- Treat YouTube post and time budgets independently from every other network.

## Privacy and permissions

- Local storage only.
- Time counters store aggregate elapsed seconds per network for the 30 most
  recent days with activity, never browsing content.
- No backend or analytics.
- No cookie permission.
- Host access limited to supported domains.
- No reading of private messages.
- No reading, copying or normalization of post contents.
- Source code published under the existing MIT license.

## Out of scope for the MVP

- A unified copied feed.
- RSS generation.
- Cross-device synchronization.
- iOS support.
- Automated background scraping.
- Official platform APIs.
