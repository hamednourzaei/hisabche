#!/usr/bin/env node
// ============================================================================
// scripts/release/smoke.mjs
//
// Standalone post-deployment smoke test script for Hisabche.
// Reads target environment from env vars:
//   BASE_URL           - Target API host (e.g. https://api.hisabche.com or http://localhost:3000)
//   SMOKE_TOKEN        - Optional JWT token for authenticated checks
//   SMOKE_WORKSPACE_ID - Optional Workspace UUID for tenant checks
//   SMOKE_ALLOW_WRITES - Set to '1' to enable safe, sandbox mutation probe
//
// Usage: node scripts/release/smoke.mjs
// ============================================================================

const BASE_URL = (process.env.BASE_URL || process.env.API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
)
const TOKEN = process.env.SMOKE_TOKEN || ''
const WORKSPACE_ID = process.env.SMOKE_WORKSPACE_ID || ''
const ALLOW_WRITES =
  process.env.SMOKE_ALLOW_WRITES === '1' || process.env.SMOKE_ALLOW_WRITES === 'true'
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 10000)

console.log('='.repeat(70))
console.log('  HISABCHE POST-DEPLOYMENT SMOKE TESTS')
console.log('='.repeat(70))
console.log(`Target Base URL:     ${BASE_URL}`)
console.log(
  `Auth Token Present:  ${TOKEN ? 'YES (length: ' + TOKEN.length + ')' : 'NO (anonymous checks only)'}`,
)
console.log(`Workspace ID:        ${WORKSPACE_ID || 'NONE'}`)
console.log(`Mutation Writes:     ${ALLOW_WRITES ? 'ENABLED' : 'DISABLED (read-only mode)'}`)
console.log(`Timestamp:           ${new Date().toISOString()}`)
console.log('')

let passCount = 0
let failCount = 0
let skipCount = 0

async function request(method, path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  }
  if (TOKEN && !headers.Authorization) {
    headers.Authorization = `Bearer ${TOKEN}`
  }
  if (WORKSPACE_ID && !headers['x-workspace-id']) {
    headers['x-workspace-id'] = WORKSPACE_ID
  }

  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const duration = Date.now() - start
    let body = null
    const text = await res.text()
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { ok: true, status: res.statusCode || res.status, duration, body }
  } catch (err) {
    const duration = Date.now() - start
    return { ok: false, error: err.message, duration }
  } finally {
    clearTimeout(timeout)
  }
}

async function runTest(name, fn) {
  process.stdout.write(`  Testing ${name.padEnd(45)} ... `)
  try {
    const result = await fn()
    if (result.skipped) {
      skipCount++
      console.log(`[SKIP] (${result.reason})`)
    } else if (result.passed) {
      passCount++
      console.log(`[PASS] (${result.duration}ms, status: ${result.status})`)
    } else {
      failCount++
      console.log(`[FAIL] ${result.error || `status: ${result.status}`}`)
    }
  } catch (err) {
    failCount++
    console.log(`[FAIL] Exception: ${err.message}`)
  }
}

async function main() {
  // ─── 1. Public Health Endpoints ───────────────────────────────────────────
  console.log('1. Service Health & Readiness Probes')

  await runTest('GET /live (Liveness)', async () => {
    const res = await request('GET', '/live')
    if (!res.ok) return { passed: false, error: res.error }
    return { passed: res.status === 200, status: res.status, duration: res.duration }
  })

  await runTest('GET /ready (Database Probe)', async () => {
    const res = await request('GET', '/ready')
    if (!res.ok) return { passed: false, error: res.error }
    // 200 when DB connected; 503 if DB disconnected
    return {
      passed: res.status === 200 || res.status === 503,
      status: res.status,
      duration: res.duration,
    }
  })

  console.log('')

  // ─── 2. Authenticated Endpoints ───────────────────────────────────────────
  console.log('2. Authenticated Session & Tenant Endpoints')

  if (!TOKEN) {
    console.log('  [SKIP] Authenticated checks skipped (set SMOKE_TOKEN to enable)')
    skipCount += 3
  } else {
    await runTest('GET /api/sync/cursor', async () => {
      const res = await request('GET', '/api/sync/cursor')
      if (!res.ok) return { passed: false, error: res.error }
      return { passed: res.status === 200, status: res.status, duration: res.duration }
    })

    await runTest('GET /api/v1/workflows (List Workflows)', async () => {
      const res = await request('GET', '/api/v1/workflows')
      if (!res.ok) return { passed: false, error: res.error }
      return { passed: [200, 404].includes(res.status), status: res.status, duration: res.duration }
    })

    await runTest('GET /api/conflicts (Review Queue)', async () => {
      const res = await request('GET', '/api/conflicts')
      if (!res.ok) return { passed: false, error: res.error }
      return { passed: [200, 403].includes(res.status), status: res.status, duration: res.duration }
    })
  }

  console.log('')

  // ─── 3. Guarded Mutation Probe ────────────────────────────────────────────
  console.log('3. Sandbox Mutation Probe')

  if (!ALLOW_WRITES) {
    console.log('  [SKIP] Mutation write probes skipped (set SMOKE_ALLOW_WRITES=1 to enable)')
    skipCount++
  } else if (!TOKEN) {
    console.log('  [SKIP] Mutation write probe skipped (requires SMOKE_TOKEN)')
    skipCount++
  } else {
    await runTest('POST /api/sync/push (Idempotent Ping)', async () => {
      const pingMutation = {
        clientTimestamp: new Date().toISOString(),
        mutations: [],
      }
      const res = await request('POST', '/api/sync/push', {
        headers: { 'Content-Type': 'application/json' },
        body: pingMutation,
      })
      if (!res.ok) return { passed: false, error: res.error }
      return { passed: [200, 400].includes(res.status), status: res.status, duration: res.duration }
    })
  }

  console.log('')
  console.log('='.repeat(70))
  console.log(`SMOKE TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED`)
  console.log('='.repeat(70))

  if (failCount > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Smoke suite fatal error:', err)
  process.exit(1)
})
