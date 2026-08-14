import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as gate from '../src/index.ts'

test('web-permission gate denies, allows, and asks through the real waterfall', async () => {
  const ctx = new Context()
  await ctx.plugin(
    { name: gate.name, Config: gate.Config, apply: gate.apply },
    {
      allowHosts: ['example.com'],
      denyHosts: ['evil.com'],
      gatedTools: ['browser_navigate'],
    },
  )

  const run = (name: string, args: unknown) =>
    ctx.waterfall('tools/pre-execute', { name, arguments: args }, () => Promise.resolve({ kind: 'allow' as const }))

  const deny = await run('browser_navigate', { url: 'https://evil.com/' })
  assert.equal(deny.kind, 'deny')

  const allow = await run('browser_navigate', { url: 'https://example.com/' })
  assert.equal(allow.kind, 'allow')

  const ask = await run('browser_navigate', { url: 'https://unknown.com/' })
  assert.equal(ask.kind, 'ask')

  const passthrough = await run('browser_snapshot', {})
  assert.equal(passthrough.kind, 'allow')
})
