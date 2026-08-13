/** Playwright provider for the browser capability seam. @module dsh-browser-playwright */

import type { Context } from '@deepseek-ai/cordis'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import {
  BrowserRuntime,
  type BrowserActionResult,
  type BrowserNavigateResult,
  type BrowserPage,
  type BrowserPageOptions,
  type BrowserScreenshot,
  type BrowserSnapshot,
} from 'dsh-browser'
import { createUrlGuard, type UrlGuard } from './url-guard.ts'

export const name = 'browser-playwright'

export function apply(ctx: Context): void {
  ctx.plugin(PlaywrightBrowserRuntime)
}

class PlaywrightBrowserRuntime extends BrowserRuntime {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private readonly guard: UrlGuard

  constructor(ctx: Context) {
    super(ctx)
    this.guard = createUrlGuard({ allowPrivate: false })
  }

  override async newPage(options?: BrowserPageOptions, _signal?: AbortSignal): Promise<BrowserPage> {
    await this.ensureBrowser(options)
    const page = (this.page ??= await this.context!.newPage())
    return new PlaywrightBrowserPage(page, this.guard)
  }

  override async close(_signal?: AbortSignal): Promise<void> {
    await this.browser?.close()
    this.browser = null
    this.context = null
    this.page = null
  }

  private async ensureBrowser(options?: BrowserPageOptions): Promise<void> {
    if (this.browser && this.context) return
    this.browser = await chromium.launch({ headless: options?.headless ?? true })
    this.context = await this.browser.newContext({
      viewport: options?.viewport,
      ...(options?.profileDir ? { storageState: undefined } : {}),
      userAgent: 'dsh-browser/0.1 (+https://github.com/xylt369/dsh-browser)',
    })
  }
}

class PlaywrightBrowserPage implements BrowserPage {
  constructor(
    private readonly page: Page,
    private readonly guard: UrlGuard,
  ) {}

  get id(): string {
    return `page-${this.page.context().pages().indexOf(this.page)}`
  }

  url(): string | null {
    return this.page.url() || null
  }

  async title(): Promise<string | null> {
    return (await this.page.title()) || null
  }

  async navigate(raw: string, signal?: AbortSignal): Promise<BrowserNavigateResult> {
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
    return { url: this.page.url(), text, refs: [] }
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
    return {
      url: this.page.url(),
      statusCode: null,
      title: (await this.page.title()) || null,
    }
  }

  async close(_signal?: AbortSignal): Promise<void> {
    await this.page.close()
  }

  private async readSnapshot(): Promise<string> {
    try {
      const body = this.page.locator('body')
      const aria = await body.ariaSnapshot()
      if (aria && aria.trim()) return aria
    } catch {
      // fall through to innerText
    }
    return (await this.page.evaluate(() => document.body?.innerText ?? '')) || ''
  }
}

export { PlaywrightBrowserRuntime }
