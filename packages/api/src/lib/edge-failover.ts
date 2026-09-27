// ============================================
// packages/api/src/lib/edge-failover.ts
//
// If Cloudflare stops answering, go straight to Render (27 Sep 2026).
//
// The API sits behind Cloudflare (docs/CLOUDFLARE-EDGE.md), and Render's own
// load balancer spreads requests over the instances behind that. Cloudflare is
// an optimisation — a shield and a cache — and must never be the single thing
// between a shop and its books. When the edge fails (an outage, a plan limit,
// a misconfiguration), requests go to the DIRECT Render address instead, and
// Render's load balancer carries on exactly as before.
//
// WHAT COUNTS AS «THE EDGE FAILED»
//   - no response at all (DNS, TLS, connection refused) — never our own abort
//     and never a timeout: a slow origin is just as slow by the direct route;
//   - 520–527 and 530: Cloudflare's own «I could not get an answer» codes;
//   - 429 / 502 / 503 / 504 whose body is NOT JSON. This backend answers every
//     error as JSON, so an HTML error page came from something in front of it.
//     A JSON 429 is OUR rate limiter speaking, and is respected, not bypassed.
//
// WHAT IS RETRIED
//   Only what is safe to send twice: GET / HEAD / OPTIONS, and a write that
//   carries an Idempotency-Key (the server returns the first result for a
//   repeated key). Any other write is NOT resent — a 524 means the origin DID
//   receive it — the failover is armed for the next request and the error is
//   returned as it was.
//
// Once failed over, every request uses the direct address for COOLDOWN_MS,
// then the edge is tried again. No configuration → nothing changes (G4: the
// default is «no fallback», explicitly).
// ============================================

export const COOLDOWN_MS = 5 * 60_000

interface Config {
  primary: string
  fallback: string
}

let config: Config | null = null
let failoverUntil = 0

const strip = (url: string) => url.trim().replace(/\/+$/, '')

/** Both addresses end at the API root, e.g. https://api.hisabche.com/api. */
export function configureEdgeFailover(next: { primary: string; fallback: string } | null): void {
  config =
    next && next.primary.trim() && next.fallback.trim()
      ? { primary: strip(next.primary), fallback: strip(next.fallback) }
      : null
  failoverUntil = 0
}

export function edgeFailoverConfig(): Readonly<Config> | null {
  return config
}

export function isFailedOver(now = Date.now()): boolean {
  return config !== null && now < failoverUntil
}

/** The base URL a request should use right now. */
export function activeBaseUrl(requested: string | undefined, now = Date.now()): string | undefined {
  if (!config || requested === undefined) return requested
  return isFailedOver(now) && strip(requested) === config.primary ? config.fallback : requested
}

export function markEdgeDown(now = Date.now()): void {
  if (config) failoverUntil = now + COOLDOWN_MS
}

const EDGE_STATUS = new Set([520, 521, 522, 523, 524, 525, 526, 527, 530])
const MAYBE_EDGE_STATUS = new Set([429, 502, 503, 504])

export function isEdgeFailure(input: {
  hasResponse: boolean
  status?: number | undefined
  contentType?: string | undefined
  /** axios `error.code` — ECONNABORTED / ETIMEDOUT are timeouts, not the edge. */
  code?: string | undefined
}): boolean {
  if (!input.hasResponse) return input.code !== 'ECONNABORTED' && input.code !== 'ETIMEDOUT'
  const status = input.status ?? 0
  if (EDGE_STATUS.has(status)) return true
  if (MAYBE_EDGE_STATUS.has(status)) return !/json/i.test(input.contentType ?? '')
  return false
}

export function canReplay(
  method: string | undefined,
  headers: Record<string, unknown> | undefined,
): boolean {
  const m = (method ?? 'get').toLowerCase()
  if (m === 'get' || m === 'head' || m === 'options') return true
  if (!headers) return false
  return Object.keys(headers).some(
    (k) => k.toLowerCase() === 'idempotency-key' && Boolean(headers[k]),
  )
}
