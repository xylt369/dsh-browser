import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import * as yaml from 'js-yaml'

const JsExpr = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  resolve: (data) => typeof data === 'string',
  construct: (data) => ({ __jsExpr: data }),
  predicate: (data) => data && typeof data === 'object' && '__jsExpr' in data,
  represent: (data) => data['__jsExpr'],
})
const schema = yaml.JSON_SCHEMA.extend(JsExpr)

function makeHome(fixture) {
  const home = mkdtempSync(join(tmpdir(), 'dsh-bs-test-'))
  const dir = join(home, 'profiles', 'web')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'cordis.patch.yml'), fixture)
  return home
}

function makeReq(method, body) {
  const req = new EventEmitter()
  req.method = method
  req.url = '/dsh-browser-settings/config'
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', body)
    req.emit('end')
  })
  return req
}

function makeRes() {
  const chunks = []
  return {
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(payload) {
      chunks.push(payload)
    },
    get json() {
      return JSON.parse(chunks.join(''))
    },
  }
}

const fixture = `# fixture patch
- id: web-permission
  config:
    allowHosts:
      - example.com
    gatedTools:
      - browser_click
- id: browser-playwright
  config:
    windowVisibility: headless
    stealth: true
- id: sample
  config:
    expr: !!js 'process.env.DSH_TEST_EXPR'
`

const home = makeHome(fixture)
process.env.DSH_HOME = home
process.env.DSH_PROFILE = 'web'

const { apply } = await import('./lib/index.js')

let captured
const fakeServer = {
  register(route) {
    captured = route
    return () => {}
  },
}
const ctx = {
  get(name) {
    return name === 'webServer' ? fakeServer : undefined
  },
  effect(fn) {
    fn()
    return () => {}
  },
}

apply(ctx)

// GET
const getRes = makeRes()
captured.handler(makeReq('GET'), getRes)
if (getRes.json.ok !== true) throw new Error('GET failed')
if (getRes.json.config.windowVisibility !== 'headless') throw new Error('GET windowVisibility wrong')
if (getRes.json.config.stealth !== true) throw new Error('GET stealth wrong')
if (getRes.json.configured !== true) throw new Error('GET configured wrong')
console.log('GET ok:', JSON.stringify(getRes.json.config))

// POST (change to hidden + stealth false)
const postRes = makeRes()
captured.handler(
  makeReq('POST', JSON.stringify({ windowVisibility: 'hidden', stealth: false })),
  postRes,
)
await new Promise((resolve) => setTimeout(resolve, 80))
if (postRes.json.ok !== true) throw new Error('POST failed: ' + JSON.stringify(postRes.json))

const file = join(home, 'profiles', 'web', 'cordis.patch.yml')
const text = readFileSync(file, 'utf8')
const entries = yaml.load(text, { schema })
const bp = entries.find((e) => e && e.id === 'browser-playwright')
if (bp.config.windowVisibility !== 'hidden') throw new Error('saved windowVisibility wrong')
if (bp.config.stealth !== false) throw new Error('saved stealth wrong')
const wp = entries.find((e) => e && e.id === 'web-permission')
if (!wp || wp.config.allowHosts[0] !== 'example.com') throw new Error('web-permission lost')
const sample = entries.find((e) => e && e.id === 'sample')
if (!sample || sample.config.expr.__jsExpr !== 'process.env.DSH_TEST_EXPR') throw new Error('!!js expr lost')
if (!text.includes('!!js')) throw new Error('!!js tag not preserved in dump')
console.log('POST ok; patch preserved (web-permission + !!js expr):')
console.log(text)

// POST creating a missing entry
const home2 = makeHome('- id: web-permission\n  config:\n    allowHosts: []\n')
process.env.DSH_HOME = home2
const ctx2 = { get: () => fakeServer, effect: (fn) => { fn(); return () => {} } }
apply(ctx2)
const postRes2 = makeRes()
captured.handler(makeReq('POST', JSON.stringify({ windowVisibility: 'visible', stealth: true })), postRes2)
await new Promise((resolve) => setTimeout(resolve, 80))
const file2 = join(home2, 'profiles', 'web', 'cordis.patch.yml')
const entries2 = yaml.load(readFileSync(file2, 'utf8'), { schema })
const bp2 = entries2.find((e) => e && e.id === 'browser-playwright')
if (!bp2 || bp2.config.windowVisibility !== 'visible') throw new Error('entry creation failed')
console.log('POST (create missing entry) ok')

console.log('\nALL HOST TESTS PASSED')
