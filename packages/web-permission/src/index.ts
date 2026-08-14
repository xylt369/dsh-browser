/** Permission gate for web and browser tools. @module dsh-web-permission */

import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'
import { decideHost, hostnameOf } from './policy.js'

export const name = 'web-permission'

export interface Config {
  allowHosts: string[]
  denyHosts: string[]
  gatedTools: string[]
  defaultAction: 'allow' | 'ask'
}

export const Config: Schema<Config> = Schema.object({
  allowHosts: Schema.array(String).default([]),
  denyHosts: Schema.array(String).default(['localhost', 'metadata.google.internal']),
  gatedTools: Schema.array(String).default(['browser_navigate', 'browser_click', 'browser_type', 'web_fetch']),
  defaultAction: Schema.union(['allow', 'ask']).default('allow'),
})

export function apply(ctx: Context, config: Config): void {
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!config.gatedTools.includes(exec.name)) return next()
    const host = hostnameOf(exec.arguments)
    if (!host) return next()

    const decision = decideHost(config, host)
    if (decision === 'deny') {
      return { kind: 'deny', reason: `Host ${host} is denied by web-permission.` }
    }
    if (decision === 'ask') {
      return { kind: 'ask', reason: `Allow web access to ${host}?` }
    }
    return next()
  })
}
