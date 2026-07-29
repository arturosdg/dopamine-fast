# Dopamine Fast

Dopamine Fast is an open-source browser extension that keeps social websites
usable while giving their feeds a real end.

The MVP targets Firefox for Android and supports Reddit, X/Twitter and
Instagram. It works on top of the websites you already use:

- pauses before opening a supported feed;
- hides best-effort suggested and promoted surfaces;
- disables media autoplay;
- reveals posts in finite batches;
- adds a deliberate unlock flow before showing another batch;
- enforces a local daily allowance.

It does not copy posts, inspect private messages, use platform APIs or send
browsing data to a backend.

## Status

This is an early, selector-based prototype. Social websites change frequently,
so platform selectors will need to be tested and adjusted against their current
mobile interfaces.

## Development

Requirements:

- Node.js 22 or newer
- npm
- Firefox

Install dependencies:

```sh
npm install
```

Start Firefox development mode:

```sh
npm run dev
```

Run validation:

```sh
npm run validate
npm run zip
```

The production Firefox build is written to `.output/firefox-mv2`.

## Firefox for Android

WXT targets Manifest V2 for Firefox by default and Manifest V3 for Chromium.
For Android testing, build the extension and load `.output/firefox-mv2` using
Mozilla's Firefox Android extension development workflow.

## Architecture

```text
entrypoints/content.ts
  ├─ opening pause
  ├─ route activation
  └─ FeedLimiter
       ├─ platform selectors
       ├─ finite batch
       ├─ suggested-content suppression
       └─ unlock intervention

entrypoints/options/
  └─ local settings UI

lib/
  ├─ models.ts
  ├─ storage.ts
  ├─ platforms.ts
  ├─ feed-limiter.ts
  └─ intervention-ui.ts
```

All preferences and daily counters use browser extension local storage.

## Releases and dependency updates

GitHub Actions validates every pull request and packages Firefox and Chromium
artifacts.

Release Please manages versions through Conventional Commits:

- `fix:` produces a patch release;
- `feat:` produces a minor release;
- `feat!:` or `BREAKING CHANGE:` produces a major release.

After changes reach `main`, Release Please opens or updates a release pull
request. Merging that pull request creates the tag and GitHub Release, builds
both browser packages and uploads ZIP files plus SHA-256 checksums.

Dependabot checks npm and GitHub Actions weekly. Version updates are separated
into patch, minor and major groups, with cooldowns of 3, 7 and 30 days. Security
updates are not delayed by the cooldown.

Third-party actions are pinned to commit SHAs. Dependabot keeps those pins
current.

### Optional Firefox Add-ons deployment

The release workflow submits to AMO when these Actions secrets exist:

- `FIREFOX_EXTENSION_ID`
- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

The first AMO listing must be created manually. Without these secrets, GitHub
Releases continue working and the AMO step exits successfully with a notice.

`RELEASE_PLEASE_TOKEN` is optional. When provided as a fine-grained token, PRs
created by Release Please can trigger other GitHub workflows. Otherwise the
workflow falls back to `GITHUB_TOKEN`.

## Privacy

Dopamine Fast requests access only to Reddit, X/Twitter and Instagram, plus the
browser's local storage permission. It has no analytics, accounts, cookie
permission or remote service.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the
development workflow and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for the
behavior and product principles expected in this community.

## License

MIT
