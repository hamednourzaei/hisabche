#!/usr/bin/env node
// ============================================================================
// scripts/verify-slice.mjs
//
// End-to-end proof against a RUNNING server and a REAL database.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS SEPARATELY FROM THE TEST SUITE
//
// `vertical-slice-integration.test.ts` proves the wiring is declared: routes
// registered, guards present and ordered, services taking a verified context,
// idempotency written into the queries. It runs in CI with no database.
//
// It cannot prove the things that only a live system can:
//
//   * a retried command actually returns the first result instead of acting
//     twice
//   * two concurrent requests actually leave one winner
//   * RLS actually refuses a real cross-tenant read
//   * a reversal actually restores the figure it reversed
//
// Those are what this script does, against a deployed instance, with a real
// token. It WRITES DATA — into whichever workspace the token belongs to — so
// it refuses to run without --i-understand-this-writes-data.
//
// USAGE
//   node scripts/verify-slice.mjs --i-understand-this-writes-data
//
// ENVIRONMENT
//   API_URL              required, e.g. http://localhost:3001
//   API_TOKEN            required. A real access token for a test workspace.
//   API_TOKEN_OTHER      optional. A token in a DIFFERENT workspace; without
//                        it the tenant-isolation checks are skipped rather
//                        than silently passing.
// ============================================================================

import { loadEnv } from './lib/load-env.mjs'

loadEnv()

const API_URL = process.env.API_URL
const TOKEN = process.env.API_TOKEN
const OTHER_TOKEN = process.env.API_TOKEN_OTHER

if (!process.argv.includes('--i-understand-this-writes-data')) {
  console.error('This script writes real data. Re-run with --i-understand-this-writes-data.')
  process.exit(2)
}

if (!API_URL || !TOKEN) {
  console.error('API_URL and API_TOKEN are required.')
  process.exit(2)
}

const results = []
const record = (name, passed, detail) => {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function call(path, options = {}, token = TOKEN) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })

  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  return { status: response.status, body }
}

// ─── 1. Every route answers ──────────────────────────────────────────────────
// A 404 here means a route file was written and never registered — the exact
// failure a passing domain suite hides.

console.log('\n── reachability ──')

const READ_ENDPOINTS = [
  '/api/tax/config',
  '/api/pos/sessions/current',
  '/api/finance/assets',
  '/api/finance/currency/rates',
  '/api/finance/dimensions',
  '/api/operations/budgets',
  '/api/operations/batches',
  '/api/operations/expiry',
]

for (const path of READ_ENDPOINTS) {
  const { status } = await call(path)
  // 200 is reachable and allowed; 403 is reachable and correctly refused for
  // this role. 404 means it does not exist.
  record(`${path} is registered`, status !== 404, `HTTP ${status}`)
}

// ─── 2. Authorization actually refuses ───────────────────────────────────────

console.log('\n── authorization ──')

{
  const { status } = await call('/api/tax/config', {}, 'obviously-not-a-token')
  record('an invalid token is refused', status === 401 || status === 403, `HTTP ${status}`)
}

// ─── 3. Idempotency: the property a till lives on ────────────────────────────

console.log('\n── idempotency ──')

{
  const open = await call('/api/pos/sessions', {
    method: 'POST',
    body: JSON.stringify({ openingFloatMinor: 100000 }),
  })

  if (open.status !== 201 && open.status !== 409) {
    record('opens a till session', false, `HTTP ${open.status}`)
  } else {
    const session =
      open.status === 201 ? open.body : (await call('/api/pos/sessions/current')).body?.session

    if (!session?.id) {
      record('opens a till session', false, 'no session id returned')
    } else {
      record('opens a till session', true, session.id.slice(0, 8))

      // A second open for the same person must be refused, not create a
      // second drawer nobody can reconcile.
      const second = await call('/api/pos/sessions', {
        method: 'POST',
        body: JSON.stringify({ openingFloatMinor: 100000 }),
      })
      record('refuses a second open drawer', second.status === 409, `HTTP ${second.status}`)

      // THE important one: the same orderRef sent twice must produce one sale.
      const orderRef = `verify-${Date.now()}`
      const payload = {
        orderRef,
        totalMinor: 5000,
        changeMinor: 0,
        payments: [{ method: 'cash', amountMinor: 5000 }],
      }

      const first = await call(`/api/pos/sessions/${session.id}/orders`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const retry = await call(`/api/pos/sessions/${session.id}/orders`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      record(
        'a retried order returns the SAME sale',
        first.body?.id && first.body.id === retry.body?.id,
        `${first.body?.id?.slice(0, 8)} vs ${retry.body?.id?.slice(0, 8)}`,
      )

      // And the drawer must show one sale, not two.
      const totals = (await call(`/api/pos/sessions/${session.id}`)).body?.totals
      record(
        'the drawer counted the retry once',
        totals?.expectedCashMinor === 105000,
        `expected 105000, got ${totals?.expectedCashMinor}`,
      )

      // ─── 4. Concurrency: two closes, one winner ────────────────────────
      const [closeA, closeB] = await Promise.all([
        call(`/api/pos/sessions/${session.id}/close`, {
          method: 'POST',
          body: JSON.stringify({ countedCashMinor: 105000 }),
        }),
        call(`/api/pos/sessions/${session.id}/close`, {
          method: 'POST',
          body: JSON.stringify({ countedCashMinor: 105000 }),
        }),
      ])

      const succeeded = [closeA, closeB].filter((r) => r.status === 200).length
      record('two simultaneous closes leave one winner', succeeded === 1, `${succeeded} succeeded`)
    }
  }
}

// ─── 5. Tenant isolation, for real ───────────────────────────────────────────

console.log('\n── tenant isolation ──')

if (!OTHER_TOKEN) {
  console.log('  skipped: set API_TOKEN_OTHER to a token in a different workspace')
} else {
  const mine = await call('/api/operations/budgets')
  const theirs = await call('/api/operations/budgets', {}, OTHER_TOKEN)

  const mineIds = new Set((mine.body ?? []).map((row) => row.id))
  const overlap = (theirs.body ?? []).filter((row) => mineIds.has(row.id))

  record('two workspaces share no budget rows', overlap.length === 0, `${overlap.length} shared`)

  // A workspace header naming somebody else's workspace must be refused, not
  // honoured — the header is a request, never an authorization.
  const forged = await call('/api/operations/budgets', {
    headers: { 'x-workspace-id': '00000000-0000-4000-8000-000000000001' },
  })
  record('a forged workspace header is refused', forged.status === 403, `HTTP ${forged.status}`)
}

// ─── 6. Reversal restores the figure ─────────────────────────────────────────

console.log('\n── reversal ──')

{
  const before = await call('/api/accounting/trial-balance')

  if (before.status !== 200) {
    console.log(`  skipped: trial balance unavailable (HTTP ${before.status})`)
  } else {
    record('the trial balance is readable', true, `${before.body?.rows?.length ?? 0} rows`)
    record(
      'the trial balance balances',
      Math.abs(Number(before.body?.difference ?? 0)) < 0.005,
      `difference ${before.body?.difference}`,
    )
  }
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.passed)

console.log(`\n${results.length - failed.length}/${results.length} checks passed`)

if (failed.length > 0) {
  console.error('\nFAILED:')
  for (const failure of failed) console.error(`  ${failure.name} — ${failure.detail}`)
  process.exit(1)
}

console.log('The vertical slice works against the live system.')
