# Contributing

Thanks for helping make social feeds calmer and more intentional. By
participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## What we look for

Keep pull requests focused and explain the user problem they solve. Changes
should preserve local-first storage, minimal permissions and user control.
Features designed to increase engagement, collect unnecessary data or create
new attention traps are outside the project's goals.

Selector changes should fail safely and include the network, browser and device
used for manual testing. Interface changes should include a screenshot or short
recording when practical.

## Local validation

Use Node.js 22 or newer:

```sh
npm ci
npm run validate
npm run zip
```

## Commit messages

This repository uses Conventional Commits because Release Please derives the
next version and changelog from commit history.

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `feat!:` or a `BREAKING CHANGE:` footer creates a major release.
- `docs:`, `test:`, `chore:` and `deps:` do not normally trigger a release.

Examples:

```text
fix(reddit): recognize compact post containers
feat(settings): add separate limits per network
feat!: replace the saved-settings format
```

Pull request titles should follow the same format because squash merges use the
pull request title as the commit message on `main`.

The pull request template includes the expected validation, privacy and
documentation checks. Items that do not apply can be left unchecked with a
short explanation.

## Releases

Release Please maintains the release pull request, `CHANGELOG.md`,
`package.json`, tags and GitHub Releases. Merging the generated release pull
request packages Firefox and Chromium builds and attaches them to the release.

AMO submission runs only after the repository secrets documented in the README
have been configured.
