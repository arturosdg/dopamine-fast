# Dopamine Fast — MVP product specification

## Promise

Keep the useful parts of social networks while giving every feed a real end.

## Initial target

- Firefox for Android
- Reddit, X and Instagram mobile websites
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
7. The native feed is covered by an end-of-batch barrier after the twentieth
   post.
8. The user can leave or deliberately unlock 10 additional posts.
9. Daily hard limits for both time and posts stop further use.

## Time budgets

- Before entry, the user selects an intentional session duration.
- The configured default is 10 minutes and can be adjusted from 1 to 60
  minutes at entry.
- A compact floating counter shows the planned session time and the remaining
  daily time for the current network.
- Time advances only while the tab is visible.
- When planned time ends, the user can leave or deliberately plan another
  block.
- A separate daily limit applies to each supported network. It persists across
  reloads and sessions, resets on the next local calendar day and has no
  in-page unlock.
- The effective ceiling is fixed for the day. Configuration changes apply on
  the next local calendar day, and the settings page cannot reset elapsed time.

## Unlock flow

The balanced-mode unlock requires:

1. Selecting an intention:
   - Find something specific
   - Reply or interact
   - Continue reading deliberately
   - I am scrolling automatically
2. Waiting through a short pause.
3. Holding the unlock control for three seconds.

The answers are stored only as aggregate local counts and are never transmitted.

## Modes

### Gentle

- Batch limit is active.
- Additional batches can be unlocked repeatedly.
- Suggested and promoted content remains blocked.

### Balanced

- One initial batch and two additional batches.
- Intent selection, pause and hold are required.

### Strict

- Fixed daily maximum.
- Limit increases take effect the following day.
- Supported feeds fail closed if their adapter becomes uncertain.

## Platform scope

### Reddit

- Keep explicitly visited subreddits and subscribed content.
- Hide promoted posts, recommended communities and related-post modules.
- Limit listing pages to the active batch.

### X

- Prefer the Following feed.
- Hide For You, trends, promoted posts, Discover more and follow suggestions.
- Limit the timeline to the active batch.

### Instagram

- Keep followed-account posts and direct profile visits.
- Hide suggested posts, Explore recommendations, Reels surfaces and promoted
  posts.
- Stop after the active batch or after Instagram's own caught-up marker,
  whichever comes first.

## Privacy and permissions

- Local storage only.
- Time counters store elapsed seconds per network, never browsing content.
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
