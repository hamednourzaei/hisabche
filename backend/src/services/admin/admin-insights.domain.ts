// ============================================
// backend/src/services/admin/admin-insights.domain.ts
//
// V63 — the read models behind the admin items that were ⛔ in
// `docs/architecture/admin/V63-113-ITEMS.md`. Pure functions, no database.
//
// The rule every function here keeps: a figure that cannot be computed is
// `null` with a reason, never 0. «No failed logins», «0 % success» and «we do
// not record this» are three different screens.
// ============================================

import { createHash } from 'node:crypto'

// ─── #49 Failed-login aggregation ─────────────────────────────────────

/** The security-event type the product's sign-in route writes on a refusal. */
export const LOGIN_FAILED_EVENT = 'LOGIN_FAILED'

/** Attempts from one source inside the window at which the row is flagged. */
export const FAILED_LOGIN_FLAG_THRESHOLD = 10

export interface FailedLoginRow {
  ipAddress: string | null
  /** `details.account` — a fingerprint of the address, never the address. */
  account: string | null
  createdAt: string
}

export interface FailedLoginBucket {
  key: string
  attempts: number
  lastAt: string
  /** Distinct accounts tried from one address / addresses used against one account. */
  spread: number
  flagged: boolean
}

export interface FailedLoginSummary {
  total: number
  byIp: FailedLoginBucket[]
  byAccount: FailedLoginBucket[]
  flaggedIps: number
  flaggedAccounts: number
}

/**
 * Who is guessing passwords, and against whom.
 *
 * Two views, because they catch two attacks: many attempts from ONE address
 * (a brute force) and many addresses against ONE account (a distributed one).
 * A row with no address or no fingerprint is counted in `total` and left out
 * of that view — it is not grouped under a made-up «unknown» key that would
 * look like one busy attacker.
 */
export function aggregateFailedLogins(
  rows: readonly FailedLoginRow[],
  threshold: number = FAILED_LOGIN_FLAG_THRESHOLD,
): FailedLoginSummary {
  const byIp = bucket(
    rows,
    (row) => row.ipAddress,
    (row) => row.account,
    threshold,
  )
  const byAccount = bucket(
    rows,
    (row) => row.account,
    (row) => row.ipAddress,
    threshold,
  )
  return {
    total: rows.length,
    byIp,
    byAccount,
    flaggedIps: byIp.filter((row) => row.flagged).length,
    flaggedAccounts: byAccount.filter((row) => row.flagged).length,
  }
}

function bucket(
  rows: readonly FailedLoginRow[],
  keyOf: (row: FailedLoginRow) => string | null,
  otherOf: (row: FailedLoginRow) => string | null,
  threshold: number,
): FailedLoginBucket[] {
  const groups = new Map<string, { attempts: number; lastAt: string; others: Set<string> }>()
  for (const row of rows) {
    const key = keyOf(row)
    if (!key) continue
    const group = groups.get(key) ?? { attempts: 0, lastAt: row.createdAt, others: new Set() }
    group.attempts += 1
    if (row.createdAt > group.lastAt) group.lastAt = row.createdAt
    const other = otherOf(row)
    if (other) group.others.add(other)
    groups.set(key, group)
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      attempts: group.attempts,
      lastAt: group.lastAt,
      spread: group.others.size,
      // At the threshold IS the risk: a boundary that excludes its own value
      // is not one anybody can reason about.
      flagged: group.attempts >= threshold,
    }))
    .sort((a, b) => b.attempts - a.attempts || b.lastAt.localeCompare(a.lastAt))
}

/**
 * A stable, one-way label for an email address: the same account groups
 * together, nobody reading the console learns the address.
 */
export function accountFingerprint(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16)
}

// ─── #79 Email delivery ───────────────────────────────────────────────

/** `a***@example.com` — enough to recognise, not enough to harvest. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@')
  if (at <= 0) return '***'
  return `${address.slice(0, 1)}***${address.slice(at)}`
}

// ─── #10 Gateway success rate ─────────────────────────────────────────

export interface PaymentOutcomeRate {
  succeeded: number
  failed: number
  /** Whole-percent success; `null` when no outcome was recorded in the window. */
  ratePercent: number | null
  status: 'ok' | 'no_events'
}

/**
 * Success rate from the provider's own outcome events. With no event in the
 * window there is no rate — 0 % would read as «every payment failed».
 */
export function paymentOutcomeRate(succeeded: number, failed: number): PaymentOutcomeRate {
  const total = succeeded + failed
  if (total <= 0) return { succeeded, failed, ratePercent: null, status: 'no_events' }
  return {
    succeeded,
    failed,
    ratePercent: Math.round((succeeded / total) * 1000) / 10,
    status: 'ok',
  }
}

// ─── #58 TLS certificate expiry ───────────────────────────────────────

export type CertificateState = 'ok' | 'warning' | 'critical' | 'expired' | 'unreachable'

export const CERT_WARNING_DAYS = 30
export const CERT_CRITICAL_DAYS = 7

/** How urgent a certificate is. `validTo === null` means it could not be read. */
export function certificateState(
  validTo: Date | null,
  now: Date,
): { state: CertificateState; daysLeft: number | null } {
  if (!validTo || Number.isNaN(validTo.getTime())) return { state: 'unreachable', daysLeft: null }
  const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / 86_400_000)
  if (validTo.getTime() <= now.getTime()) return { state: 'expired', daysLeft }
  if (daysLeft <= CERT_CRITICAL_DAYS) return { state: 'critical', daysLeft }
  if (daysLeft <= CERT_WARNING_DAYS) return { state: 'warning', daysLeft }
  return { state: 'ok', daysLeft }
}

/** The https host names in a list of origins, each once, in order. */
export function httpsHosts(origins: readonly string[]): string[] {
  const hosts: string[] = []
  for (const origin of origins) {
    try {
      const url = new URL(origin)
      if (url.protocol !== 'https:') continue
      if (!hosts.includes(url.hostname)) hosts.push(url.hostname)
    } catch {
      // Not a URL — not a host this check can open.
    }
  }
  return hosts
}

// ─── #113 API usage ───────────────────────────────────────────────────

export interface ApiRequestRow {
  keyId: string
  workspaceId: string
  method: string
  route: string
  status: number
  durationMs: number
}

export interface ApiUsageBucket {
  key: string
  requests: number
  clientErrors: number
  serverErrors: number
  /** Nearest-rank p95 of `duration_ms`. */
  p95Ms: number
}

export interface ApiUsageSummary {
  total: number
  byKey: Array<ApiUsageBucket & { workspaceId: string }>
  byRoute: ApiUsageBucket[]
}

export function summarizeApiUsage(rows: readonly ApiRequestRow[]): ApiUsageSummary {
  const keys = new Map<string, { workspaceId: string; rows: ApiRequestRow[] }>()
  const routes = new Map<string, ApiRequestRow[]>()
  for (const row of rows) {
    const keyGroup = keys.get(row.keyId) ?? { workspaceId: row.workspaceId, rows: [] }
    keyGroup.rows.push(row)
    keys.set(row.keyId, keyGroup)
    const routeKey = `${row.method} ${row.route}`
    routes.set(routeKey, [...(routes.get(routeKey) ?? []), row])
  }
  const byKey = [...keys.entries()].map(([key, group]) => ({
    ...usageBucket(key, group.rows),
    workspaceId: group.workspaceId,
  }))
  const byRoute = [...routes.entries()].map(([key, group]) => usageBucket(key, group))
  const order = (a: ApiUsageBucket, b: ApiUsageBucket) => b.requests - a.requests
  return { total: rows.length, byKey: byKey.sort(order), byRoute: byRoute.sort(order) }
}

function usageBucket(key: string, rows: readonly ApiRequestRow[]): ApiUsageBucket {
  const durations = rows.map((row) => row.durationMs).sort((a, b) => a - b)
  const rank = Math.max(0, Math.ceil(0.95 * durations.length) - 1)
  return {
    key,
    requests: rows.length,
    clientErrors: rows.filter((row) => row.status >= 400 && row.status < 500).length,
    serverErrors: rows.filter((row) => row.status >= 500).length,
    p95Ms: durations[rank] ?? 0,
  }
}

// ─── #94 Signup funnel ────────────────────────────────────────────────

export interface FunnelStep {
  id: 'signed_up' | 'created_business' | 'paid'
  count: number
  /** Share of the first step, whole percent with one decimal; `null` when it is empty. */
  ofFirstPercent: number | null
  /** Share of the step before; `null` for the first step or an empty previous step. */
  ofPreviousPercent: number | null
}

/**
 * The cohort funnel: people who signed up in the window, how many of THEM
 * created a business, how many of those businesses paid. Each step is a
 * subset of the one before, so no percentage can exceed 100.
 */
export function signupFunnel(counts: {
  signedUp: number
  createdBusiness: number
  paid: number
}): FunnelStep[] {
  const raw: Array<[FunnelStep['id'], number]> = [
    ['signed_up', counts.signedUp],
    ['created_business', Math.min(counts.createdBusiness, counts.signedUp)],
    ['paid', Math.min(counts.paid, counts.createdBusiness, counts.signedUp)],
  ]
  const first = raw[0]?.[1] ?? 0
  return raw.map(([id, count], index) => {
    const previous = index === 0 ? null : (raw[index - 1]?.[1] ?? 0)
    return {
      id,
      count,
      ofFirstPercent: first > 0 ? percent(count, first) : null,
      ofPreviousPercent: previous && previous > 0 ? percent(count, previous) : null,
    }
  })
}

function percent(part: number, whole: number): number {
  return Math.round((part / whole) * 1000) / 10
}

// ─── #69 Migration status ─────────────────────────────────────────────

export type MigrationState = 'applied' | 'not_applied' | 'unknown'

/**
 * What a table probe says about a migration. Only «the table does not exist»
 * means not applied; any other error is `unknown` — a failed read is not
 * evidence that the migration is missing.
 */
export function migrationStateFromProbe(error: { code?: string } | null): MigrationState {
  if (!error) return 'applied'
  if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '')) return 'not_applied'
  return 'unknown'
}
