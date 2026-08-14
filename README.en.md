# dsh-browser 🦊

English | [中文](README.md)

Browser capability for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): open real web pages, read content, click, type, and screenshot — powered by your local Microsoft Edge.

`dsh` ships filesystem, shell, search, and fetch primitives, but **no browser**. This repository adds the missing browser capability as `dsh`-style packages (Service Definition / Provider / Consumer), in **real-user mode by default**: headed Edge, a persistent profile, and reduced automation fingerprints — so even anti-bot sites like bilibili and zhihu work.

## Quick start (3 steps)

> **Prerequisite (one-time)**: your terminal must have `dsh` on PATH. If `dsh` is not recognized, install it globally first:
> ```sh
> npm i -g @deepseek-ai/dsh
> ```
> Then **open a new terminal window** and continue. Alternatively, replace `dsh` in every command below with `npx @deepseek-ai/dsh`.

**Step 1 — Install** (any terminal):

```sh
dsh plugin --profile web add @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
```

> Windows one-click alternative: `powershell -ExecutionPolicy Bypass -File scripts/install.ps1` (equivalent, also adds an example allowlist entry).

**Step 2 — Restart dsh**: in the terminal running `dsh web`, press `Ctrl+C`, then run `dsh web` again.

**Step 3 — Use it**: tell the AI "open https://www.bilibili.com". The first time, an Edge window pops up — **keep it open**, it's the AI's browser.

> ✅ No extra configuration needed. For login-required sites, log in once in the Edge window; the session persists in `~/.dsh/edge-profile` across restarts.

## What you can ask the AI

| You say | The AI does |
|---|---|
| open https://xxx | navigates (after SSRF checks) |
| what does this page say | reads the page content |
| click xxx / type xxx / back / screenshot | operates the page (gated by the permission hook) |
| log in to xxx | guides you to log in in the Edge window; the login persists |

## FAQ

**Can I close the Edge window?** Keep it open while the AI browses. If it gets closed anyway, the plugin relaunches it automatically (page state resets).

**Do logins survive restarts?** Yes — they live in `~/.dsh/edge-profile`.

**Which sites are blocked?** All public domains are allowed by default; private/loopback hosts (`localhost`, `192.168.x`, `10.x`, …) are blocked (SSRF protection).

**Custom allow/deny lists?** Edit the `web-permission` section of `$DSH_HOME/settings.yaml` (hot-reloaded, no restart) or `~/.dsh/profiles/web/cordis.patch.yml`.

**Uninstall?**

```sh
dsh plugin --profile web remove @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
```

## Packages

| Package | Role | What it does |
|---|---|---|
| `@yeesy369/dsh-browser` | Service Definition | Declares the `ctx.browser` seam (`BrowserRuntime` / `BrowserPage`). |
| `@yeesy369/dsh-browser-playwright` | Service Provider | Implements `ctx.browser` with Playwright: headed Edge, persistent profile, anti-detection, auto-relaunch. |
| `@yeesy369/dsh-tool-browser` | Consumer | Registers `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_back`, `browser_screenshot`. |
| `@yeesy369/dsh-web-permission` | Hook | Gates web/browser tools via `tools/pre-execute` (allowlist / denylist / ask). |

## Security model

- Only public `http(s)` URLs; private/loopback/link-local/cloud-metadata destinations are rejected (see `packages/browser-playwright/src/url-guard.ts`).
- The permission gate defaults to `allow` for hosts outside the allow/deny lists (`defaultAction: allow`); configure `allowHosts` / `denyHosts` / `gatedTools` as needed.
- Anti-detection has limits: very aggressive bot stacks may still fingerprint automation — a known boundary.

## Configuration

`@yeesy369/dsh-web-permission` reads from `$DSH_HOME/settings.yaml` (hot-reloaded — edit without restarting `dsh`):

```yaml
web-permission:
  allowHosts:
    - example.com
  denyHosts:
    - evil.com
  defaultAction: allow   # or ask
  gatedTools:
    - browser_navigate
    - web_fetch
```

- `allowHosts` / `denyHosts` — hostname allowlist / denylist (denylist wins).
- `defaultAction` — behavior for hosts in neither list: `allow` (default) or `ask` (require approval).
- `gatedTools` — which model-facing tools the gate inspects.

The same fields can be set at composition time in `cordis.patch.yml`; the `settings.yaml` user layer overrides them without a restart.

## Background

`dsh` ships a **web access seam** (`ctx.web`: search + fetch) but no browser — no `ctx.browser` seam, no provider, no browser tools. This project closes that gap on a safe-by-default foundation:

1. **The shipped fetch backend is an SSRF primitive, disabled by default** (`dsh-web-fetch-http` defers private-network protection). `dsh-browser` makes navigation SSRF-safe from day one.
2. **There is no browser capability at all** in `dsh`.
3. **Web access has no authorization policy** in `dsh`'s built-in tools; `dsh-web-permission` adds allowlist / denylist / approval.

## Development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test          # unit tests (url-guard, permission policy)
pnpm test:e2e      # real headless Chromium; install first: pnpm playwright install chromium
```

See [docs/architecture.md](./docs/architecture.md) for the full design, [AGENTS.md](./AGENTS.md) for repository conventions, and [LICENSE](./LICENSE) for terms (MIT).
