# Changelog

## 0.6.0 (2026-08-15)

- **Window modes**: `browser-playwright` now ships `windowVisibility: "visible" | "hidden" | "headless"` (default `visible`). `hidden` runs the real browser with the window minimized and parked offscreen — best anti-bot posture without desktop clutter — while `headless` stays the no-window choice for servers/CI. The legacy `headless: true` field still works and maps to `windowVisibility: "headless"`.
- **Stealth patch**: new `stealth` config (default `true`) wires launch args plus a dependency-free init script that removes `navigator.webdriver`, fakes plugins in headless, masks SwiftShader/llvmpipe WebGL vendors, fixes the notifications permission, and more (`packages/browser-playwright/src/stealth.ts`).
- **Seam 0.5.0**: `BrowserPageOptions.windowVisibility` added; `headless` marked deprecated.
- **e2e**: headless+stealth marker checks (`navigator.webdriver`, plugins, notifications) and a hidden-window smoke test (skipped on CI, which has no desktop session).

## 0.5.0 (2026-08-15)

- **`browser_scroll`**: new model-facing tool to page through long content (feeds, documents, comment threads). Defaults to 800px down; accepts `direction` (`up` / `down` / `left` / `right`) and `amount` (pixels). Returns the new `scrollX` / `scrollY` plus `atBoundary`, so the model can stop scrolling at the page edge instead of looping.
- **Seam 0.4.0**: `BrowserPage.scroll` added to the `@yeesy369/dsh-browser` service definition (`BrowserScrollOptions` / `BrowserScrollResult`).
- **e2e**: real-browser test covers offsets and boundary detection for down / up / edge / defaults.

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
