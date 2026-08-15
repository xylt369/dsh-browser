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

test('provider scrolls the page and reports offsets plus boundary state', async () => {
  const ctx = new Context()
  const fiber = await ctx.plugin(PlaywrightBrowserRuntime)
  const browser = ctx.browser

  try {
    const page = await browser.newPage({ headless: true, profileDir: tempProfile() })
    await page.navigate('https://example.com/')

    // example.com is short — give the page real scrollable height.
    await page.evaluate(`(() => {
      const div = document.createElement('div')
      div.style.height = '5000px'
      div.textContent = 'scroll-space'
      document.body.appendChild(div)
    })()`)

    const down = await page.scroll({ direction: 'down', amount: 800 })
    assert.equal(down.ok, true)
    assert.ok(down.scrollY > 0, `expected scrollY > 0 after scrolling down, got ${down.scrollY}`)
    assert.equal(down.scrollX, 0, 'vertical scroll should not change scrollX')
    assert.equal(down.atBoundary, false, 'should not be at the boundary after one 800px scroll')

    const up = await page.scroll({ direction: 'up', amount: 800 })
    assert.ok(up.scrollY < down.scrollY, `expected scrollY to decrease, got ${up.scrollY}`)

    const bottom = await page.scroll({ direction: 'down', amount: 100_000 })
    assert.equal(bottom.atBoundary, true, 'should report boundary when the page cannot scroll further')

    const top = await page.scroll({ direction: 'up', amount: 100_000 })
    assert.equal(top.atBoundary, true, 'should report boundary at the top of the page')
    assert.equal(top.scrollY, 0, 'should return to the top of the page')

    // Defaults: direction down, 800px.
    const def = await page.scroll()
    assert.ok(def.scrollY >= 800, `default scroll should move 800px, got ${def.scrollY}`)
    assert.equal(def.atBoundary, false, 'default scroll should not hit the boundary')
  } finally {
    await fiber.dispose()
  }
})

test('provider launches headless with stealth and hides automation markers', async () => {
  const ctx = new Context()
  const fiber = await ctx.plugin(PlaywrightBrowserRuntime)
  const browser = ctx.browser

  try {
    const page = await browser.newPage({ windowVisibility: 'headless', profileDir: tempProfile() })
    await page.navigate('https://example.com/')

    const webdriver = await page.evaluate<unknown>('navigator.webdriver')
    assert.equal(webdriver, undefined, 'navigator.webdriver must be hidden by stealth')

    const plugins = await page.evaluate<number>('navigator.plugins.length')
    assert.ok(plugins > 0, 'stealth should expose plugins in headless mode')

    const notification = await page.evaluate<{ state: string }>(
      'navigator.permissions.query({ name: "notifications" })',
    )
    assert.equal(notification.state, 'prompt', 'headless should fake a promptable notifications permission')
  } finally {
    await fiber.dispose()
  }
})

test('provider supports hidden-window mode (skipped on CI)', async (t) => {
  if (process.env.CI) {
    t.skip('hidden window mode needs a desktop session')
    return
  }
  const ctx = new Context()
  const fiber = await ctx.plugin(PlaywrightBrowserRuntime)
  const browser = ctx.browser

  try {
    const page = await browser.newPage({ windowVisibility: 'hidden', profileDir: tempProfile() })
    const result = await page.navigate('https://example.com/')
    assert.equal(result.statusCode, 200, 'hidden-window browser should navigate like a normal browser')
    const snap = await page.snapshot()
    assert.ok(snap.text.toLowerCase().includes('example'))
  } finally {
    await fiber.dispose()
  }
})
