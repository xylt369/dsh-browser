# dsh-browser 🦊

English | [中文](README.md)

Browser capability for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`): open real web pages, read content, click, type, and screenshot — powered by your local Microsoft Edge.

`dsh` ships filesystem, shell, search, and fetch primitives, but **no browser**. This repository adds the missing browser capability as `dsh`-style packages (Service Definition / Provider / Consumer), in **real-user mode by default**: headed Edge, a persistent profile, and reduced automation fingerprints — so even anti-bot sites like bilibili and zhihu work.

## Quick start (3 steps)

**Step 0 — Check whether `dsh` is installed** (one-time only; skip if already done)

Open a terminal (Windows: press `Win + R`, type `cmd`, press Enter) and run:

```sh
dsh --version
```

- ✅ **It prints a version** (e.g. `0.1.0-rc.6`) → `dsh` is ready; go to Step 1.
- ❌ **"dsh: command not found"** (or "不是内部或外部命令" on Windows) → install it either way:

  **Option A · Install from the command line** (copy-paste and run):

  ```sh
  npm i -g @deepseek-ai/dsh
  ```

  **Option B · Install from the website**: open https://www.npmjs.com/package/@deepseek-ai/dsh and follow the install command on the page.

  After installing, **open a NEW terminal window**, run `dsh --version` again, and continue once it prints a version.

> 💡 Prefer not to install anything? You can replace `dsh` with `npx @deepseek-ai/dsh` in every command below (same result, runs from a temporary cache).

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

**Want to use `browser_evaluate` (run JS in the page)?** It is disabled by default; see the `browser_evaluate` config example under "Advanced configuration".

**Uninstall?**

```sh
dsh plugin --profile web remove @yeesy369/dsh-browser-playwright @yeesy369/dsh-tool-browser @yeesy369/dsh-web-permission
```

## Packages

| Package | Role | What it does |
|---|---|---|
| `@yeesy369/dsh-browser` | Service Definition | Declares the `ctx.browser` seam (`BrowserRuntime` / `BrowserPage`). |
| `@yeesy369/dsh-browser-playwright` | Service Provider | Implements `ctx.browser` with Playwright: three window modes (visible / hidden / headless), persistent profile, stealth patch, auto-relaunch. |
| `@yeesy369/dsh-tool-browser` | Consumer | Registers `browser_navigate`, `browser_snapshot` (returns actionable refs), `browser_click` (by ref or CSS), `browser_type`, `browser_scroll`, `browser_back`, `browser_screenshot`, optional `browser_evaluate`. |
| `@yeesy369/dsh-web-permission` | Hook | Gates web/browser tools via `tools/pre-execute` (allowlist / denylist / ask; `remember` persists grants). |

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
- `remember` — when `true` (default) with `defaultAction: 'ask'`, an approved host is appended to `allowHosts` automatically.

The same fields can be set at composition time in `cordis.patch.yml`; the `settings.yaml` user layer overrides them without a restart.

### Click by accessibility ref

`browser_snapshot` returns actionable `ref` ids (e.g. `e1`, `e2`). `browser_click(ref: "e1")` clicks by ref — more stable than hand-written CSS selectors — and CSS selectors still work.

### Scrolling long pages

`browser_scroll` lets the model page through long content (feeds, documents, comment threads): it scrolls 800px down by default, and accepts `direction: "up" | "down" | "left" | "right"` plus an `amount` in pixels. The result returns the new `scrollX` / `scrollY` and an `atBoundary` flag, so the model can stop scrolling once it hits the edge instead of looping pointlessly.

### browser_evaluate (high risk, off by default)

`browser_evaluate` runs arbitrary JavaScript in the page and is disabled by default. Enable it in the profile's `cordis.patch.yml`:

```yaml
- id: tool-browser
  config:
    evaluate: true
```

When enabled, tighten the permission gate — it is arbitrary code execution.

### Window modes and stealth

`browser-playwright`'s `windowVisibility` controls how the browser appears, and `stealth` toggles a lightweight anti-detection patch. Configure it in the dsh settings UI or directly in the profile:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: browser-playwright
  config:
    windowVisibility: hidden   # visible / hidden / headless; default visible
    stealth: true              # lightweight anti-detection patch; default on
```

| Mode | Pros | Cons |
|---|---|---|
| `visible` (default) | Real browser window — you can **log in manually, solve captchas**, see exactly what the model sees | Pops a window on your desktop on every use |
| `hidden` | Real browser (best anti-bot posture) with the window minimized and parked offscreen — **no desktop clutter** | No visible window to operate manually; logins must be done in the profile beforehand; needs a desktop session (not for servers/CI) |
| `headless` | No window at all; ideal for servers/CI | Even with `stealth`, aggressive bot stacks may still fingerprint automation; no manual login |

The `stealth` patch is a dependency-free implementation (removes `navigator.webdriver`, fakes plugins, masks the WebGL vendor, fixes the notifications permission, … — see `packages/browser-playwright/src/stealth.ts`). It is on by default; disable it if a rare site misbehaves. For deeper CDP-level patching, layer `rebrowser-patches` on top yourself.

## Background

`dsh` ships a **web access seam** (`ctx.web`: search + fetch) but no browser — no `ctx.browser` seam, no provider, no browser tools. This project closes that gap with **SSRF-safe navigation by default** — private/loopback/link-local/metadata destinations are blocked, while public hosts are allowed (the permission gate can tighten that to `ask`/allowlist):

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
