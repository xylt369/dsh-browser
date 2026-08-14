import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decideHost, hostnameOf } from '../src/policy.ts'

test('hostnameOf extracts hostnames and rejects non-URL arguments', () => {
  assert.equal(hostnameOf({ url: 'https://example.com/foo?bar=1' }), 'example.com')
  assert.equal(hostnameOf({ url: 'http://[::1]/' }), '::1')
  assert.equal(hostnameOf({ url: 'http://EXAMPLE.com/' }), 'example.com')
  assert.equal(hostnameOf({ url: 'not a url' }), null)
  assert.equal(hostnameOf({}), null)
  assert.equal(hostnameOf(null), null)
})

test('decideHost applies denylist first, then allowlist, then asks', () => {
  const config = { allowHosts: ['example.com'], denyHosts: ['evil.com'], defaultAction: 'ask' as const }
  assert.equal(decideHost(config, 'evil.com'), 'deny')
  assert.equal(decideHost(config, 'example.com'), 'allow')
  assert.equal(decideHost(config, 'unknown.com'), 'ask')
})

test('decideHost defaults to allow for unknown hosts when defaultAction is allow', () => {
  const config = { allowHosts: [], denyHosts: ['evil.com'], defaultAction: 'allow' as const }
  assert.equal(decideHost(config, 'evil.com'), 'deny')
  assert.equal(decideHost(config, 'example.com'), 'allow')
})
