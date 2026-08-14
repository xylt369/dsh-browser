/** Pure policy logic for the web permission gate. @module dsh-web-permission/policy */

export type HostDecision = 'allow' | 'deny' | 'ask'

/** Extract the hostname from a tool argument object that carries a `url` string. */
export function hostnameOf(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null
  const url = (args as { url?: unknown }).url
  if (typeof url !== 'string') return null
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return null
  }
}

/** Decide how to treat a host: denylist wins, then allowlist, otherwise ask. */
export function decideHost(
  config: { allowHosts: readonly string[]; denyHosts: readonly string[] },
  host: string,
): HostDecision {
  const h = host.toLowerCase()
  if (config.denyHosts.includes(h)) return 'deny'
  if (config.allowHosts.includes(h)) return 'allow'
  return 'ask'
}
