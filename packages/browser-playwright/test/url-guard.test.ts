import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createUrlGuard, isPrivateIPv4, isPrivateIPv6 } from '../src/url-guard.ts'

test('isPrivateIPv4 flags private, link-local, multicast, and reserved ranges', () => {
  const blocked = [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.0.2.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
  ]
  for (const ip of blocked) assert.equal(isPrivateIPv4(ip), true, ip)

  const public_ = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '192.1.0.1']
  for (const ip of public_) assert.equal(isPrivateIPv4(ip), false, ip)
})

test('isPrivateIPv6 flags loopback, ULA, link-local, multicast, documentation, and IPv4-mapped private', () => {
  const blocked = ['::', '::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1', '2001:db8::1', '::ffff:127.0.0.1']
  for (const ip of blocked) assert.equal(isPrivateIPv6(ip), true, ip)

  const public_ = ['2606:4700:4700::1111', '::ffff:8.8.8.8']
  for (const ip of public_) assert.equal(isPrivateIPv6(ip), false, ip)
})

test('guard rejects non-http(s) schemes', async () => {
  const guard = createUrlGuard()
  await assert.rejects(() => guard.assertPublicHttpUrl('ftp://example.com'), { code: 'WEB_INVALID_URL' })
  await assert.rejects(() => guard.assertPublicHttpUrl('javascript:alert(1)'), { code: 'WEB_INVALID_URL' })
  await assert.rejects(() => guard.assertPublicHttpUrl('file:///etc/passwd'), { code: 'WEB_INVALID_URL' })
  await assert.rejects(() => guard.assertPublicHttpUrl('not a url'), { code: 'WEB_INVALID_URL' })
})

test('guard rejects URLs with embedded credentials', async () => {
  const guard = createUrlGuard()
  await assert.rejects(() => guard.assertPublicHttpUrl('https://user:pass@example.com'), { code: 'WEB_BLOCKED_URL' })
})

test('guard blocks known-sensitive hostnames before DNS', async () => {
  const guard = createUrlGuard()
  await assert.rejects(() => guard.assertPublicHttpUrl('http://localhost/'), { code: 'WEB_BLOCKED_URL' })
  await assert.rejects(() => guard.assertPublicHttpUrl('http://metadata.google.internal/'), { code: 'WEB_BLOCKED_URL' })
})

test('guard rejects private IP literals (IPv4, IPv6, IPv4-mapped)', async () => {
  const guard = createUrlGuard()
  await assert.rejects(() => guard.assertPublicHttpUrl('http://127.0.0.1/'), { code: 'WEB_PRIVATE_TARGET' })
  await assert.rejects(() => guard.assertPublicHttpUrl('http://169.254.169.254/latest/meta-data'), { code: 'WEB_PRIVATE_TARGET' })
  await assert.rejects(() => guard.assertPublicHttpUrl('http://10.0.0.1/'), { code: 'WEB_PRIVATE_TARGET' })
  await assert.rejects(() => guard.assertPublicHttpUrl('http://[::1]/'), { code: 'WEB_PRIVATE_TARGET' })
  await assert.rejects(() => guard.assertPublicHttpUrl('http://[::ffff:127.0.0.1]/'), { code: 'WEB_PRIVATE_TARGET' })
})

test('guard allows public IP literals', async () => {
  const guard = createUrlGuard()
  const url = await guard.assertPublicHttpUrl('https://1.1.1.1/')
  assert.equal(url.toString(), 'https://1.1.1.1/')
})

test('allowPrivate bypasses IP-literal and hostname screening', async () => {
  const guard = createUrlGuard({ allowPrivate: true })
  const url = await guard.assertPublicHttpUrl('http://127.0.0.1/')
  assert.equal(url.toString(), 'http://127.0.0.1/')
})
