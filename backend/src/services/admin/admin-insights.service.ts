// ============================================
// backend/src/services/admin/admin-insights.service.ts
//
// V63 — the reads behind the admin items that were ⛔ in the 113 table.
// Every rule lives in `admin-insights.domain.ts` (and the revenue forecast in
// `intelligence/forecast.domain.ts`); this file only reads rows.
//
// Three answers this file keeps apart (CLAUDE.md §7.3, §7.6):
//   - `not_configured` — the table/migration is not there yet;
//   - an error — thrown, the route answers 500, the screen shows a retry;
//   - empty — a real zero.
//
// ⚠️ A CAPPED READ SAYS SO. Where a list is read with a ceiling (failed logins,
// API requests, signup cohort) an EXACT count is taken beside it and the
// answer carries `truncated: true` when the ceiling cut it. A capped figure is
// never presented as the whole (CLAUDE.md §7.4).
// ============================================

import { connect, type PeerCertificate } from 'node:tls'

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { browserOrigins } from '../../utils/browser-origins'
import { selectAllPages } from '../../utils/fetch-all-pages'
import {
  forecastMonthlyRevenue,
  zeroFilledMonths,
  type MonthlyRevenueForecast,
  type MonthlyRevenuePoint,
} from '../intelligence/forecast.domain'
import {
  LOGIN_FAILED_EVENT,
  aggregateFailedLogins,
  certificateState,
  httpsHosts,
  maskEmail,
  migrationStateFromProbe,
  paymentOutcomeRate,
  signupFunnel,
  summarizeApiUsage,
  type ApiRequestRow,
  type ApiUsageSummary,
  type CertificateState,
  type FailedLoginSummary,
  type FunnelStep,
  type MigrationState,
  type PaymentOutcomeRate,
} from './admin-insights.domain'
import { MIGRATION_CATALOG } from './migration-catalog'

type PgError = { code?: string; message: string } | null

/** PostgREST/Postgres codes for «this table or column is not there yet». */
function isMissingSchema(error: PgError): boolean {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')
}

function sinceHours(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

const FAILED_LOGIN_CAP = 5000
const API_USAGE_CAP = 10_000
const SIGNUP_COHORT_CAP = 5000
const IN_CHUNK = 200

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// ─── #49 ───────────────────────────────────────────────────────────────

export interface FailedLoginReport {
  status: 'ok' | 'not_configured'
  windowHours: number
  summary: FailedLoginSummary | null
  /** Exact number of failed sign-ins in the window. */
  total: number | null
  truncated: boolean
}

async function failedLogins(windowHours: number): Promise<FailedLoginReport> {
  const since = sinceHours(windowHours)
  const counted = await supabase
    .from('admin_security_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', LOGIN_FAILED_EVENT)
    .gte('created_at', since)
  if (counted.error) {
    if (isMissingSchema(counted.error)) {
      return { status: 'not_configured', windowHours, summary: null, total: null, truncated: false }
    }
    throw new DatabaseError('Failed to count failed sign-ins', counted.error)
  }

  const { data, error } = await supabase
    .from('admin_security_events')
    .select('ip_address, details, created_at')
    .eq('event_type', LOGIN_FAILED_EVENT)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(FAILED_LOGIN_CAP)
  if (error) throw new DatabaseError('Failed to read failed sign-ins', error)

  const rows = (
    (data ?? []) as Array<{ ip_address: string | null; details: unknown; created_at: string }>
  ).map((row) => {
    const details = (row.details ?? {}) as { account?: unknown }
    return {
      ipAddress: row.ip_address,
      account: typeof details.account === 'string' ? details.account : null,
      createdAt: row.created_at,
    }
  })
  const total = counted.count ?? rows.length
  return {
    status: 'ok',
    windowHours,
    summary: aggregateFailedLogins(rows),
    total,
    truncated: total > rows.length,
  }
}

// ─── #79 ───────────────────────────────────────────────────────────────

const OUTBOX_STATUSES = ['pending', 'sending', 'sent', 'failed'] as const

export interface EmailDeliveryReport {
  status: 'ok' | 'not_configured'
  byStatus: Record<(typeof OUTBOX_STATUSES)[number], number> | null
  sentLast24h: number | null
  oldestPendingAt: string | null
  recentFailures: Array<{
    id: string
    to: string
    subject: string
    attempts: number
    lastError: string | null
    createdAt: string
  }>
}

async function emailDelivery(): Promise<EmailDeliveryReport> {
  const empty: EmailDeliveryReport = {
    status: 'not_configured',
    byStatus: null,
    sentLast24h: null,
    oldestPendingAt: null,
    recentFailures: [],
  }
  const counts = await Promise.all(
    OUTBOX_STATUSES.map((status) =>
      supabase
        .from('email_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', status),
    ),
  )
  const firstError = counts.find((result) => result.error)?.error ?? null
  if (firstError) {
    if (isMissingSchema(firstError)) return empty
    throw new DatabaseError('Failed to count the email outbox', firstError)
  }
  const byStatus = {
    pending: counts[0]?.count ?? 0,
    sending: counts[1]?.count ?? 0,
    sent: counts[2]?.count ?? 0,
    failed: counts[3]?.count ?? 0,
  }

  const [sent24, oldest, failures] = await Promise.all([
    supabase
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', sinceHours(24)),
    supabase
      .from('email_outbox')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1),
    // A list to read, not a figure — the counts above are the figures.
    supabase
      .from('email_outbox')
      .select('id, to_email, subject, attempts, last_error, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  for (const result of [sent24, oldest, failures]) {
    if (result.error) throw new DatabaseError('Failed to read the email outbox', result.error)
  }

  const oldestRow = ((oldest.data ?? []) as Array<{ created_at: string }>)[0]
  return {
    status: 'ok',
    byStatus,
    sentLast24h: sent24.count ?? 0,
    oldestPendingAt: oldestRow?.created_at ?? null,
    recentFailures: (
      (failures.data ?? []) as Array<{
        id: string
        to_email: string
        subject: string
        attempts: number
        last_error: string | null
        created_at: string
      }>
    ).map((row) => ({
      id: row.id,
      to: maskEmail(row.to_email),
      subject: row.subject,
      attempts: row.attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
    })),
  }
}

// ─── #69 ───────────────────────────────────────────────────────────────

export interface MigrationStatusRow {
  file: string
  verify: string
  probe: string | null
  state: MigrationState
}

async function migrationStatus(): Promise<MigrationStatusRow[]> {
  return Promise.all(
    MIGRATION_CATALOG.map(async (entry) => {
      if (!entry.probe) {
        return { file: entry.file, verify: entry.verify, probe: null, state: 'unknown' as const }
      }
      // `limit(0)`: asks only whether the relation/column resolves. No count —
      // an exact count of `invoices` would be a full scan for a yes/no.
      const { error } = await supabase
        .from(entry.probe.table)
        .select(entry.probe.column ?? '*')
        .limit(0)
      return {
        file: entry.file,
        verify: entry.verify,
        probe: entry.probe.column
          ? `${entry.probe.table}.${entry.probe.column}`
          : entry.probe.table,
        state: migrationStateFromProbe(error),
      }
    }),
  )
}

// ─── #10 / #12 ─────────────────────────────────────────────────────────

export interface GatewayAnalyticsReport {
  status: 'ok' | 'not_configured'
  windowDays: number
  /** Stripe only: `invoice.paid` vs `invoice.payment_failed`. */
  stripe: PaymentOutcomeRate | null
  /** The latest processed provider events. Payload is never returned. */
  events: Array<{ id: string; type: string; processedAt: string | null }>
}

async function gatewayAnalytics(windowDays: number): Promise<GatewayAnalyticsReport> {
  const since = sinceHours(windowDays * 24)
  const countType = (type: string) =>
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
      .gte('processed_at', since)
  const [paid, failed, latest] = await Promise.all([
    countType('invoice.paid'),
    countType('invoice.payment_failed'),
    supabase
      .from('webhook_events')
      .select('id, type, processed_at')
      .order('processed_at', { ascending: false })
      .limit(50),
  ])
  const firstError = paid.error ?? failed.error ?? latest.error
  if (firstError) {
    if (isMissingSchema(firstError)) {
      return { status: 'not_configured', windowDays, stripe: null, events: [] }
    }
    throw new DatabaseError('Failed to read gateway events', firstError)
  }
  return {
    status: 'ok',
    windowDays,
    stripe: paymentOutcomeRate(paid.count ?? 0, failed.count ?? 0),
    events: (
      (latest.data ?? []) as Array<{ id: string; type: string; processed_at: string | null }>
    ).map((row) => ({ id: row.id, type: row.type, processedAt: row.processed_at })),
  }
}

// ─── #84 ───────────────────────────────────────────────────────────────

export interface UsageMetric {
  value: number | null
  status: 'ok' | 'not_configured' | 'not_measured'
}

export interface WorkspaceUsageReport {
  workspaceId: string
  windowDays: number
  members: UsageMetric
  activeDevices: UsageMetric
  invoices: UsageMetric
  aiQueries: UsageMetric
  apiRequests: UsageMetric
  activeApiKeys: UsageMetric
  /** No storage is metered per workspace; said, not guessed. */
  storageBytes: UsageMetric
}

async function countMetric(
  run: () => PromiseLike<{ count: number | null; error: PgError }>,
  what: string,
): Promise<UsageMetric> {
  const { count, error } = await run()
  if (error) {
    if (isMissingSchema(error)) return { value: null, status: 'not_configured' }
    throw new DatabaseError(`Failed to count ${what}`, error)
  }
  return { value: count ?? 0, status: 'ok' }
}

async function workspaceUsage(
  workspaceId: string,
  windowDays: number,
): Promise<WorkspaceUsageReport> {
  const since = sinceHours(windowDays * 24)
  const head = { count: 'exact' as const, head: true }
  const [members, activeDevices, invoices, aiQueries, apiRequests, activeApiKeys] =
    await Promise.all([
      countMetric(
        () => supabase.from('workspace_members').select('id', head).eq('workspace_id', workspaceId),
        'members',
      ),
      countMetric(
        () =>
          supabase
            .from('devices')
            .select('device_id', head)
            .eq('workspace_id', workspaceId)
            .is('released_at', null),
        'devices',
      ),
      countMetric(
        () => supabase.from('invoices').select('id', head).eq('workspace_id', workspaceId),
        'invoices',
      ),
      countMetric(
        () =>
          supabase
            .from('ai_query_log')
            .select('id', head)
            .eq('workspace_id', workspaceId)
            .gte('created_at', since),
        'AI queries',
      ),
      countMetric(
        () =>
          supabase
            .from('api_request_logs')
            .select('id', head)
            .eq('workspace_id', workspaceId)
            .gte('created_at', since),
        'API requests',
      ),
      countMetric(
        () =>
          supabase
            .from('api_keys')
            .select('id', head)
            .eq('workspace_id', workspaceId)
            .is('revoked_at', null),
        'API keys',
      ),
    ])
  return {
    workspaceId,
    windowDays,
    members,
    activeDevices,
    invoices,
    aiQueries,
    apiRequests,
    activeApiKeys,
    storageBytes: { value: null, status: 'not_measured' },
  }
}

// ─── #89 ───────────────────────────────────────────────────────────────

export interface UserActivityItem {
  id: string
  workspaceId: string | null
  action: string
  entityType: string
  entityId: string | null
  ipAddress: string | null
  createdAt: string
}

const ACTIVITY_PAGE = 50

async function userActivity(
  userId: string,
  before: string | null,
): Promise<{ items: UserActivityItem[]; nextBefore: string | null }> {
  let query = supabase
    .from('audit_logs')
    .select('id, workspace_id, action, entity_type, entity_id, ip_address, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_PAGE)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw new DatabaseError('Failed to read the activity timeline', error)
  const items = (
    (data ?? []) as Array<{
      id: string
      workspace_id: string | null
      action: string
      entity_type: string
      entity_id: string | null
      ip_address: string | null
      created_at: string
    }>
  ).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  }))
  const last = items[items.length - 1]
  return { items, nextBefore: items.length === ACTIVITY_PAGE && last ? last.createdAt : null }
}

// ─── #94 ───────────────────────────────────────────────────────────────

export interface SignupFunnelReport {
  windowDays: number
  steps: FunnelStep[]
  /** The cohort was cut at the cap: the steps describe the newest signups only. */
  truncated: boolean
  cohortTotal: number
}

async function businessesOwnedBy(
  userIds: readonly string[],
): Promise<Array<{ id: string; owner_id: string }>> {
  const out: Array<{ id: string; owner_id: string }> = []
  for (const chunk of chunks(userIds, IN_CHUNK)) {
    let result = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .in('owner_id', chunk)
      .eq('is_sandbox', false)
    // Without the sandbox migration there are no sandboxes to leave out.
    if (result.error && isMissingSchema(result.error)) {
      result = await supabase.from('workspaces').select('id, owner_id').in('owner_id', chunk)
    }
    if (result.error)
      throw new DatabaseError('Failed to read the cohort’s businesses', result.error)
    out.push(...((result.data ?? []) as Array<{ id: string; owner_id: string }>))
  }
  return out
}

async function payingWorkspaces(workspaceIds: readonly string[]): Promise<Set<string>> {
  const paying = new Set<string>()
  for (const chunk of chunks(workspaceIds, IN_CHUNK)) {
    const { data, error } = await supabase
      .from('billing_ledger_entries')
      .select('workspace_id')
      .eq('entry_type', 'PAYMENT')
      .in('workspace_id', chunk)
    if (error) {
      if (isMissingSchema(error)) return paying
      throw new DatabaseError('Failed to read payments for the cohort', error)
    }
    for (const row of (data ?? []) as Array<{ workspace_id: string }>) paying.add(row.workspace_id)
  }
  return paying
}

async function signupFunnelReport(windowDays: number): Promise<SignupFunnelReport> {
  const since = sinceHours(windowDays * 24)
  const counted = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  if (counted.error) throw new DatabaseError('Failed to count signups', counted.error)

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(SIGNUP_COHORT_CAP)
  if (error) throw new DatabaseError('Failed to read signups', error)

  const cohort = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
  const businesses = await businessesOwnedBy(cohort)
  const paying = await payingWorkspaces(businesses.map((row) => row.id))
  const owners = new Set(businesses.map((row) => row.owner_id))
  const payingOwners = new Set(
    businesses.filter((row) => paying.has(row.id)).map((row) => row.owner_id),
  )
  const cohortTotal = counted.count ?? cohort.length
  return {
    windowDays,
    steps: signupFunnel({
      signedUp: cohort.length,
      createdBusiness: owners.size,
      paid: payingOwners.size,
    }),
    truncated: cohortTotal > cohort.length,
    cohortTotal,
  }
}

// ─── #103 ──────────────────────────────────────────────────────────────

export interface RevenueForecastReport {
  status: 'ok' | 'not_configured'
  /** The platform ledger is in rial (`amount_irr`). */
  currency: 'IRR'
  history: MonthlyRevenuePoint[]
  forecast: MonthlyRevenueForecast | null
}

async function revenueForecast(): Promise<RevenueForecastReport> {
  const { data, error } = await selectAllPages<
    { entry_type: string; amount_irr: number | string; created_at: string },
    { message: string; code?: string }
  >((from, to) =>
    supabase
      .from('billing_ledger_entries')
      .select('entry_type, amount_irr, created_at')
      .in('entry_type', ['PAYMENT', 'REFUND'])
      .order('id', { ascending: true })
      .range(from, to),
  )
  if (error) {
    if (isMissingSchema(error)) {
      return { status: 'not_configured', currency: 'IRR', history: [], forecast: null }
    }
    throw new DatabaseError('Failed to read the billing ledger', error)
  }
  const asOf = new Date()
  const entries = (data ?? []).map((row) => {
    const amount = Math.abs(Number(row.amount_irr))
    return { at: row.created_at, signedMinor: row.entry_type === 'REFUND' ? -amount : amount }
  })
  const history = zeroFilledMonths(entries, asOf)
  return {
    status: 'ok',
    currency: 'IRR',
    history,
    forecast: forecastMonthlyRevenue({ asOf, series: history }),
  }
}

// ─── #113 ──────────────────────────────────────────────────────────────

export interface ApiUsageReport {
  status: 'ok' | 'not_configured'
  windowDays: number
  total: number | null
  truncated: boolean
  summary: ApiUsageSummary | null
  keyNames: Record<string, { name: string; prefix: string }>
}

async function apiUsage(windowDays: number): Promise<ApiUsageReport> {
  const since = sinceHours(windowDays * 24)
  const counted = await supabase
    .from('api_request_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  if (counted.error) {
    if (isMissingSchema(counted.error)) {
      return {
        status: 'not_configured',
        windowDays,
        total: null,
        truncated: false,
        summary: null,
        keyNames: {},
      }
    }
    throw new DatabaseError('Failed to count API requests', counted.error)
  }
  const { data, error } = await supabase
    .from('api_request_logs')
    .select('key_id, workspace_id, method, route, status, duration_ms')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(API_USAGE_CAP)
  if (error) throw new DatabaseError('Failed to read API requests', error)

  const rows: ApiRequestRow[] = (
    (data ?? []) as Array<{
      key_id: string
      workspace_id: string
      method: string
      route: string
      status: number
      duration_ms: number
    }>
  ).map((row) => ({
    keyId: row.key_id,
    workspaceId: row.workspace_id,
    method: row.method,
    route: row.route,
    status: row.status,
    durationMs: row.duration_ms,
  }))
  const summary = summarizeApiUsage(rows)

  const keyNames: ApiUsageReport['keyNames'] = {}
  for (const chunk of chunks(
    summary.byKey.map((row) => row.key),
    IN_CHUNK,
  )) {
    const keys = await supabase.from('api_keys').select('id, name, prefix').in('id', chunk)
    if (keys.error) throw new DatabaseError('Failed to read API key names', keys.error)
    for (const key of (keys.data ?? []) as Array<{ id: string; name: string; prefix: string }>) {
      keyNames[key.id] = { name: key.name, prefix: key.prefix }
    }
  }

  const total = counted.count ?? rows.length
  return { status: 'ok', windowDays, total, truncated: total > rows.length, summary, keyNames }
}

// ─── #58 ───────────────────────────────────────────────────────────────

export interface CertificateRow {
  host: string
  state: CertificateState
  daysLeft: number | null
  validTo: string | null
  issuer: string | null
  error: string | null
}

export interface CertificateReport {
  status: 'ok' | 'not_configured'
  checkedAt: string
  hosts: CertificateRow[]
}

const TLS_TIMEOUT_MS = 5000

function readCertificate(
  host: string,
): Promise<{ validTo: Date | null; issuer: string | null; error: string | null }> {
  return new Promise((resolve) => {
    const socket = connect({ host, port: 443, servername: host, timeout: TLS_TIMEOUT_MS })
    const done = (value: { validTo: Date | null; issuer: string | null; error: string | null }) => {
      socket.destroy()
      resolve(value)
    }
    socket.once('secureConnect', () => {
      const cert: PeerCertificate = socket.getPeerCertificate()
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null
      const issuerField = cert?.issuer?.O ?? cert?.issuer?.CN ?? null
      done({
        validTo,
        issuer: Array.isArray(issuerField) ? issuerField.join(', ') : issuerField,
        error: null,
      })
    })
    socket.once('timeout', () => done({ validTo: null, issuer: null, error: 'TIMEOUT' }))
    socket.once('error', (err: NodeJS.ErrnoException) =>
      done({ validTo: null, issuer: null, error: err.code ?? 'TLS_ERROR' }),
    )
  })
}

/** The hosts to check: the app's own production origins plus any the owner lists. */
export function monitoredHosts(env: Record<string, string | undefined> = process.env): string[] {
  const extra = (env.TLS_MONITORED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
    .map((host) => `https://${host.replace(/^https?:\/\//, '')}`)
  return httpsHosts([...browserOrigins(true), ...extra])
}

const CERT_TTL_MS = 60 * 60 * 1000
let certificateCache: { at: number; value: Promise<CertificateReport> } | null = null

async function sampleCertificates(): Promise<CertificateReport> {
  const hosts = monitoredHosts()
  const now = new Date()
  if (hosts.length === 0)
    return { status: 'not_configured', checkedAt: now.toISOString(), hosts: [] }
  const rows = await Promise.all(
    hosts.map(async (host) => {
      const read = await readCertificate(host)
      const { state, daysLeft } = certificateState(read.validTo, now)
      return {
        host,
        state,
        daysLeft,
        validTo: read.validTo ? read.validTo.toISOString() : null,
        issuer: read.issuer,
        error: read.error,
      }
    }),
  )
  return { status: 'ok', checkedAt: now.toISOString(), hosts: rows }
}

/** One TLS sample per hour for every admin; `refresh` forces a new one. */
async function certificates(refresh: boolean): Promise<CertificateReport> {
  const now = Date.now()
  if (!refresh && certificateCache && now - certificateCache.at < CERT_TTL_MS) {
    return certificateCache.value
  }
  const value = sampleCertificates()
  certificateCache = { at: now, value }
  return value
}

export const AdminInsightsService = {
  failedLogins,
  emailDelivery,
  migrationStatus,
  gatewayAnalytics,
  workspaceUsage,
  userActivity,
  signupFunnel: signupFunnelReport,
  revenueForecast,
  apiUsage,
  certificates,
}
