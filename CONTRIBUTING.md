# Contributing

Thanks for considering contributing to `dsh-browser`.

## Setup

```sh
git clone https://github.com/xylt369/dsh-browser.git
cd dsh-browser
pnpm install
pnpm build
```

## Development

```sh
pnpm build       # compile all packages
pnpm typecheck   # type-check all packages
pnpm test        # unit tests
pnpm test:e2e    # real-browser e2e (installs Chromium if needed)
```

## Conventions

- Follow the `dsh` plugin model: Service Definition / Provider / Consumer, everything mounted as plugins.
- Keep browser URL safety in `browser-playwright/src/url-guard.ts`; never let a navigation path bypass it.
- Non-trivial changes need a test; run `pnpm test` and `pnpm test:e2e` before opening a PR.
- Docs are Chinese-first (`README.md`) with `README.en.md`; update both when user-facing behavior changes.

## Releasing

Bump versions, publish in dependency order (`dsh-browser` first, then the bundles), and create a GitHub release.
