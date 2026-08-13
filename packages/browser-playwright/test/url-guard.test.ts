import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createUrlGuard, isPrivateIPv4, isPrivateIPv6 } from '../src/url-guard.ts'

test('isPrivateIPv4 flags private, link-local, and multicast ranges', () => {
  assert.equal(isPrivateIPv4('127.0.0.1'), true)
  assert.equal(isPrivateIPv4('10.0.0.1'), true)
  assert.equal(isPrivateIPv4('172.16.0.1'), true)
  assert.equal(isPrivateIPv4('192.168.1.1'), true)
  assert.equal(isPrivateIPv4('169.254.169.254'), true)
  assert.equal(isPrivateIPv4('100.64.0.1'), true)
  assert.equal(isPrivateIPv4('8.8.8.8'), false)
  assert.equal(isPrivateIPv4('1.1.1.1'), false)
})

test('isPrivateIPv6 flags loopback, ULA, link-local, and multicast', () => {
  assert.equal(isPrivateIPv6('::1'), true)
  assert.equal(isPrivateIPv6('fc00::1'), true)
  assert.equal(isPrivateIPv6('fe80::1'), true)
  assert.equal(isPrivateIPv6('ff02::1'), true)
  assert.equal(isPrivateIPv6('2606:4700:4700::1111'), false)
})

test('guard rejects non-http(s) schemes and embedded credentials', async () => {
  const guard = createUrlGuard()
  await assert.rejects(() => guard.assertPublicHttpUrl('ftp://example.com'), { code: 'WEB_INVALID_URL' })
  await assert.rejects(() => guard.assertPublicHttpUrl('https://user:pass@example.com'), { code: 'WEB_BLOCKED_URL' })
})

test('guard rejects private IP literals', async () => {
  const guard = createUrlGuard()
  await assert.rejects(() => guard.assertPublicHttpUrl('http://127.0.0.1/'), { code: 'WEB_PRIVATE_TARGET' })
  await assert.rejects(() => guard.assertPublicHttpUrl('http://169.254.169.254/latest/meta-data'), { code: 'WEB_PRIVATE_TARGET' })
})
