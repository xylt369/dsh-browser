/** Model-facing browser tools over the `ctx.browser` seam. @module dsh-tool-browser */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { BrowserPage } from '@yeesy369/dsh-browser'
import Schema from '@deepseek-ai/schemastery'

export const name = 'tool-browser'
export const inject = ['tools', 'browser', 'attachments']

export interface Config {
  /** Expose the high-risk `browser_evaluate` tool (arbitrary page JS). Off by default. */
  evaluate: boolean
}

export const Config = Schema.object({
  evaluate: Schema.boolean().default(false),
})

export function apply(ctx: Context, config: Config): void {
  const { tools, browser, attachments } = ctx

  tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Open an HTTP(S) URL in the browser and report the resulting page title.',
    parameters: {
      url: { type: 'string', required: true, description: 'The HTTP(S) URL to open.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Opened ${value.url}${value.title ? ` — ${value.title}` : ''}`,
      }],
    },
    timeoutMs: 60_000,
    async execute(args, exec) {
      const page: BrowserPage = await browser.newPage(undefined, exec.signal)
      const result = await page.navigate(args.url, exec.signal)
      return { url: result.url, title: result.title ?? '' }
    },
  }))

  tools.register(defineTool({
    name: 'browser_snapshot',
    description: 'Return a compact accessibility snapshot of the current page.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', required: true },
          text: { type: 'string', required: true },
          refs: { type: 'array', items: { type: 'string' }, required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(_args, exec) {
      const page: BrowserPage = await browser.newPage(undefined, exec.signal)
      const snap = await page.snapshot(exec.signal)
      return { url: snap.url, text: snap.text, refs: [...snap.refs] }
    },
  }))

  tools.register(defineTool({
    name: 'browser_click',
    description: 'Click an element in the current page by accessibility ref (from browser_snapshot) or CSS selector.',
    parameters: {
      ref: { type: 'string', required: true, description: 'An accessibility ref (e.g. e1 from browser_snapshot) or CSS selector.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', required: true },
          ok: { type: 'boolean', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: `Clicked (ok=${value.ok}) at ${value.url}` }],
    },
    timeoutMs: 30_000,
    async execute(args, exec) {
      const page: BrowserPage = await browser.newPage(undefined, exec.signal)
      const result = await page.click(args.ref, exec.signal)
      return { url: result.url, ok: result.ok }
    },
  }))

  if (config.evaluate) {
    tools.register(defineTool({
      name: 'browser_evaluate',
      description: 'Run a raw JavaScript expression in the current page and return the JSON-serializable result. HIGH RISK: enable only when you trust the page and gate it behind approval.',
      parameters: {
        script: { type: 'string', required: true, description: 'The JavaScript expression to evaluate. Must return a JSON-serializable value.' },
      },
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
      },
      timeoutMs: 30_000,
      async execute(args, exec) {
        const page: BrowserPage = await browser.newPage(undefined, exec.signal)
        return (await page.evaluate(args.script, exec.signal)) as JsonValue
      },
    }))
  }

  tools.register(defineTool({
    name: 'browser_type',
    description: 'Type text into the currently focused element of the page.',
    parameters: {
      text: { type: 'string', required: true, description: 'Text to type.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', required: true },
          ok: { type: 'boolean', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: `Typed (ok=${value.ok}) at ${value.url}` }],
    },
    timeoutMs: 30_000,
    async execute(args, exec) {
      const page: BrowserPage = await browser.newPage(undefined, exec.signal)
      const result = await page.type(args.text, exec.signal)
      return { url: result.url, ok: result.ok }
    },
  }))

  tools.register(defineTool({
    name: 'browser_back',
    description: 'Navigate the current page back in history.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        properties: {
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Went back to ${value.url}${value.title ? ` — ${value.title}` : ''}`,
      }],
    },
    timeoutMs: 60_000,
    async execute(_args, exec) {
      const page: BrowserPage = await browser.newPage(undefined, exec.signal)
      const result = await page.back(exec.signal)
      return { url: result.url, title: result.title ?? '' }
    },
  }))

  tools.register(defineTool({
    name: 'browser_screenshot',
    description: 'Capture a screenshot of the current page and store it as an image attachment.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        properties: {
          attachmentId: { type: 'string', required: true },
          mediaType: { type: 'string', required: true },
          bytes: { type: 'number', required: true },
          width: { type: 'number', required: true },
          height: { type: 'number', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Screenshot captured (${value.width}×${value.height}, ${value.bytes} bytes, ${value.mediaType}).`,
      }],
    },
    async execute(_args, exec) {
      const page: BrowserPage = await browser.newPage(undefined, exec.signal)
      const shot = await page.screenshot(exec.signal)
      const ref: ImageAttachmentRef = await attachments.saveImage({
        data: shot.data,
        mediaType: shot.mediaType,
        name: `browser-${Date.now()}.png`,
      })
      return {
        attachmentId: ref.attachmentId,
        mediaType: ref.mediaType,
        bytes: ref.bytes,
        width: ref.width,
        height: ref.height,
      }
    },
  }))
}
