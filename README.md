# dsh-browser

Browser capability for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) — the agent framework where everything is a plugin.

`dsh` ships filesystem, shell, search, and fetch primitives, but it has **no browser**: there is no `ctx.browser` seam, no provider, and no model-facing tools for opening, reading, or driving a real web page. This repository adds that missing capability as three `dsh`-style packages, following the same Service Definition / Provider / Consumer model the rest of the harness uses.

> 中文说明见 [README.zh.md](./README.zh.md)。

## Why it matters

- **A real gap.** `dsh`'s official `dsh-web-fetch-http` provider explicitly documents that SSRF / private-network protection is deferred and that it "must not be enabled" on internal-network-reachable deployments. There is no browser package anywhere in the tree.
- **Built for the model, not for the DOM.** Pages are presented as compact accessibility snapshots instead of raw HTML, and screenshots become durable image attachments the model can actually see.
- **Safe by default.** Every navigation passes a URL guard that rejects credentials, non-`http(s)` schemes, blocked hostnames, and private/loopback/link-local/multicast destinations (with DNS resolve-then-validate).

## Packages

| Package | Role | What it does |
|---|---|---|
| [`dsh-browser`](./packages/browser) | Service Definition | Declares the `ctx.browser` seam (`BrowserRuntime`, `BrowserPage`, typed results). |
| [`dsh-browser-playwright`](./packages/browser-playwright) | Service Provider | Implements `ctx.browser` with a headless Playwright browser. |
| [`dsh-tool-browser`](./packages/tool-browser) | Consumer | Registers `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_back`, and `browser_screenshot`. |

The Service Definition is a pure library (types + abstract class); the Provider and Consumer are installable bundles.

## Architecture

```mermaid
flowchart LR
  TD["dsh-browser<br/>(ctx.browser seam)"] --> P["dsh-browser-playwright<br/>(provider)"]
  TD --> C["dsh-tool-browser<br/>(consumer)"]
  C --> A["ctx.attachments<br/>(screenshots)"]
  C --> T["ctx.tools<br/>(defineTool)"]
  P --> G["url-guard<br/>(anti-SSRF)"]
```

- **Service Definition** declares `BrowserRuntime extends Service` and augments `Context` with `ctx.browser`.
- **Provider** subclasses `BrowserRuntime`, launches Chromium via Playwright, and wraps pages in a `BrowserPage` that enforces URL safety.
- **Consumer** injects `['tools', 'browser', 'attachments']` and registers six tools with typed schemas; `browser_screenshot` commits PNG bytes through `ctx.attachments.saveImage`.

The full design lives in [docs/architecture.md](./docs/architecture.md).

## Model-facing tools

| Tool | Side effects | Notes |
|---|---|---|
| `browser_navigate` | network | URL is SSRF-checked |
| `browser_snapshot` | none | accessibility snapshot (fallback: body text) |
| `browser_screenshot` | image | stored as a durable attachment |
| `browser_click` | page mutation | CSS selector |
| `browser_type` | page mutation | types into focused element |
| `browser_back` | history | |

## Install

The intended distribution path is npm (one bundle per package). From a `dsh` checkout:

```sh
dsh plugin --profile web add dsh-browser-playwright dsh-tool-browser
```

During development, load the packages from source with a `--patch` overlay:

```sh
pnpm install
pnpm build
dsh --profile web --patch packages/browser-playwright/cordis.patch.yml --patch packages/tool-browser/cordis.patch.yml
```

> Git-install of a monorepo subdirectory is not a supported first-class `dsh plugin` path yet; publishing the three packages to npm is the primary plan. See [docs/architecture.md](./docs/architecture.md) for the exact patch rows.

## Security model

`browser-playwright/src/url-guard.ts` owns URL safety. Before navigation it:

1. rejects non-`http(s)` schemes and URLs with embedded credentials;
2. blocks a default hostname list (`localhost`, cloud metadata endpoints, …);
3. rejects private/loopback/link-local/multicast/reserved IP literals;
4. resolves the hostname and rejects any result that is non-public (DNS resolve-then-validate).

Known residual risk: Playwright owns the network stack, so a TOCTOU exists between the guard's DNS check and the browser's own connection. A proxy or `--host-resolver-rules` pin is the documented follow-up. Never enable private targets on a network that can reach sensitive internal hosts.

## Status

This is an **alpha** project built against `dsh` `0.1.0-rc.5` and Cordis `4.x`. Types were written from the published seam contracts; a first `pnpm install && pnpm build` may surface minor import-path adjustments as the `@deepseek-ai/*` packages evolve.

## Development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test          # browser-playwright tests require `pnpm playwright install chromium`
```

See [AGENTS.md](./AGENTS.md) for repository conventions and [LICENSE](./LICENSE) for terms (MIT).
