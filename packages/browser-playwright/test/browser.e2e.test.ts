import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { PlaywrightBrowserRuntime } from '../src/index.ts'

function tempProfile(): string {
  return mkdtempSync(join(tmpdir(), 'dsh-e2e-'))
}

test('provider navigates, snapshots, screenshots, and blocks private targets end-to-end', async () => {
  const ctx = new Context()
  const fiber = await ctx.plugin(PlaywrightBrowserRuntime)
  const browser = ctx.browser

  try {
    const page = await browser.newPage({ headless: true, profileDir: tempProfile() })

    const result = await page.navigate('https://example.com/')
    assert.equal(result.statusCode, 200)
    assert.ok(result.title?.toLowerCase().includes('example'), `unexpected title: ${result.title}`)

    const snap = await page.snapshot()
    assert.ok(snap.text.length > 0, 'snapshot text is empty')
    assert.ok(snap.text.toLowerCase().includes('example'), 'snapshot does not mention the page content')
    assert.ok(snap.refs.length > 0, 'snapshot should expose actionable refs')

    const shot = await page.screenshot()
    assert.ok(shot.data.length > 0, 'screenshot is empty')
    assert.ok(shot.width > 0 && shot.height > 0, 'screenshot has no dimensions')

    const title = await page.evaluate<string>('document.title')
    assert.ok(title.toLowerCase().includes('example'), 'evaluate should return the page title')

    const clicked = await page.click(snap.refs[0])
    assert.equal(clicked.ok, true, 'click by aria ref should succeed')

    await assert.rejects(
      () => page.navigate('http://127.0.0.1/'),
      (err: unknown) => (err as { code?: string }).code === 'WEB_PRIVATE_TARGET',
    )

  } finally {
    await fiber.dispose()
  }
})

test('provider reuses the launch tab and recreates a page after close', async () => {
  const ctx = new Context()
  const fiber = await ctx.plugin(PlaywrightBrowserRuntime)
  const browser = ctx.browser

  try {
    const first = await browser.newPage({ headless: true, profileDir: tempProfile() })
    const second = await browser.newPage()
    assert.equal(second.id, first.id, 'newPage should reuse the existing tab instead of opening a blank one')

    await first.close()
    const recreated = await browser.newPage()
    assert.ok(recreated.id, 'newPage should recreate a page after the previous one closed')
    assert.notEqual(recreated.id, first.id)
  } finally {
    await fiber.dispose()
  }
})
