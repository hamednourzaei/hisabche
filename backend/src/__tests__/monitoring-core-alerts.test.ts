// ============================================
// backend/src/__tests__/monitoring-core-alerts.test.ts
//
// The core alert lifecycle (mission §9), on the ONE evaluator:
//
//  1. a GET (notify:false) never writes an event — no side effects;
//  2. a breach shorter than the duration is pending, not breaching;
//  3. a sustained breach raises exactly ONE open event (dedup);
//  4. re-evaluation inside the cooldown does not re-notify;
//  5. recovery resolves the open event and audits it;
//  6. a later breach raises a NEW event (history keeps both);
//  7. an unmeasurable core is unknown, never alerted as healthy;
//  8. the wildcard rule covers every core; a specific rule overrides it.
// ============================================

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

const db = new FakeDatabase()
const users = new Map<string, { id: string; email: string }>()

vi.mock('../db', () => createFakeDb(db, users))

let MonitoringService: typeof import('../services/monitoring/monitoring.service').MonitoringService

const RULE = {
  id: 'rule-core-pressure',
  metric: 'core_pressure',
  core_id: '*',
  comparator: '>',
  threshold: 70,
  duration_minutes: 5,
  severity: 'critical',
  is_enabled: true,
  cooldown_minutes: 60,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/** sales under pressure: 40% errors + slow latency saturates the formula. */
function snapshotWith(salesState: 'critical' | 'healthy') {
  const minute = new Date().toISOString()
  return {
    since: minute,
    cores:
      salesState === 'critical'
        ? [
            {
              core_id: 'sales',
              operations: 100,
              success: 60,
              errors: 40,
              client_errors: 0,
              duration_sum_ms: 90_000,
              duration_max_ms: 1500,
              duration_buckets: [0, 0, 0, 0, 0, 100],
              inflight_max: 10,
              concurrency_max: 12,
              timeouts: 6,
              dependency_wait_total_ms: 60_000,
              dependency_measured_count: 100,
              last_minute: minute,
            },
          ]
        : [
            {
              core_id: 'sales',
              operations: 100,
              success: 100,
              errors: 0,
              client_errors: 0,
              duration_sum_ms: 4000,
              duration_max_ms: 60,
              duration_buckets: [100, 0, 0, 0, 0, 0],
              inflight_max: 1,
              concurrency_max: 2,
              timeouts: 0,
              dependency_wait_total_ms: null,
              dependency_measured_count: 0,
              last_minute: minute,
            },
          ],
    gauges: [],
    instances: [],
    db: null,
  }
}

let salesState: 'critical' | 'healthy' = 'critical'

beforeAll(async () => {
  db.seed('metric_alert_rules', [RULE])
  db.seed('metric_alert_events', [])
  db.seed('admin_security_events', [])
  db.rpc('admin_core_monitor_snapshot', () => snapshotWith(salesState))
  db.rpc('admin_monitor_overview', () => ({
    since: new Date().toISOString(),
    requests: 0,
    errors5xx: 0,
    bytesOut: null,
    bytesUnknownRows: 0,
    onlineUsers: 0,
    onlineWorkspaces: 0,
    statusClasses: [],
    topRoutesByTime: [],
    topRoutesByBytes: [],
    instances: [],
  }))
  db.rpc('admin_db_vitals', () => ({
    database: { sizeBytes: 0 },
    connections: { active: 0, idle: 0, total: 0, max: 100 },
    cache: { hitRatio: 1 },
    locks: { waiting: 0, longestTransactionSeconds: 0 },
    replication: { lagSeconds: null },
    deadlocks: 0,
    tempBytes: 0,
    statements: null,
    statementsUnavailableReason: null,
  }))
  const mod = await import('../services/monitoring/monitoring.service')
  MonitoringService = mod.MonitoringService
})

afterAll(() => {
  vi.restoreAllMocks()
})

const T0 = new Date('2026-11-21T10:00:00Z')
const plus = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

function events() {
  return db.rows('metric_alert_events') as Array<Record<string, unknown>>
}

describe('the core alert lifecycle', () => {
  it('a screen read (notify:false) evaluates but never writes an event', async () => {
    const evaluations = await MonitoringService.evaluateAlerts({ notify: false, now: T0 })
    const sales = evaluations.find((entry) => entry.coreId === 'sales')
    expect(sales?.state).toBe('pending')
    expect(events()).toHaveLength(0)
  })

  it('a sustained breach raises exactly one open event with evidence', async () => {
    await MonitoringService.evaluateAlerts({ notify: true, now: plus(1) })
    const evaluations = await MonitoringService.evaluateAlerts({ notify: true, now: plus(6) })
    const sales = evaluations.find((entry) => entry.coreId === 'sales')
    expect(sales?.state).toBe('breaching')
    expect(sales?.breachedForMinutes).toBeGreaterThanOrEqual(5)

    const open = events().filter((event) => (event.resolved_at ?? null) === null)
    expect(open).toHaveLength(1)
    expect(open[0]!.core_id).toBe('sales')
    expect(open[0]!.metric).toBe('core_pressure')
    const evidence = open[0]!.evidence as { components: Array<{ key: string }> }
    expect(evidence.components.length).toBeGreaterThan(0)

    const audit = db.rows('admin_security_events') as Array<Record<string, unknown>>
    expect(audit.some((row) => row.event_type === 'METRIC_ALERT_RAISED')).toBe(true)
  })

  it('re-evaluation inside the cooldown keeps ONE event and does not re-notify', async () => {
    const before = events()[0]!.last_notified_at
    await MonitoringService.evaluateAlerts({ notify: true, now: plus(7) })
    await MonitoringService.evaluateAlerts({ notify: true, now: plus(8) })
    expect(events()).toHaveLength(1)
    expect(events()[0]!.last_notified_at).toBe(before)
  })

  it('recovery resolves the open event and audits the resolution', async () => {
    salesState = 'healthy'
    const evaluations = await MonitoringService.evaluateAlerts({ notify: true, now: plus(9) })
    const sales = evaluations.find((entry) => entry.coreId === 'sales')
    expect(sales?.state).toBe('ok')
    expect(events()[0]!.resolved_at).not.toBeNull()
    const audit = db.rows('admin_security_events') as Array<Record<string, unknown>>
    expect(audit.some((row) => row.event_type === 'METRIC_ALERT_RESOLVED')).toBe(true)
  })

  it('a later breach raises a NEW event — history keeps both', async () => {
    salesState = 'critical'
    await MonitoringService.evaluateAlerts({ notify: true, now: plus(10) })
    await MonitoringService.evaluateAlerts({ notify: true, now: plus(16) })
    expect(events()).toHaveLength(2)
    expect(events().filter((event) => (event.resolved_at ?? null) === null)).toHaveLength(1)
  })

  it('an unmeasurable core is unknown and never raises an event', async () => {
    const evaluations = await MonitoringService.evaluateAlerts({ notify: true, now: plus(17) })
    const ai = evaluations.find((entry) => entry.coreId === 'ai')
    expect(ai?.state).toBe('unknown')
    expect(events().some((event) => event.core_id === 'ai')).toBe(false)
  })

  it('a specific-core rule overrides the wildcard for that core', async () => {
    db.seed('metric_alert_rules', [
      RULE,
      {
        ...RULE,
        id: 'rule-sales-specific',
        core_id: 'sales',
        threshold: 200, // never breaches — the override silences the wildcard
      },
    ])
    const evaluations = await MonitoringService.evaluateAlerts({ notify: true, now: plus(20) })
    const salesEvaluations = evaluations.filter((entry) => entry.coreId === 'sales')
    // Only the specific rule evaluates sales; the wildcard skips it.
    expect(salesEvaluations).toHaveLength(1)
    expect(salesEvaluations[0]!.rule.id).toBe('rule-sales-specific')
    expect(salesEvaluations[0]!.state).toBe('ok')
  })
})
