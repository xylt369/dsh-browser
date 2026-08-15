/** dsh-browser-settings — node half. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import * as yaml from 'js-yaml'

/** Same `!!js` dialect dsh-app-boot uses, so patch files round-trip safely. */
const JsExpr = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  resolve: (data) => typeof data === 'string',
  construct: (data) => ({ __jsExpr: data }),
  predicate: (data) => data && typeof data === 'object' && '__jsExpr' in data,
  represent: (data) => data['__jsExpr'],
})
const schema = yaml.JSON_SCHEMA.extend(JsExpr)

const TARGET_ID = 'browser-playwright'

export const name = 'dsh-browser-settings'
/** Wait for the web server to be ready before registering the config route. */
export const inject = ['webServer']

function resolvePatchFile() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const profile = process.env.DSH_PROFILE || 'web'
  const direct = join(home, 'profiles', profile, 'cordis.patch.yml')
  if (existsSync(direct)) return direct
  const profilesDir = join(home, 'profiles')
  if (existsSync(profilesDir)) {
    for (const name of readdirSyncSafe(profilesDir)) {
      const candidate = join(profilesDir, name, 'cordis.patch.yml')
      if (!existsSync(candidate)) continue
      try {
        const list = readEntries(candidate)
        if (list.some((entry) => entry && typeof entry === 'object' && entry.id === TARGET_ID)) {
          return candidate
        }
      } catch {
        /* try next profile */
      }
    }
  }
  return direct
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

function readEntries(file) {
  const text = readFileSync(file, 'utf8')
  const data = yaml.load(text, { schema })
  return Array.isArray(data) ? data : []
}

function writeEntries(file, entries) {
  const text = yaml.dump(entries, { schema, noRefs: true })
  writeFileSync(file, text)
}

function findEntry(entries, id) {
  return entries.find((entry) => entry && typeof entry === 'object' && entry.id === id)
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (!webServer) return
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-browser-settings/config',
    handler: (req, res) => {
      const respond = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      try {
        const file = resolvePatchFile()
        if (req.method === 'GET') {
          const entries = readEntries(file)
          const entry = findEntry(entries, TARGET_ID)
          const config = entry && entry.config ? entry.config : {}
          respond(200, {
            ok: true,
            configured: Boolean(entry),
            config: {
              windowVisibility: config.windowVisibility ?? 'visible',
              stealth: config.stealth !== false,
            },
            file,
          })
        } else if (req.method === 'POST') {
          let raw = ''
          req.on('data', (chunk) => {
            raw += chunk
          })
          req.on('end', () => {
            try {
              const body = JSON.parse(raw || '{}')
              const entries = readEntries(file)
              let entry = findEntry(entries, TARGET_ID)
              if (!entry) {
                entry = { id: TARGET_ID, name: '@yeesy369/dsh-browser-playwright', config: {} }
                entries.push(entry)
              }
              entry.config = entry.config && typeof entry.config === 'object' ? entry.config : {}
              if (body.windowVisibility !== undefined) entry.config.windowVisibility = body.windowVisibility
              if (body.stealth !== undefined) entry.config.stealth = Boolean(body.stealth)
              writeEntries(file, entries)
              respond(200, { ok: true, config: entry.config, file })
            } catch (error) {
              respond(500, { ok: false, error: String(error && error.message ? error.message : error) })
            }
          })
        } else {
          respond(405, { ok: false, error: 'method not allowed' })
        }
      } catch (error) {
        respond(500, { ok: false, error: String(error && error.message ? error.message : error) })
      }
    },
  }), 'dsh-browser-settings: config route')
}
