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

## Pull request targets and dependencies

All pull requests target `main`, the repository's integration and release
branch. Do not use another feature branch as the PR base.

When one change depends on another open PR, build its branch on top of the
predecessor but still target `main`. Document the dependency and merge order in
the PR body. The child PR will temporarily show a cumulative diff. After the
predecessor is merged, rebase the child branch onto the latest `main`, push it
with `--force-with-lease` and verify that its focused diff and CI checks are
correct before merging.

Pull requests are opened as drafts by automation. The maintainer decides when
they are ready and performs every merge.

## Releases

Release Please maintains the release pull request, `CHANGELOG.md`,
`package.json`, tags and GitHub Releases. Merging the generated release pull
request packages Firefox and Chromium builds and attaches them to the release.

AMO submission runs only after the repository secrets documented in the README
have been configured.
