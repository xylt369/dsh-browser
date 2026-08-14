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

Release checklist — versions are per-package, so a change to one package does not require bumping the others.

1. Bump the version of **every package whose code changed** (the `dsh-browser` seam may stay behind when only the bundles changed).
2. Publish in dependency order: `dsh-browser` first (if bumped), then `dsh-browser-playwright`, `dsh-tool-browser`, `dsh-web-permission`.
3. Verify each publish: `npm view @yeesy369/<pkg> version` returns the new version and its `dependencies` are correct.
4. Deprecate superseded versions: `npm deprecate @yeesy369/<pkg>@<old> "Superseded by <new>"`.
5. Create a GitHub release: `gh release create vX.Y.Z --title ... --notes ... --target main`.
