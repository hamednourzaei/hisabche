// ============================================
// backend/src/utils/supabase-fetch-metrics.ts
//
// Measure every database round-trip — at the only place they all pass.
//
// ---------------------------------------------------------------------------
// WHY `dbMs` WAS ALWAYS 0
//
// The backend opens no Postgres connection of its own (no `pg` Pool, no
// `postgres()` — both packages are installed and unused). Every read and write
// is supabase-js, which is an HTTPS request to PostgREST (`/rest/v1/…`), and
// sign-in / token checks are HTTPS requests to GoTrue (`/auth/v1/…`).
// `trackQuery()` existed and had ZERO callers, so the perf line reported
// `queries: 0, dbMs: 0` for a request that spent 4 s waiting on the database.
//
// WHAT IS RECORDED, PER REQUEST
//
//   restCalls / restMs   PostgREST table reads and writes
//   rpcCalls  / rpcMs    Postgres functions (`/rest/v1/rpc/…`)
//   authCalls / authMs   GoTrue (getUser, refresh, sign-in)
//   (every `ms` is request sent → response HEADERS received: the database's
//    work plus the network both ways. Reading the body afterwards is supabase-js
//    parsing JSON in this process and shows up in overheadMs.)
//   newConnections       TCP/TLS connections OPENED during this request.
//                        Should be ~0 once warm: keep-alive reuses sockets.
//                        A steady non-zero count is "a connection per request".
//   slowest              the three slowest calls, by target (table / rpc / path)
//
// No query text, no parameters, no headers are recorded — targets only.
// ============================================

import diagnosticsChannel from 'node:diagnostics_channel'

import { getMetrics } from './request-metrics'

export type CallKind = 'rest' | 'rpc' | 'auth' | 'storage' | 'other'

export interface CallSample {
  kind: CallKind
  target: string
  method: string
  status: number
  ms: number
  /** performance.now() when the call started — for the union of wait time. */
  at: number
}

/** Classify a Supabase URL without keeping anything but its path shape. */
export function classify(url: string): { kind: CallKind; target: string } {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return { kind: 'other', target: 'unknown' }
  }
  const rpc = /^\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/.exec(path)
  if (rpc) return { kind: 'rpc', target: rpc[1]! }
  const rest = /^\/rest\/v1\/([A-Za-z0-9_]+)/.exec(path)
  if (rest) return { kind: 'rest', target: rest[1]! }
  const auth = /^\/auth\/v1\/([A-Za-z0-9_/]+)/.exec(path)
  if (auth) return { kind: 'auth', target: auth[1]!.replace(/\/[0-9a-f-]{36}/gi, '/:id') }
  if (path.startsWith('/storage/v1/')) return { kind: 'storage', target: 'storage' }
  return { kind: 'other', target: path.split('/').slice(0, 3).join('/') }
}

export function recordCall(sample: CallSample): void {
  const m = getMetrics()
  if (!m) return
  const db = m.db
  if (sample.kind === 'rest') {
    db.restCalls += 1
    db.restMs += sample.ms
  } else if (sample.kind === 'rpc') {
    db.rpcCalls += 1
    db.rpcMs += sample.ms
  } else if (sample.kind === 'auth') {
    db.authCalls += 1
    db.authMs += sample.ms
  } else {
    db.otherCalls += 1
    db.otherMs += sample.ms
  }
  // Keep the query counters the perf line already prints meaningful.
  if (sample.kind === 'rest' || sample.kind === 'rpc') {
    m.queryCount += 1
    m.dbTimeMs += sample.ms
  }
  db.samples.push(sample)
  if (db.samples.length > 200) db.samples.shift()
}

type FetchLike = (input: any, init?: any) => Promise<Response>

/** Wrap the fetch supabase-js uses. Behaviour is unchanged; only timing is observed. */
export function instrumentFetch(base: FetchLike): FetchLike {
  return async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input))
    const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase()
    const { kind, target } = classify(url)
    const started = performance.now()
    let status = 0
    try {
      const response = await base(input, init)
      status = response.status
      return response
    } finally {
      const ms = Math.round(performance.now() - started)
      recordCall({ kind, target, method, status, ms, at: started })
    }
  }
}

/**
 * Wall-clock time this request spent with at least one Supabase call open —
 * parallel calls counted once. `totalMs - waitingMs` is time in our own code.
 */
export function waitingMs(): number {
  const m = getMetrics()
  if (!m || m.db.samples.length === 0) return 0
  const spans = m.db.samples.map((s) => [s.at, s.at + s.ms] as const).sort((a, b) => a[0] - b[0])
  let total = 0
  let [start, end] = spans[0]!
  for (const [s, e] of spans.slice(1)) {
    if (s > end) {
      total += end - start
      start = s
      end = e
    } else if (e > end) {
      end = e
    }
  }
  total += end - start
  return Math.round(total)
}

/** The three slowest calls of this request, e.g. `rest:invoices 812ms`. */
export function slowestCalls(limit = 3): string[] {
  const m = getMetrics()
  if (!m) return []
  return [...m.db.samples]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit)
    .map((s) => `${s.kind}:${s.target} ${s.ms}ms${s.status >= 400 ? ` (${s.status})` : ''}`)
}

// ─── Connections opened (undici, Node's built-in fetch) ─────────────────────
let installed = false
let processConnections = 0

export function installConnectionCounter(): void {
  if (installed) return
  installed = true
  diagnosticsChannel.subscribe('undici:client:connected', () => {
    processConnections += 1
    const m = getMetrics()
    if (m) m.db.newConnections += 1
  })
}

export function totalConnectionsOpened(): number {
  return processConnections
}
