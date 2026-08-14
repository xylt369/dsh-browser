/** Browser capability vocabulary. @module dsh-browser/types */

/** Options for opening a page in a browser runtime. */
export interface BrowserPageOptions {
  /** Persistent profile directory for cross-session login state. */
  profileDir?: string
  /** Run headless; providers may default to headless. */
  headless?: boolean
  /** Preferred viewport size. */
  viewport?: { width: number; height: number }
  /** Use a locally installed real browser channel instead of the bundled Chromium. */
  channel?: 'chrome' | 'msedge'
}

/** Result of navigating a page to a URL. */
export interface BrowserNavigateResult {
  url: string
  statusCode: number | null
  title: string | null
}

/**
 * Compact, model-friendly page representation. `text` is derived from the
 * accessibility tree (or body text as a fallback) rather than raw HTML, so the
 * model receives a low-token, actionable view of the page.
 */
export interface BrowserSnapshot {
  url: string
  text: string
  /** Actionable element references. Parsed from the accessibility tree; empty until that mapping lands. */
  refs: readonly string[]
}

/** An encoded screenshot produced by the page. */
export interface BrowserScreenshot {
  mediaType: 'image/png' | 'image/jpeg'
  data: Uint8Array
  width: number
  height: number
}

/** Result of an in-page action such as click or type. */
export interface BrowserActionResult {
  url: string
  ok: boolean
  detail?: string
}

/** A live page inside one browser context. */
export interface BrowserPage {
  readonly id: string
  url(): string | null
  title(): Promise<string | null>
  navigate(url: string, signal?: AbortSignal): Promise<BrowserNavigateResult>
  snapshot(signal?: AbortSignal): Promise<BrowserSnapshot>
  screenshot(signal?: AbortSignal): Promise<BrowserScreenshot>
  click(ref: string, signal?: AbortSignal): Promise<BrowserActionResult>
  type(text: string, signal?: AbortSignal): Promise<BrowserActionResult>
  /** Run a raw JavaScript expression in the page. High-risk: expose only behind approval. */
  evaluate<T>(script: string, signal?: AbortSignal): Promise<T>
  back(signal?: AbortSignal): Promise<BrowserNavigateResult>
  close(signal?: AbortSignal): Promise<void>
}
