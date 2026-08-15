# dsh-browser architecture

The browser capability follows DeepSeek Harness's "everything is a plugin" model: a Service Definition declares the seam, a Service Provider implements it, and a Consumer exposes it to the model. Nothing is hard-coded into the harness core.

## Seam shape

`@yeesy369/dsh-browser` declares `ctx.browser` as an **abstract seam** (the `ctx.subprocess` pattern, one implementation per context):

```ts
export abstract class BrowserRuntime extends Service {
  constructor(ctx: Context) { super(ctx, 'browser') }
  abstract newPage(options?, signal?): Promise<BrowserPage>
  abstract close(signal?): Promise<void>
}
```

A provider subclasses it and is loaded as a plugin, so swapping Playwright for CDP or a remote browser service means loading a different provider — no consumer change.

## Page lifecycle

`BrowserRuntime` owns one browser, one context, and one reusable page. `newPage()` returns a `BrowserPage` wrapper that lazily reuses the existing page, so navigation state persists across tool calls in a session.

- `navigate` validates the URL through the URL guard, then `goto` with `domcontentloaded`.
- `snapshot` reads the accessibility tree via `ariaSnapshot({ mode: 'ai' })` — the AI mode exposes actionable refs like `[ref=e1]` — falling back to `document.body.innerText`.
- `click` accepts an accessibility ref (e.g. `e1` from the last snapshot) or a CSS selector.
- `scroll` moves the main document by a pixel amount in a direction (default 800px down) and reports the new offset plus an `atBoundary` flag so the model knows when it hit the edge.
- `evaluate` runs a raw JS expression in the page (high risk; the consumer exposes it only behind a config flag).
- `screenshot` produces PNG bytes; the consumer commits them via `ctx.attachments.saveImage`.
- `type` / `back` map to Playwright actions.

Per-session page isolation (rather than one process-wide page) is a planned follow-up; see Limitations.

## Deployment configuration

`dsh-browser-playwright` exposes a provider-level `Config` so headed vs headless, the browser channel, and the persistent profile are deployment choices:

```yaml
- id: browser-playwright
  config:
    headless: false        # true for server/CI (no desktop)
    channel: msedge        # or chrome; auto-detected when omitted
    profileDir: ~/.dsh/edge-profile
```

## Screenshot → attachment

Screenshots are not returned as raw bytes to the model. The consumer stores them through the `ctx.attachments` seam and returns the durable `ImageAttachmentRef` (`attachmentId`, `mediaType`, `bytes`, `width`, `height`), which the host surfaces to the model and the UI.

## URL guard (anti-SSRF)

`browser-playwright/src/url-guard.ts` is the single owner of navigation safety:

1. reject non-`http(s)` schemes and URLs with embedded credentials;
2. block a default hostname list (`localhost`, cloud metadata endpoints, …);
3. reject private/loopback/link-local/multicast/reserved IP literals;
4. resolve the hostname and reject any non-public result (resolve-then-validate).

The guard is exercised by unit tests for the pure IP classifiers and the scheme/credential/literal branches.

## Permission integration

`@yeesy369/dsh-web-permission` gates web/browser tools at `tools/pre-execute` (waterfall):

- it reads `exec.name` and the `url` argument, then classifies the hostname as allowlist / denylist / ask;
- a denylisted host returns `{ kind: 'deny', reason }`;
- with `defaultAction: 'ask'`, an unknown host routes through `ctx.approval`; with `remember` (default `true`), an approved host is appended to `allowHosts` (persisted to settings.yaml), so it is not asked again;
- an allowlisted host delegates via `next()`.

The classification logic lives in `src/policy.ts` as pure functions so it is unit-testable without a live harness.

`browser_evaluate` ships but is **disabled by default** (`tool-browser` config `evaluate: true` to enable) because it is arbitrary code execution; the permission gate should be tightened alongside it.

## Limitations and roadmap

- **Residual SSRF TOCTOU** — Playwright owns the connection; the DNS check and the browser's connect are separate. A proxy or `--host-resolver-rules` pin is the follow-up.
- **Single process-wide page** — per-session browser contexts are planned.

## Composition

The Provider, Consumer, and permission gate are bundles. Their patch rows are:

```yaml
- insert:
    - id: browser-playwright
      name: '@yeesy369/dsh-browser-playwright'
- insert:
    - id: tool-browser
      name: '@yeesy369/dsh-tool-browser'
- insert:
    - id: web-permission
      name: '@yeesy369/dsh-web-permission'
```
