// ============================================
// backend/src/__tests__/admin-core-monitoring-01.pg.test.ts
//
// docs/admin-core-monitoring-01-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE on top of admin-monitoring-01 (idempotent, additive);
//  2. every new table has RLS on and no anon/authenticated privilege;
//  3. the snapshot aggregates cores across instances without double counting,
//     keeps offline instances visible via last_seen, and returns the latest
//     gauge per core;
//  4. the hour rollup merges histograms element-wise and is idempotent;
//  5. the series keeps gaps as gaps (no zero-fill);
//  6. the prune is bounded and never deletes an OPEN alert event;
//  7. the partial unique index enforces one open event per (rule, core);
//  8. operation_group is a closed enum — a dynamic label is rejected;
//  9. no core table can hold a person, a workspace id or a raw URL.
//
// Local Windows note: embedded Postgres needs SeCreateGlobalPrivilege for its
// named shared-memory mapping; on a filtered admin token it fails with error
// 1314 (documented in helpers/pg-binaries.ts). These tests then fail loudly
// here and run in CI — they are never silently skipped.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-core-monitoring-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/coremonitoring`
let sql: postgres.Sql

const baseMigration = readFileSync(
  join(__dirname, '../../../docs/admin-monitoring-01-migration.sql'),
  'utf-8',
)
const migration = readFileSync(
  join(__dirname, '../../../docs/admin-core-monitoring-01-migration.sql'),
  'utf-8',
)

const TABLES = [
  'core_metrics_minute',
  'core_metrics_hour',
  'core_gauges_minute',
  'db_metrics_minute',
  'metric_alert_events',
]

describe('admin-core-monitoring-01-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE coremonitoring`
    await root.end()
    sql = postgres(url)
    await sql.unsafe(baseMigration)
  }, 90_000)

  afterAll(async () => {
    if (sql) await sql.end({ timeout: 2 })
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  it('applies twice without error (idempotent)', async () => {
    await sql.unsafe(migration)
    await expect(sql.unsafe(migration)).resolves.toBeDefined()
  })

  it('creates every core table with RLS enabled', async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY(${sql.array(TABLES)})
    `
    expect(rows).toHaveLength(TABLES.length)
    for (const row of rows) expect(row.relrowsecurity).toBe(true)
  })

  it('leaves anon/authenticated with no core table privilege', async () => {
    const grants = await sql<{ table_name: string }[]>`
      SELECT g.table_name
        FROM information_schema.role_table_grants g
       WHERE g.table_schema = 'public'
         AND g.table_name = ANY(${sql.array(TABLES)})
         AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
    `
    expect(grants).toHaveLength(0)
  })

  it('keeps the six infra rules and seeds the wildcard core rule', async () => {
    const rows = await sql<{ metric: string; core_id: string | null }[]>`
      SELECT metric, core_id FROM public.metric_alert_rules ORDER BY metric, core_id
    `
    expect(rows).toHaveLength(7)
    const wildcard = rows.find((row) => row.metric === 'core_pressure')
    expect(wildcard?.core_id).toBe('*')
    expect(rows.filter((row) => row.core_id === null)).toHaveLength(6)
  })

  it('adds rss_bytes and process_role to the instance table', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'instance_metrics_minute'
         AND column_name IN ('rss_bytes', 'process_role')
    `
    expect(rows.map((row) => row.column_name).sort()).toEqual(['process_role', 'rss_bytes'])
  })

  it('snapshot aggregates cores across instances and keeps offline instances', async () => {
    const minute = new Date()
    minute.setSeconds(0, 0)
    const oldMinute = new Date(Date.now() - 60 * 60 * 1000)
    oldMinute.setSeconds(0, 0)

    await sql`
      INSERT INTO public.core_metrics_minute
        (minute, instance_id, process_role, core_id, operation_group,
         operation_count, success_count, error_count, client_error_count,
         duration_sum_ms, duration_max_ms, duration_buckets,
         inflight_max, concurrency_max, timeout_count,
         dependency_wait_total_ms, dependency_measured_count)
      VALUES
        (${minute}, 'i-1', 'api', 'sales', 'read', 10, 9, 1, 0,
         500, 90, ${sql.array([0, 5, 5, 0, 0, 0])}, 3, 4, 0, 200, 5),
        (${minute}, 'i-2', 'api', 'sales', 'read', 5, 5, 0, 0,
         100, 40, ${sql.array([5, 0, 0, 0, 0, 0])}, 2, 2, 1, NULL, 0),
        (${minute}, 'i-1', 'api', 'sales', 'create', 2, 2, 0, 0,
         300, 150, ${sql.array([0, 0, 2, 0, 0, 0])}, 1, 1, 0, NULL, 0)
    `
    await sql`
      INSERT INTO public.core_gauges_minute
        (minute, instance_id, core_id, queue_depth, processing_count, stuck_count, retry_count)
      VALUES (${minute}, 'i-1', 'jobs', 12, 2, 1, 3)
    `
    // i-dead stopped an hour ago: its last row must stay visible.
    await sql`
      INSERT INTO public.instance_metrics_minute
        (minute, instance_id, process_role, cpu_percent, memory_percent, rss_bytes)
      VALUES
        (${minute}, 'i-1', 'api', 10, 20, 1000),
        (${oldMinute}, 'i-dead', 'worker', 5, 10, 500)
    `

    const rows = await sql<{ snapshot: Record<string, unknown> }[]>`
      SELECT public.admin_core_monitor_snapshot(NOW() - INTERVAL '1 hour') AS snapshot
    `
    const snapshot = rows[0]!.snapshot as {
      cores: Array<Record<string, unknown>>
      gauges: Array<Record<string, unknown>>
      instances: Array<Record<string, unknown>>
    }

    const sales = snapshot.cores.find((core) => core.core_id === 'sales')
    expect(sales).toBeDefined()
    // 10 + 5 + 2 across both instances and both groups — no double counting.
    expect(Number(sales!.operations)).toBe(17)
    expect(Number(sales!.errors)).toBe(1)
    expect(Number(sales!.timeouts)).toBe(1)
    expect(sales!.duration_buckets).toEqual([5, 5, 7, 0, 0, 0])
    expect(Number(sales!.inflight_max)).toBe(3)
    // dependency wait: only the 5 measured operations contribute.
    expect(Number(sales!.dependency_wait_total_ms)).toBe(200)
    expect(Number(sales!.dependency_measured_count)).toBe(5)

    const jobsGauge = snapshot.gauges.find((gauge) => gauge.core_id === 'jobs')
    expect(Number(jobsGauge!.queue_depth)).toBe(12)

    const ids = snapshot.instances.map((instance) => instance.instance_id).sort()
    expect(ids).toEqual(['i-1', 'i-dead'])
    const dead = snapshot.instances.find((instance) => instance.instance_id === 'i-dead')
    expect(dead!.process_role).toBe('worker')
    expect(new Date(String(dead!.last_seen)).getTime()).toBeLessThan(Date.now() - 30 * 60 * 1000)
  })

  it('rolls the hour up idempotently with merged histograms and queue max', async () => {
    const hour = new Date()
    hour.setMinutes(0, 0, 0)
    await sql`SELECT public.admin_core_monitor_rollup_hour(${hour})`
    await sql`SELECT public.admin_core_monitor_rollup_hour(${hour})`

    const rows = await sql<Record<string, unknown>[]>`
      SELECT operation_count, duration_buckets, queue_depth_max
        FROM public.core_metrics_hour
       WHERE hour = ${hour} AND core_id = 'sales' AND operation_group = 'read'
       ORDER BY instance_id
    `
    expect(rows).toHaveLength(2)
    const total = rows.reduce((sum, row) => sum + Number(row.operation_count), 0)
    expect(total).toBe(15)
    const i1 = rows.find((row) => Number(row.operation_count) === 10)
    expect(i1!.duration_buckets).toEqual([0, 5, 5, 0, 0, 0])

    const jobs = await sql<{ queue_depth_max: number }[]>`
      SELECT queue_depth_max FROM public.core_metrics_hour
       WHERE hour = ${hour} AND core_id = 'jobs'
    `
    // The jobs core had a gauge but no operations: the rollup only covers
    // minutes that have operation rows — gauges alone are not traffic.
    expect(jobs).toHaveLength(0)
  })

  it('series returns real buckets and keeps gaps absent', async () => {
    const rows = await sql<{ series: Array<Record<string, unknown>> }[]>`
      SELECT public.admin_core_monitor_series('sales', NOW() - INTERVAL '1 hour', 'minute') AS series
    `
    const series = rows[0]!.series
    expect(series.length).toBeGreaterThan(0)
    const point = series[series.length - 1]!
    expect(Number(point.operations)).toBe(17)
    expect(Number(point.errors)).toBe(1)
    expect(point.duration_buckets).toEqual([5, 5, 7, 0, 0, 0])

    const empty = await sql<{ series: Array<Record<string, unknown>> }[]>`
      SELECT public.admin_core_monitor_series('ai', NOW() - INTERVAL '1 hour', 'minute') AS series
    `
    // A core with no traffic has NO buckets — not a row of zeros.
    expect(empty[0]!.series).toEqual([])
  })

  it('prunes old core rows but never an open alert event', async () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await sql`
      INSERT INTO public.core_metrics_minute
        (minute, instance_id, core_id, operation_group, operation_count)
      VALUES (${old}, 'i-old', 'sales', 'read', 1)
    `
    const rule = await sql<{ id: string }[]>`
      SELECT id FROM public.metric_alert_rules WHERE metric = 'core_pressure' LIMIT 1
    `
    await sql`
      INSERT INTO public.metric_alert_events (rule_id, core_id, metric, severity, threshold, raised_at)
      VALUES (${rule[0]!.id}, 'sales', 'core_pressure', 'critical', 70, ${old})
    `
    const result = await sql<
      { pruned: { coreMinutesDeleted: number; resolvedEventsDeleted: number } }[]
    >`
      SELECT public.admin_core_monitor_prune(7, 90) AS pruned
    `
    expect(result[0]!.pruned.coreMinutesDeleted).toBeGreaterThan(0)

    const open = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM public.metric_alert_events WHERE resolved_at IS NULL
    `
    expect(Number(open[0]!.count)).toBe(1)
  })

  it('enforces one open event per (rule, core) at the database level', async () => {
    const rule = await sql<{ id: string }[]>`
      SELECT id FROM public.metric_alert_rules WHERE metric = 'core_pressure' LIMIT 1
    `
    await expect(
      sql`
        INSERT INTO public.metric_alert_events (rule_id, core_id, metric, severity, threshold)
        VALUES (${rule[0]!.id}, 'sales', 'core_pressure', 'critical', 70)
      `,
    ).rejects.toThrow()

    // A different core is a different event — allowed.
    await sql`
      INSERT INTO public.metric_alert_events (rule_id, core_id, metric, severity, threshold)
      VALUES (${rule[0]!.id}, 'inventory', 'core_pressure', 'critical', 70)
    `
    // Resolving the first frees the slot.
    await sql`
      UPDATE public.metric_alert_events SET resolved_at = NOW()
       WHERE core_id = 'sales' AND resolved_at IS NULL
    `
    await sql`
      INSERT INTO public.metric_alert_events (rule_id, core_id, metric, severity, threshold)
      VALUES (${rule[0]!.id}, 'sales', 'core_pressure', 'critical', 70)
    `
  })

  it('rejects a dynamic operation group label', async () => {
    const minute = new Date()
    await expect(
      sql`
        INSERT INTO public.core_metrics_minute
          (minute, instance_id, core_id, operation_group, operation_count)
        VALUES (${minute}, 'i-1', 'sales', 'customer-42', 1)
      `,
    ).rejects.toThrow()
  })

  it('has no column that could hold personal data or a raw URL', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT c.column_name
        FROM information_schema.columns c
       WHERE c.table_schema = 'public'
         AND c.table_name = ANY(${sql.array(TABLES)})
         AND c.column_name IN (
           'user_id', 'workspace_id', 'email', 'ip', 'ip_address',
           'user_agent', 'customer_id', 'admin_email', 'url', 'query'
         )
    `
    expect(rows).toHaveLength(0)
  })
})
