# Changelog

## 0.4.1 (2026-08-15)

- **Fix duplicate `@deepseek-ai/dsh-tools` breaking the tool scheduler**: moved `dsh-tools`, `dsh-attachment`, `dsh-settings` back to peerDependencies so pnpm no longer installs a second `dsh-tools` copy into the profile; otherwise tool calls fail with `Cannot read properties of undefined (reading 'prepare')` and the turn reports an error.

## 0.4.0 (2026-08-14)

- **Dependency hardening**: `@deepseek-ai/dsh-tools`, `dsh-attachment`, `dsh-settings` moved from peerDependencies to regular dependencies; only `@deepseek-ai/cordis` remains a peer (it must share the host instance).
- **Headless deployment config**: `dsh-browser-playwright` accepts a provider `Config` (`headless` / `channel` / `profileDir`) for server/CI use.
- **e2e stability**: tests use a temp profile + headless; added a tab-reuse / recreate-after-close core test.
- **Docs**: README (zh/en) wording clarified (SSRF-safe by default; permission gate is opt-in strictness); CI example updated.

## 0.3.0 (2026-08-14)

- **a11y refs clicking**: `browser_snapshot` returns actionable refs (`e1`, …) via `ariaSnapshot({ mode: 'ai' })`; `browser_click` accepts a ref or CSS selector.
- **Auto-remember approved hosts**: `web-permission.remember` (default `true`) appends an approved host to `allowHosts` (persisted to settings.yaml).
- **`browser_evaluate`**: gated tool, disabled by default (`tool-browser` config `evaluate: true`).
