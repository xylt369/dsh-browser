# dsh-browser architecture

The browser capability follows DeepSeek Harness's "everything is a plugin" model: a Service Definition declares the seam, a Service Provider implements it, and a Consumer exposes it to the model. Nothing is hard-coded into the harness core.

## Seam shape

`dsh-browser` declares `ctx.browser` as an **abstract seam** (the `ctx.subprocess` pattern, one implementation per context):

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
- `snapshot` reads the accessibility tree (`locator.ariaSnapshot()`), falling back to `document.body.innerText`.
- `screenshot` produces PNG bytes; the consumer commits them via `ctx.attachments.saveImage`.
- `click` / `type` / `back` map to Playwright actions.

Per-session page isolation (rather than one process-wide page) is a planned follow-up; see Limitations.

## Screenshot → attachment

Screenshots are not returned as raw bytes to the model. The consumer stores them through the `ctx.attachments` seam and returns the durable `ImageAttachmentRef` (`attachmentId`, `mediaType`, `bytes`, `width`, `height`), which the host surfaces to the model and the UI.

## URL guard (anti-SSRF)

`browser-playwright/src/url-guard.ts` is the single owner of navigation safety:

1. reject non-`http(s)` schemes and URLs with embedded credentials;
2. block a default hostname list (`localhost`, cloud metadata endpoints, …);
3. reject private/loopback/link-local/multicast/reserved IP literals;
4. resolve the hostname and reject any non-public result (resolve-then-validate).

The guard is exercised by unit tests for the pure IP classifiers and the scheme/credential/literal branches.

## Permission integration (planned)

Browser actions are side-effectful and SSRF-relevant, so the next milestone adds a `tools/pre-execute` gate (a `web-permission` hook) that:

- allowlists/denylists by hostname,
- returns `{ kind: 'deny' }` for denylisted targets,
- returns `{ kind: 'ask' }` through `ctx.approval` for unapproved targets with persistent grants.

`browser_evaluate` (arbitrary JavaScript) is intentionally not shipped in the first pass because it is the highest-risk capability; when added it will be gated by `ctx.tools.guard()`.

## Limitations and roadmap

- **Residual SSRF TOCTOU** — Playwright owns the connection; the DNS check and the browser's connect are separate. A proxy or `--host-resolver-rules` pin is the follow-up.
- **Single process-wide page** — per-session browser contexts are planned.
- **`refs` in snapshots** — accessibility-tree refs are not parsed yet; `browser_click` takes a CSS selector.
- **`browser_evaluate`** — deferred until the permission gate ships.

## Composition

The Provider and Consumer are bundles. Their patch rows are:

```yaml
- insert:
    - id: browser-playwright
      name: 'dsh-browser-playwright'
- insert:
    - id: tool-browser
      name: 'dsh-tool-browser'
```
