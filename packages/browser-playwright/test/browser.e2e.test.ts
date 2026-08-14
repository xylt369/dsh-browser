import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { PlaywrightBrowserRuntime } from '../src/index.ts'

test('provider navigates, snapshots, screenshots, and blocks private targets end-to-end', async () => {
  const ctx = new Context()
  const fiber = await ctx.plugin(PlaywrightBrowserRuntime)
  const browser = ctx.browser

  try {
    const page = await browser.newPage()

    const result = await page.navigate('https://example.com/')
    assert.equal(result.statusCode, 200)
    assert.ok(result.title?.toLowerCase().includes('example'), `unexpected title: ${result.title}`)

    const snap = await page.snapshot()
    assert.ok(snap.text.length > 0, 'snapshot text is empty')
    assert.ok(snap.text.toLowerCase().includes('example'), 'snapshot does not mention the page content')

    const shot = await page.screenshot()
    assert.ok(shot.data.length > 0, 'screenshot is empty')
    assert.ok(shot.width > 0 && shot.height > 0, 'screenshot has no dimensions')

    await assert.rejects(
      () => page.navigate('http://127.0.0.1/'),
      (err: unknown) => (err as { code?: string }).code === 'WEB_PRIVATE_TARGET',
    )

  } finally {
    await fiber.dispose()
  }
})
