# AGENTS.md

This file is the working guide for coding agents and contributors in this
repository. It describes the product and architecture as they exist today,
plus the invariants that changes must preserve.

This is the canonical shared instruction file for coding agents. `CLAUDE.md`
imports it for Claude Code compatibility. Keep common guidance here instead of
duplicating it in tool-specific files.

## Quick start

Use Node.js 22 or newer. CI currently runs Node.js 24.

```sh
npm ci
npm run dev             # Firefox development build
npm run dev:chrome      # Chromium development build
npm run validate        # types, unit tests and both production builds
npm run zip             # distributable Firefox and Chromium ZIPs
```

Run `npm run validate` before handing off a code change. Run `npm run zip` as
well when changing the manifest, entrypoints, assets, build configuration or
release packaging.

Generated directories (`.output/`, `.wxt/`, `dist/`, `coverage/` and
`node_modules/`) must not be committed or edited by hand.

## Product intent

Dopamine Fast is a local-first browser extension that makes supported social
feeds finite and intentional without copying or aggregating their content.
The initial product target is Firefox for Android, with Chromium builds kept
working.

Supported networks:

- Reddit
- X/Twitter
- Instagram
- YouTube

The extension operates on the authenticated web pages the user already visits.
It does not use platform APIs, scrape in the background, read private messages,
send browsing data to a service, or provide a unified feed.

The product principles are:

1. Preserve useful, user-requested access to social networks.
2. Add friction before and during habitual feed consumption.
3. Give feeds a visible end through finite post batches.
4. Keep the hard daily time limit outside the in-page unlock flow.
5. Store only preferences and aggregate counters, locally.
6. Request the minimum browser and host permissions required.
7. Fail safely when a platform changes its DOM.

`PRODUCT_SPEC.md` defines the intended behavior. `README.md` describes the
user-facing implementation. When either document disagrees with executable
behavior, call out the discrepancy rather than silently choosing one.

## Current feature model

On every supported route, the content script first resolves the network's
optional access-block schedule. An active blocked window supersedes all other
behavior and makes every route on that network unavailable.

On a supported feed route outside blocked hours, the content script:

1. Loads sanitized settings and the current local-day usage state.
2. Stops immediately when the extension/site is disabled or the route is not a
   feed.
3. Resolves the network's global, custom or always-active weekly schedule and
   bypasses feed/time limits outside its active window.
4. Blocks entry when the per-network daily time ceiling is exhausted.
5. Shows a configurable opening delay and asks for an intended session length.
6. Starts the finite-feed limiter with the configured initial batch.
7. Counts time only while the document is visible and shows a floating timer.
8. Stops at the selected session duration and asks the user to leave or choose
   another block.
9. Enforces the daily time ceiling without an in-page extension or reset.
10. Shows an end-of-batch intervention before revealing more posts.

Post counters and time budgets are independent per network:

- `DailyState.revealedByPlatform` and `DailyState.unlocksByPlatform` record
  post and unlock totals for each supported network without imposing a cap.
- `DailyState.revealed` and `DailyState.unlocks` remain aggregate reporting
  totals derived from their per-platform records.
- `DailyUsageState.usedSecondsByPlatform` enforces an independent time ceiling
  for each network.
- `Settings.sessionDurationMinutesByPlatform` and
  `Settings.dailyUsageLimitMinutesByPlatform` configure the two time values
  independently for each network.
- `DailyUsageState.dailyLimitMinutesByPlatform` captures each effective time
  ceiling when the day's state is created. Changing a setting applies on the
  next local calendar day.
- `Settings.limitSchedule` stores the optional global weekly window plus each
  platform's global, custom or always-active mode. Schedule changes apply on
  reactivation, and clock boundaries are detected by the content lifecycle.
- `Settings.accessBlockSchedule` stores independent global or per-platform
  blocked hours. Each platform may inherit the global schedule, use a custom
  schedule or opt out of complete blocking.
- Active planned countdowns are checkpointed in extension session storage by
  tab and platform so full same-tab navigations do not reopen the initial time
  picker. They are cleared when the countdown ends, protection is disabled or
  the tab closes.

Post batches can be unlocked repeatedly. Each unlock still requires the
configured inline delay and press-and-hold interaction.

## Technology and extension constraints

- WXT `0.21.x` supplies the extension build system and WebExtension globals.
- TypeScript is strict, with `noUncheckedIndexedAccess` and
  `noImplicitOverride`.
- The options page and injected intervention UI use native DOM APIs and CSS;
  there is no application UI framework.
- All user-facing application copy is written in English. Keep non-English
  platform tokens only when they are needed to detect localized suggested or
  promoted content.
- Vitest provides unit tests.
- Firefox builds target Manifest V2; Chromium builds target Manifest V3.
- The manifest requests only local `storage` plus the host access implied by
  content-script matches.
- The injected interface is isolated in a WXT shadow root.

Keep the dependency set small. Prefer browser APIs and focused modules over
adding a framework for isolated UI behavior. Pin npm dependencies exactly and
pin third-party GitHub Actions to full commit SHAs.

## Repository map

```text
entrypoints/
  background.ts          Serialized owner for daily-state mutations and privileged navigation
  content.ts             Runtime composition root for supported pages
  options/
    index.html           Settings markup
    main.ts              Settings form binding and persistence
    style.css            Options-page presentation
lib/
  models.ts              Domain types, defaults, sanitization and pure rules
  storage.ts             WXT storage keys and persistence operations
  platforms.ts           Host/route detection and selector adapters
  batch-gate-ui.ts       Inline end-of-batch control rendered inside the native feed
  feed-boundary.ts       Pure contiguous visibility planning for finite batches
  feed-limiter.ts        DOM observation, post visibility and batch boundaries
  media-autoplay.ts      One-time autoplay prevention per media element
  usage-session.ts       Visible-tab session timer and persistence lifecycle
  usage-history.ts       Pure normalization and retention for usage statistics
  preferred-feed.ts      Optional preferred-feed selection and tab restoration
  intentional-search.ts Search suggestion and discovery-surface suppression
  surface-suppression.ts Reversible Shorts and recommendation suppression
  single-item-view.ts   Scroll lock for explicitly opened single-item surfaces
  intervention-ui.ts     Shadow-DOM overlays, timer and deliberate interactions
  runtime-messages.ts    Validated background/content message contracts
  serial-queue.ts        Promise queue used by the background state owner
  session-time.ts        Pure discrete time-choice construction
assets/content.css       Injected shadow-root presentation
tests/                   Vitest unit tests for pure domain/platform behavior
public/                  Extension icons copied by WXT
wxt.config.ts            Manifest metadata and packaging configuration
PRODUCT_SPEC.md          Product behavior and scope
SOURCE_CODE_REVIEW.md    Reproducible Firefox build instructions
.github/                 CI, Release Please, Dependabot and contribution policy
```

## Architectural boundaries

Maintain this dependency direction:

```text
entrypoints -> orchestration and browser lifecycle
            -> lib services and domain modules

feed-limiter / usage-session / intervention-ui
            -> models, storage or platform contracts as needed

storage / platforms -> models
models             -> no browser or DOM dependencies
```

Specific responsibilities:

- `entrypoints/content.ts` composes services, reacts to SPA navigation/settings
  changes and owns activation cancellation. Keep policy and DOM algorithms out
  of it.
- `entrypoints/background.ts` is the single owner for daily post counters and
  time mutations and privileged options/leave navigation. Keep its message
  surface validated and route new daily-state writes through its serialized
  queue.
- `models.ts` must remain deterministic and easy to unit test. Put defaults,
  clamps, date normalization and pure budget calculations here.
- `storage.ts` owns storage key names and all persistent reads/writes. Other
  modules must not introduce ad-hoc storage keys.
- `usage-history.ts` normalizes the bounded daily time history and has no
  browser or DOM dependencies.
- `preferred-feed.ts` applies an adapter-defined preferred tab and restores any
  tab styles it changes during teardown.
- `surface-suppression.ts` applies adapter-scoped navigation and recommendation
  rules and restores every inline display style it changes during teardown.
- `single-item-view.ts` blocks vertical feed navigation on an explicitly
  opened item and restores page styles and listeners during teardown.
- `platforms.ts` is the only home for network-specific hosts, feed routes,
  selectors, stable post identities and recommendation markers.
- `feed-limiter.ts` may manipulate feed elements, but it must restore every
  style it changes when destroyed.
- `batch-gate-ui.ts` owns the inline end-of-batch control and must remain
  isolated from host-page styles and text.
- `usage-session.ts` owns timer state and persistence cadence, not overlay
  markup.
- `intervention-ui.ts` owns rendering and direct UI interaction, not storage or
  platform detection.
- The floating usage timer is informational, translucent and pointer-transparent.
  Full-screen interventions remain interactive and inaccessible host-page
  content must stay behind them.

`intervention-ui.ts` is already the largest module. When adding another
substantial screen or interaction state, split it by intervention or introduce
a small view/state abstraction instead of continuing to grow one class.

## State and concurrency invariants

All persisted values must pass through normalization or sanitization when read
and before they influence behavior. New fields require safe defaults so
existing installations continue to work without a migration.

Preserve these invariants:

- Calendar resets use the user's local date, not UTC.
- Numeric settings are finite integers constrained to product-safe ranges.
- Schedule times use validated local `HH:MM` values; overnight windows inherit
  the selected start day and continue into the following morning.
- Usage is counted only while the supported feed document is visible.
- Pending seconds are persisted on visibility loss, page hide and teardown.
- A document reload may restore the active planned countdown, but must still
  reconcile the daily remaining time from serialized storage before resuming.
- A time-limit change cannot increase the effective ceiling for the current
  day.
- Repeated activation must cancel stale asynchronous UI results.
- Teardown must clear timers, observers and listeners and restore page state.

Daily post counter increments and elapsed-time increments are serialized
through the background owner. Content scripts watch persisted time
usage and lower their local remaining-time view when another tab advances it.
Preserve this ownership model and add browser-level multi-tab coverage when an
end-to-end harness is introduced.

## Platform adapter changes

Social DOM selectors are volatile. A selector must be narrowly scoped and must
not hide a broad parent container when confidence is low. Recommendation text
matching is a fallback, not a reason to inspect or retain post bodies.

When adding or changing a platform:

1. Update `PlatformId`, default settings and per-platform state shapes.
2. Add/update the adapter, host recognition, feed-route rules and selectors.
3. Update the content-script match patterns.
4. Expose the site in the options UI.
5. Add unit tests for host and route boundaries.
6. Manually test signed-in mobile and desktop layouts where available.
7. Document the tested browser, viewport and network in the PR.

Direct profiles, messages, settings and post-detail routes should remain usable
and outside the limiter except while their network's explicit access-block
schedule is active.

## DOM, privacy and security rules

Treat the host page as untrusted input:

- Never inject social-network text with `innerHTML`.
- Do not execute remote code or load scripts/styles from a CDN.
- Do not read cookies, authentication tokens, private messages or unnecessary
  post content.
- Do not add analytics, telemetry, remote logging or a backend without an
  explicit product decision and privacy review.
- Do not broaden permissions or match patterns incidentally.
- Keep overlays accessible: dialog semantics, labels, live regions, keyboard
  behavior and usable touch targets matter.
- Page locks must restore the original `html` and `body` overflow values.
- Observers and DOM scans must be debounced and bounded; social feeds mutate
  continuously.
- Virtualized feeds must count stable post identities in memory so removing old
  DOM nodes cannot reopen the current batch. Do not persist those identities.

A “hard” daily time limit means no bypass exposed by the extension UI. Users
still control their browser, storage and installed extensions; documentation
must not imply tamper-proof enforcement.

## Code Review Rules

Review for behavioral and security regressions, not formatting that CI can
enforce. Flag a change when it:

- broadens browser permissions, host matches or collected data without a
  documented need and privacy analysis;
- sends local state or page-derived data off-device;
- inserts host-page content through `innerHTML` or introduces remote code;
- weakens the hard daily time limit, exposes a time-counter reset or lets current-day
  settings increases take effect immediately;
- mutates daily state outside `storage.ts` or adds another non-serialized
  read-modify-write path;
- fails to cancel stale activations, timers, observers or listeners;
- hides content with selectors broad enough to remove user-requested posts or
  unrelated page controls;
- changes a supported route without a boundary test;
- adds a setting without sanitization and a backward-compatible default;
- changes visible behavior without corresponding product documentation.

When flagging selector fragility, propose a narrower selector or a fail-open
guard. When flagging state correctness, prefer a serialized background owner
over timing-based retries in individual tabs.

## Settings changes

For every new setting:

1. Add it to `Settings` and `DEFAULT_SETTINGS`.
2. Sanitize/clamp it in `sanitizeSettings`.
3. Add backward-compatible rendering and form reading in the options page.
4. Decide whether a mid-session update applies immediately, on reactivation or
   on the next local day.
5. Add model tests for invalid, missing and boundary values.
6. Update `PRODUCT_SPEC.md` and `README.md` when behavior is user-visible.

Do not provide an options-page reset for elapsed time.

## Testing strategy

Automated tests should focus on deterministic behavior:

- settings sanitization and backward compatibility;
- date rollover and budget calculations;
- host and feed-route boundaries;
- session state transitions and persistence, using fakes where necessary;
- selector fixtures and safe failure behavior;
- concurrent storage updates once a serialized state owner exists.

Minimum validation by change type:

| Change | Required validation |
| --- | --- |
| Documentation only | Inspect links and diff |
| Pure model/platform rule | `npm test` and `npm run typecheck` |
| Runtime, options or CSS | `npm run validate` |
| Manifest/build/release | `npm run validate` and `npm run zip` |
| Selector change | Automated checks plus manual target-site verification |
| Visible UI change | Firefox and Chromium smoke test; Android when practical |

There is no comprehensive DOM or end-to-end suite yet. Do not treat passing
unit tests as proof that current social-network selectors work.

## Contribution and release workflow

- Keep pull requests focused and use Conventional Commit titles.
- Squash merges make the PR title the commit message consumed by Release
  Please.
- Required CI check: `Validate and package`.
- Merges are controlled by the maintainer. The single-maintainer ruleset does
  not require a separate approval, but CI and resolved conversations remain
  mandatory.
- `CODEOWNERS` currently assigns the repository to `@arturosdg`.
- Dependabot separates patch, minor and major npm updates and applies cooldowns;
  security updates must not be intentionally delayed.

### Pull request targets and dependent changes

The default and only integration branch is `main`. Every pull request must use
`main` as its base, including changes that depend on another open pull request.
Never target a temporary feature branch: merging such a PR would update that
branch instead of `main` and would not start the release workflow.

For dependent changes:

1. Create each change on top of its logical predecessor, but open every PR
   against `main`.
2. State the dependency and required merge order in the PR body.
3. Accept that later PRs show a cumulative diff until their predecessors land.
4. After a predecessor is merged, fetch `origin/main`, rebase the next branch
   onto it and push with `--force-with-lease`.
5. Confirm that GitHub now shows only the intended commit(s), the base is
   `main`, and required checks pass again.
6. Merge in dependency order.

Agents may create commits, push branches and maintain draft PRs. They must not
mark a PR ready, enable auto-merge or merge a PR unless the maintainer
explicitly requests that action in the current task.

Release Please opens a version PR after releasable commits reach `main`.
Creating that PR with `GITHUB_TOKEN` requires the repository setting that lets
Actions create pull requests. For unattended downstream CI, prefer a narrowly
scoped `RELEASE_PLEASE_TOKEN` or GitHub App token. AMO publishing is optional
and requires the three Firefox secrets documented in `README.md`.

### Commit convention

Use this shape for commits and PR titles:

```text
<type>(<optional-scope>): <imperative summary>
```

Rules:

- Use a lowercase type and scope.
- Write a concise, imperative summary without a trailing period.
- Keep one logical change per commit.
- Use the body to explain motivation, trade-offs or migration details when the
  summary is not enough.
- Mark breaking changes with `!`, for example `feat(storage)!: replace daily
  state schema`, and add a `BREAKING CHANGE:` footer explaining the impact.
- Before committing, check that the staged diff contains only the intended
  change and run the validation required by the testing matrix.

Project commit types:

| Type | Use |
| --- | --- |
| `feat` | New user-visible behavior; produces a minor release |
| `fix` | User-visible defect correction; produces a patch release |
| `docs` | Documentation only |
| `test` | Tests without a behavior change |
| `refactor` | Internal restructuring without a behavior change |
| `perf` | Performance improvement |
| `build` | Build system or packaging |
| `ci` | CI/CD workflow or automation |
| `chore` | Repository maintenance not covered above |
| `deps` | Dependency-only updates, including Dependabot |

`feat!`, `fix!` or any commit with a `BREAKING CHANGE:` footer produces a major
release. The non-release types above do not normally create a Release Please
version bump.

Examples:

```text
feat(timer): add a per-network daily ceiling
fix(instagram): avoid limiting profile routes
docs: document selector verification
ci(release): upload browser packages
deps(deps-dev): bump the TypeScript toolchain
```

Dependabot is configured to use `deps` plus the dependency scope, yielding
titles such as `deps(deps): ...` and `deps(deps-dev): ...`. Preserve that format
when editing `.github/dependabot.yml`.

## Definition of done

Before completing a change:

1. Review the diff for unrelated edits and generated files.
2. Confirm product scope, privacy and permissions remain intentional.
3. Add or update tests and documentation proportional to the change.
4. Run the required validation from the matrix above.
5. Report manual testing gaps honestly, especially selector-dependent behavior.
6. Note any state migration, browser compatibility or release impact.
