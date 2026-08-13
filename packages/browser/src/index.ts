/** Service Definition for the browser capability seam. @module dsh-browser */

import { Service, type Context } from '@deepseek-ai/cordis'
import type { BrowserPage, BrowserPageOptions } from './types.ts'

export * from './types.ts'
export { BrowserError } from './error.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    browser: BrowserRuntime
  }
}

/**
 * The `ctx.browser` capability seam. One implementation per context; a
 * provider subclasses this service and is loaded as a plugin (the same pattern
 * as `ctx.subprocess`). Loading a second implementation throws.
 */
export abstract class BrowserRuntime extends Service {
  constructor(ctx: Context) {
    super(ctx, 'browser')
  }

  /** Open a page in this runtime's browser (the default page when one exists). */
  abstract newPage(options?: BrowserPageOptions, signal?: AbortSignal): Promise<BrowserPage>

  /** Release every browser resource owned by this runtime. */
  abstract close(signal?: AbortSignal): Promise<void>
}

export default BrowserRuntime
