/** Playwright provider for the browser capability seam. @module dsh-browser-playwright */

import type { Context } from '@deepseek-ai/cordis'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import {
  BrowserError,
  BrowserRuntime,
  type BrowserActionResult,
  type BrowserNavigateResult,
  type BrowserPage,
  type BrowserPageOptions,
  type BrowserScreenshot,
  type BrowserSnapshot,
} from '@yeesy369/dsh-browser'
import { createUrlGuard, type UrlGuard } from './url-guard.js'

// Anti-detection: a custom automation User-Agent is a dead giveaway, so we let
// Playwright use its realistic per-version Chrome UA and only strip automation
// markers below. Serious anti-bot stacks may still fingerprint the TLS/browser
// layer; see README for the honest limits.
const CHROME_ARGS = ['--disable-blink-features=AutomationControlled']
const INIT_SCRIPT = "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"

/**
 * Prefer a locally installed real browser — Microsoft Edge first (the default
 * for this provider), then Chrome; fall back to the bundled Chromium when
 * neither is installed.
 */
function findBrowserChannel(): 'msedge' | 'chrome' | undefined {
  const candidates: Array<['msedge' | 'chrome', string[]]> = []
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES
    const pf86 = process.env['PROGRAMFILES(X86)']
    const local = process.env.LOCALAPPDATA
    candidates.push(
      ['msedge', [
        pf86 && `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
        pf && `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ].filter((p): p is string => Boolean(p))],
      ['chrome', [
        pf && `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
        local && `${local}\\Google\\Chrome\\Application\\chrome.exe`,
        pf86 && `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
      ].filter((p): p is string => Boolean(p))],
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      ['msedge', ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']],
      ['chrome', ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']],
    )
  } else {
    candidates.push(
      ['msedge', ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable']],
      ['chrome', ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']],
    )
  }
  for (const [channel, paths] of candidates) {
    for (const path of paths) {
      if (existsSync(path)) return channel
    }
  }
  return undefined
}

export const name = 'browser-playwright'

export function apply(ctx: Context): void {
  ctx.plugin(PlaywrightBrowserRuntime)
}

class PlaywrightBrowserRuntime extends BrowserRuntime {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private pageId: string | null = null
  private nextPageId = 0
  private readonly guard: UrlGuard

  constructor(ctx: Context) {
    super(ctx)
    this.guard = createUrlGuard({ allowPrivate: false })
    // Tie the browser lifecycle to this plugin's fiber: unloading closes the browser.
    ctx.effect(() => () => this.close())
  }

  override async newPage(options?: BrowserPageOptions, _signal?: AbortSignal): Promise<BrowserPage> {
    try {
      await this.ensureBrowser(options)
      if (!this.page || this.page.isClosed()) {
        this.page = await this.acquirePage()
        this.pageId = `page-${this.nextPageId++}`
      }
    } catch {
      // The window was closed under us (user closed it, crash, or idle
      // teardown): reset state and relaunch once so the next call works.
      await this.close()
      await this.ensureBrowser(options)
      this.page = await this.acquirePage()
      this.pageId = `page-${this.nextPageId++}`
    }
    return new PlaywrightBrowserPage(this.page, this.guard, this.pageId!)
  }

  /**
   * Reuse the first open tab instead of always creating a new one. On launch
   * the browser already opens one (about:blank) tab — creating another one
   * leaves a blank tab behind every time the browser (re)starts.
   */
  private async acquirePage(): Promise<Page> {
    const existing = this.context!.pages().find((p) => !p.isClosed())
    return existing ?? (await this.context!.newPage())
  }

  override async close(_signal?: AbortSignal): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close()
      } else if (this.context) {
        await this.context.close()
      }
    } catch {
      // already closed — nothing to do
    }
    this.browser = null
    this.context = null
    this.page = null
    this.pageId = null
  }

  private async ensureBrowser(options?: BrowserPageOptions): Promise<void> {
    if (this.context && (!this.browser || this.browser.isConnected())) return
    // Real-user mode by default: headed, installed Edge (or Chrome), persistent
    // profile. A visible window opens on the user's desktop; cookies and logins
    // persist in the profile dir across sessions, and automation fingerprints
    // are reduced so anti-bot sites (bilibili, zhihu, ...) treat us like a
    // normal browser. Falls back to Playwright's bundled Chromium when no real
    // browser is installed.
    const headless = options?.headless ?? false
    const channel = options?.channel ?? findBrowserChannel()
    const profileDir = options?.profileDir ?? join(homedir(), '.dsh', 'edge-profile')
    const launchOptions = {
      headless,
      args: CHROME_ARGS,
      ...(channel ? { channel } : {}),
    }
    try {
      this.context = await chromium.launchPersistentContext(profileDir, {
        viewport: options?.viewport,
        ...launchOptions,
      })
      await this.context.addInitScript(INIT_SCRIPT)
    } catch (cause) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to launch a browser. Install Microsoft Edge (or Chrome), or run `pnpm playwright install chromium`.',
        { cause },
      )
    }
  }
}

class PlaywrightBrowserPage implements BrowserPage {
  private lastRefs: readonly string[] = []

  constructor(
    private readonly page: Page,
    private readonly guard: UrlGuard,
    readonly id: string,
  ) {}

  url(): string | null {
    return this.page.url() || null
  }

  async title(): Promise<string | null> {
    return (await this.page.title()) || null
  }

  async navigate(raw: string, _signal?: AbortSignal): Promise<BrowserNavigateResult> {
    const url = await this.guard.assertPublicHttpUrl(raw)
    const response = await this.page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 })
    return {
      url: this.page.url(),
      statusCode: response?.status() ?? null,
      title: (await this.page.title()) || null,
    }
  }

  async snapshot(_signal?: AbortSignal): Promise<BrowserSnapshot> {
    const text = await this.readSnapshot()
    this.lastRefs = extractAriaRefs(text)
    return { url: this.page.url(), text, refs: this.lastRefs }
  }

  async screenshot(_signal?: AbortSignal): Promise<BrowserScreenshot> {
    const data = await this.page.screenshot({ type: 'png', fullPage: false })
    const viewport = this.page.viewportSize()
    return {
      mediaType: 'image/png',
      data: new Uint8Array(data),
      width: viewport?.width ?? 0,
      height: viewport?.height ?? 0,
    }
  }

  async click(ref: string, _signal?: AbortSignal): Promise<BrowserActionResult> {
    const useAriaRef = this.lastRefs.includes(ref) || /^e\d+$/.test(ref)
    const locator = useAriaRef ? this.page.locator(`aria-ref=${ref}`) : this.page.locator(ref)
    await locator.click({ timeout: 30_000 })
    return { url: this.page.url(), ok: true }
  }

  async type(text: string, _signal?: AbortSignal): Promise<BrowserActionResult> {
    await this.page.keyboard.type(text)
    return { url: this.page.url(), ok: true }
  }

  async evaluate<T>(script: string, _signal?: AbortSignal): Promise<T> {
    return (await this.page.evaluate(script)) as T
  }

  async back(_signal?: AbortSignal): Promise<BrowserNavigateResult> {
    await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 })
    return { url: this.page.url(), statusCode: null, title: (await this.page.title()) || null }
  }

  async close(_signal?: AbortSignal): Promise<void> {
    await this.page.close()
  }

  private async readSnapshot(): Promise<string> {
    try {
      // `mode: 'ai'` includes actionable element references like `[ref=e2]`,
      // which is exactly what the model needs to click by ref.
      const aria = await this.page.locator('body').ariaSnapshot({ mode: 'ai' })
      if (aria && aria.trim()) return aria
    } catch {
      // fall through to innerText
    }
    const text = (await this.page.evaluate('document.body?.innerText ?? ""')) as string
    return text || ''
  }
}

/** Collect the actionable `ref` ids Playwright embeds in an aria snapshot. */
export function extractAriaRefs(text: string): string[] {
  const refs = new Set<string>()
  const re = /\[ref=([^\]]+)\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) refs.add(match[1])
  return [...refs]
}

export { PlaywrightBrowserRuntime }
