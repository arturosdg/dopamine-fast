# Firefox source-code review

Dopamine Fast is built with Node.js 22+ and npm.

To reproduce the Firefox package from source:

```sh
npm ci
npm run typecheck
npm test
npm run zip:firefox
```

The extension ZIP and source ZIP are written to `.output/`.

The build has no environment variables, remote code, generated API clients or
vendored binaries. Dependencies are locked in `package-lock.json`.
