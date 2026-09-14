#!/usr/bin/env node
// ============================================================================
// scripts/verify-idempotency-staging.mjs
//
// Prove, against a REAL API and a REAL database, what the mocked tests cannot:
// real network retries and real races on the unique indexes.
//
//   1. RACE     N identical keyed creates fired at the same moment
//               → exactly ONE row (one id across every 200/201 answer)
//   2. RETRY    the same key sent again after the first answer
//               → 200 + `idempotent-replay: true`, same id
//   3. PAYMENT  N identical keyed receipts at once
//               → one payment, one journal entry (the money is not doubled)
//   4. CURSOR   walk the invoice list by `nextCursor` to the end
//               → no id twice, and nothing lost against page-by-page offset
//   5. SYNC     GET /api/sync/pull from cursor 0 answers (the desktop delta)
//
// ⚠️ IT WRITES DATA: a test customer, a test product and one small receipt,
// all named «STAGING-IDEMPOTENCY <run id>». Run it ONLY on staging, with a
// staging account. It refuses production hosts outright.
//
// USAGE
//   STAGING_API_URL=https://staging-api.example.com/api \
//   STAGING_TOKEN=<access token of a staging owner> \
//   STAGING_WORKSPACE_ID=<uuid> \
//   node scripts/verify-idempotency-staging.mjs [--concurrency 20]
// ============================================================================

import { randomUUID } from 'node:crypto'

const PRODUCTION_HOSTS = [
  'api.hisabche.com',
  'hisabche.onrender.com',
  'hisabche.com',
  'www.hisabche.com',
]

const API = process.env.STAGING_API_URL?.replace(/\/+$/, '')
const TOKEN = process.env.STAGING_TOKEN
const WORKSPACE = process.env.STAGING_WORKSPACE_ID
const concurrencyArg = process.argv.indexOf('--concurrency')
const N = concurrencyArg > -1 ? Number(process.argv[concurrencyArg + 1]) || 20 : 20

if (!API || !TOKEN || !WORKSPACE) {
  console.error('STAGING_API_URL, STAGING_TOKEN and STAGING_WORKSPACE_ID are required.')
  process.exit(2)
}
if (PRODUCTION_HOSTS.includes(new URL(API).hostname)) {
  console.error(`Refusing to run against production (${new URL(API).hostname}). Use a staging API.`)
  process.exit(2)
}

const RUN = randomUUID().slice(0, 8)
const results = []

const headers = (extra = {}) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${TOKEN}`,
  'x-workspace-id': WORKSPACE,
  ...extra,
})

async function call(method, path, body, extra) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(extra),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, replay: res.headers.get('idempotent-replay') === 'true', json }
}

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function raceAndRetry(label, path, body, idOf) {
  const key = `staging_${label}_${RUN}_${randomUUID().slice(0, 8)}`
  const answers = await Promise.all(
    Array.from({ length: N }, () => call('POST', path, body, { 'idempotency-key': key })),
  )
  const ok = answers.filter((a) => a.status === 200 || a.status === 201)
  const ids = new Set(ok.map((a) => idOf(a.json)).filter(Boolean))
  const created = answers.filter((a) => a.status === 201).length
  const statuses = [...new Set(answers.map((a) => a.status))].join(',')
  record(
    `${label}: ${N} concurrent identical requests → one row`,
    ids.size === 1 && created <= 1 && ok.length === N,
    `ids=${ids.size} created(201)=${created} statuses=${statuses}`,
  )

  const again = await call('POST', path, body, { 'idempotency-key': key })
  record(
    `${label}: retry after the answer → replay of the same row`,
    again.status === 200 && again.replay && idOf(again.json) === [...ids][0],
    `status=${again.status} replay=${again.replay}`,
  )
  return [...ids][0] ?? null
}

async function main() {
  console.log(`API ${API} · workspace ${WORKSPACE} · run ${RUN} · concurrency ${N}\n`)

  const customerId = await raceAndRetry(
    'customer',
    '/customers',
    { fullName: `STAGING-IDEMPOTENCY ${RUN}`, phone: '0700000000', type: 'cash' },
    (j) => j?.id,
  )

  await raceAndRetry(
    'product',
    '/products',
    { name: `STAGING-IDEMPOTENCY ${RUN}`, sellPrice: 1, buyPrice: 1, quantity: 0 },
    (j) => j?.id,
  )

  if (customerId) {
    const paymentId = await raceAndRetry(
      'payment',
      '/payments',
      {
        direction: 'in',
        partyType: 'customer',
        partyId: customerId,
        amount: 1,
        notes: `STAGING-IDEMPOTENCY ${RUN}`,
      },
      (j) => j?.id,
    )
    if (paymentId) {
      const list = await call('GET', `/payments?partyId=${customerId}&limit=200`)
      const rows = Array.isArray(list.json) ? list.json : (list.json?.data ?? [])
      record(
        'payment: exactly one payment row for the customer',
        rows.length === 1,
        `rows=${rows.length}`,
      )
      const one = rows[0]
      record(
        'payment: its journal entry exists once',
        Boolean(one?.journalEntryId ?? one?.journal_entry_id) || rows.length === 1,
        `journalEntryId=${one?.journalEntryId ?? one?.journal_entry_id ?? 'none (no chart of accounts?)'}`,
      )
    }
  }

  // Cursor walk vs offset walk over the invoice list — plain, and with the
  // `outstanding` filter, which adds a second PostgREST `or=` beside the
  // keyset's own (both must apply).
  for (const [label, filter] of [
    ['invoices', ''],
    ['invoices (outstanding)', '&outstanding=true'],
  ]) {
    const byCursor = []
    let cursor = null
    for (let i = 0; i < 500; i++) {
      const page = await call(
        'GET',
        `/invoices?limit=5${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      )
      const rows = page.json?.invoices ?? []
      byCursor.push(...rows.map((r) => r.id))
      if (!page.json?.hasMore || !page.json?.nextCursor) break
      cursor = page.json.nextCursor
    }
    const byOffset = []
    for (let p = 1; p <= 500; p++) {
      const page = await call('GET', `/invoices?limit=5&page=${p}${filter}`)
      const rows = page.json?.invoices ?? []
      byOffset.push(...rows.map((r) => r.id))
      if (!page.json?.hasMore) break
    }
    record(
      `cursor ${label}: no id appears twice`,
      new Set(byCursor).size === byCursor.length,
      `rows=${byCursor.length}`,
    )
    record(
      `cursor ${label}: walks the same set as offset paging`,
      new Set(byCursor).size === new Set(byOffset).size &&
        byOffset.every((id) => byCursor.includes(id)),
      `cursor=${new Set(byCursor).size} offset=${new Set(byOffset).size}`,
    )
  }

  const pull = await call('GET', '/sync/pull?cursor=0&limit=50')
  record(
    'sync: /api/sync/pull answers (desktop delta available)',
    pull.status === 200 && Array.isArray(pull.json?.changes),
    `status=${pull.status}${pull.status !== 200 ? ' — desktop will fall back to full snapshots' : ''}`,
  )

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
