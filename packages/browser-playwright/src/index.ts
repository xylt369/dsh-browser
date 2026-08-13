/** Playwright provider for the browser capability seam. @module dsh-browser-playwright */

import type { Context } from '@deepseek-ai/cordis'
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
} from 'dsh-browser'
import { createUrlGuard, type UrlGuard } from './url-guard.js'

const USER_AGENT = 'dsh-browser/0.1 (+https://github.com/xylt369/dsh-browser)'

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
  }

  override async newPage(options?: BrowserPageOptions, _signal?: AbortSignal): Promise<BrowserPage> {
    await this.ensureBrowser(options)
    if (!this.page) {
      this.page = await this.context!.newPage()
      this.pageId = `page-${this.nextPageId++}`
    }
    return new PlaywrightBrowserPage(this.page, this.guard, this.pageId!)
  }

  override async close(_signal?: AbortSignal): Promise<void> {
    if (this.context) {
      await this.context.close()
      this.context = null
      this.browser = null
    } else if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    this.page = null
    this.pageId = null
  }

  private async ensureBrowser(options?: BrowserPageOptions): Promise<void> {
    if (this.context) return
    const headless = options?.headless ?? true
    try {
      if (options?.profileDir) {
        this.context = await chromium.launchPersistentContext(options.profileDir, {
          headless,
          viewport: options.viewport,
          userAgent: USER_AGENT,
        })
      } else {
        this.browser = await chromium.launch({ headless })
        this.context = await this.browser.newContext({
          viewport: options?.viewport,
          userAgent: USER_AGENT,
        })
      }
    } catch (cause) {
      throw new BrowserError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to launch Chromium. Install the browser with `pnpm playwright install chromium`.',
        { cause },
      )
    }
  }
}

class PlaywrightBrowserPage implements BrowserPage {
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
    return { url: this.page.url(), text: await this.readSnapshot(), refs: [] }
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
    await this.page.click(ref, { timeout: 30_000 })
    return { url: this.page.url(), ok: true }
  }

  async type(text: string, _signal?: AbortSignal): Promise<BrowserActionResult> {
    await this.page.keyboard.type(text)
    return { url: this.page.url(), ok: true }
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
      const aria = await this.page.locator('body').ariaSnapshot()
      if (aria && aria.trim()) return aria
    } catch {
      // fall through to innerText
    }
    const text = (await this.page.evaluate('document.body?.innerText ?? ""')) as string
    return text || ''
  }
}

export { PlaywrightBrowserRuntime }
