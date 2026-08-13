/** SSRF-safe URL validation for browser navigation. @module dsh-browser-playwright/url-guard */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export class UrlGuardError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'UrlGuardError'
  }
}

const DEFAULT_BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'metadata',
  'metadata.google.internal',
])

/** Returns true when an IPv4 address is private, link-local, loopback, multicast, or reserved. */
export function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.')
  if (parts.length !== 4) return true
  const octets = parts.map((p) => Number(p))
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b, c] = octets
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a === 169 && b === 254) return true // link-local
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true // IETF / TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true // benchmark
  if (a === 198 && b === 51 && c === 100) return true // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true // TEST-NET-3
  if (a >= 224) return true // multicast + reserved 240/4
  return false
}

/** Returns true when an IPv6 address is loopback, ULA, link-local, multicast, or otherwise non-public. */
export function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA fc00::/7
  if (/^fe[89ab]/.test(lower)) return true // link-local fe80::/10
  if (lower.startsWith('ff')) return true // multicast
  if (lower.startsWith('2001:db8')) return true // documentation
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.slice('::ffff:'.length))
  return false
}

function isPrivateAddress(addr: string, family: number): boolean {
  return family === 4 ? isPrivateIPv4(addr) : isPrivateIPv6(addr)
}

export interface UrlGuardOptions {
  /** Allow private targets; never enable in a deployment that can reach sensitive internal hosts. */
  allowPrivate?: boolean
  blockedHostnames?: ReadonlySet<string>
}

export interface UrlGuard {
  /** Validate `raw` and return the parsed URL. Resolves DNS and rejects non-public targets when `allowPrivate` is false. */
  assertPublicHttpUrl(raw: string): Promise<URL>
}

/**
 * Build a URL guard with defense-in-depth against SSRF:
 * scheme/credential checks, hostname blocklist, IP-literal screening, and
 * resolve-then-validate DNS checking. A residual TOCTOU remains between the
 * DNS check and the provider's own connection because Playwright owns the
 * network stack; a proxy or host-resolver pin is the documented follow-up.
 */
export function createUrlGuard(options: UrlGuardOptions = {}): UrlGuard {
  const allowPrivate = options.allowPrivate ?? false
  const blocked = options.blockedHostnames ?? DEFAULT_BLOCKED_HOSTNAMES

  function parse(raw: string): URL {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new UrlGuardError('WEB_INVALID_URL', `Invalid URL: ${raw}`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new UrlGuardError('WEB_INVALID_URL', `Only http(s) URLs are allowed: ${raw}`)
    }
    if (url.username || url.password) {
      throw new UrlGuardError('WEB_BLOCKED_URL', 'URLs with embedded credentials are blocked')
    }
    return url
  }

  function hostnameFor(url: URL): string {
    return url.hostname.replace(/^\[|\]$/g, '')
  }

  return {
    async assertPublicHttpUrl(raw: string): Promise<URL> {
      const url = parse(raw)
      const host = hostnameFor(url).toLowerCase()
      if (blocked.has(host)) {
        throw new UrlGuardError('WEB_BLOCKED_URL', `Hostname is blocked: ${host}`)
      }
      const literalFamily = isIP(host)
      if (literalFamily !== 0) {
        if (!allowPrivate && isPrivateAddress(host, literalFamily)) {
          throw new UrlGuardError('WEB_PRIVATE_TARGET', `Non-public IP literal is blocked: ${host}`)
        }
        return url
      }
      if (allowPrivate) return url

      let resolved
      try {
        resolved = await lookup(host, { all: true })
      } catch (cause) {
        throw new UrlGuardError('WEB_PROVIDER_ERROR', `DNS resolution failed for ${host}`, { cause })
      }
      for (const entry of resolved) {
        if (isPrivateAddress(entry.address, entry.family)) {
          throw new UrlGuardError('WEB_PRIVATE_TARGET', `Hostname resolves to a non-public address: ${host}`)
        }
      }
      return url
    },
  }
}
