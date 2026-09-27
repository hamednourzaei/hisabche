// Post-deploy smoke test (deploy steps 3 and 11). Read-only: GET requests and
// one refused WebSocket upgrade; nothing is written.
//
//   node scripts/smoke-test.mjs https://api.hisabche.com
//
// Optional, for the authenticated checks (the token is read from the
// environment and never printed):
//   SMOKE_TOKEN=<access token> SMOKE_WORKSPACE=<workspace id> node scripts/smoke-test.mjs <url>
import http from 'node:http'
import https from 'node:https'

const base = (process.argv[2] ?? 'https://api.hisabche.com').replace(/\/+$/, '')
const token = process.env.SMOKE_TOKEN ?? ''
const workspace = process.env.SMOKE_WORKSPACE ?? ''
const HSB = 'application/x-hisabche-sync'

const results = []
const check = (name, ok, detail) => results.push({ name, ok, detail })

async function get(path, headers = {}) {
  const res = await fetch(base + path, { headers })
  const body = new Uint8Array(await res.arrayBuffer())
  return { status: res.status, headers: res.headers, body }
}

/** A WebSocket upgrade without a token must be refused before it upgrades. */
function upgradeStatus(path) {
  const url = new URL(base + path)
  const lib = url.protocol === 'https:' ? https : http
  return new Promise((resolve) => {
    const req = lib.request(url, {
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Protocol': 'hisabche.v1',
      },
      timeout: 15_000,
    })
    req.on('response', (res) => resolve(res.statusCode))
    req.on('upgrade', () => resolve(101))
    req.on('timeout', () => resolve('timeout'))
    req.on('error', (err) => resolve(`error: ${err.message}`))
    req.end()
  })
}

try {
  const health = await get('/api/health')
  const info = JSON.parse(new TextDecoder().decode(health.body) || '{}')
  check(
    'health 200',
    health.status === 200,
    `status ${health.status}, commit ${info.commit ?? '?'}`,
  )

  // 200 only when the backend reached the database — after a password
  // rotation this is the proof the new secret is in place.
  const ready = await get('/ready')
  check('ready 200 (database reachable)', ready.status === 200, `status ${ready.status}`)

  for (const path of [
    '/api/sync/pull?cursor=0',
    '/api/sync/snapshot?entity=product',
    '/api/products/by-barcode/0000',
  ]) {
    const r = await get(path)
    // 401 shows the auth gate works; it does NOT prove the route exists — the
    // global auth check answers before routing. The authenticated checks do.
    check(`${path} guarded`, r.status === 401, `status ${r.status} (expect 401 without a token)`)
  }

  const ws = await upgradeStatus('/api/sync/stream')
  check('websocket refused without token', ws === 401, `status ${ws}`)

  try {
    const docs = await get('/docs/json', { 'Accept-Encoding': 'br, gzip' })
    check(
      'brotli compression',
      docs.headers.get('content-encoding') === 'br',
      `content-encoding ${docs.headers.get('content-encoding')}`,
    )
  } catch (err) {
    // One unreachable check must not hide the others.
    check('brotli compression', false, `/docs/json: ${err.message}`)
  }

  if (token && workspace) {
    const auth = { Authorization: `Bearer ${token}`, 'x-workspace-id': workspace }
    const cursor = await get('/api/sync/cursor', auth)
    check(
      'sync cursor (authenticated)',
      cursor.status === 200,
      `status ${cursor.status} ${new TextDecoder().decode(cursor.body).slice(0, 60)}`,
    )
    const pull = await get('/api/sync/pull?cursor=0&limit=5', { ...auth, Accept: HSB })
    const isHsb =
      (pull.headers.get('content-type') ?? '').includes(HSB) &&
      pull.body[0] === 0x48 &&
      pull.body[1] === 0x53
    check(
      'binary pull (HSB frame)',
      pull.status === 200 && isHsb,
      `status ${pull.status}, ${pull.body.length} bytes`,
    )
    const snap = await get('/api/sync/snapshot?entity=product&limit=5', auth)
    check('snapshot (authenticated)', snap.status === 200, `status ${snap.status}`)
  } else {
    check('authenticated checks', true, 'skipped (set SMOKE_TOKEN and SMOKE_WORKSPACE to run them)')
  }
} catch (err) {
  check('reachable', false, err.message)
}

let failed = 0
for (const r of results) {
  if (!r.ok) failed += 1
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.detail}`)
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
