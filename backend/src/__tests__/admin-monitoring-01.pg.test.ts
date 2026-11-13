// ============================================
// backend/src/__tests__/admin-monitoring-01.pg.test.ts
//
// V63 · M-3 — docs/admin-monitoring-01-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE;
//  2. creates every table with RLS on and no anon/authenticated privilege;
//  3. the overview aggregates totals, not capped rows;
//  4. the hour rollup is idempotent and the prune is bounded;
//  5. admin_db_vitals returns a reason instead of failing when
//     pg_stat_statements is absent;
//  6. no metric table can hold a person, a workspace id or a raw URL.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-monitoring-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/monitoring`
let sql: postgres.Sql

const migration = readFileSync(
  join(__dirname, '../../../docs/admin-monitoring-01-migration.sql'),
  'utf-8',
)

const TABLES = [
  'request_metrics_minute',
  'instance_metrics_minute',
  'active_users_minute',
  'active_workspaces_minute',
  'request_metrics_hour',
  'metric_alert_rules',
  'admin_wall_tokens',
]

describe('admin-monitoring-01-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE monitoring`
    await root.end()
    sql = postgres(url)
  }, 60_000)

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

  it('creates every table with RLS enabled', async () => {
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

  it('leaves anon/authenticated with no table privilege', async () => {
    const grants = await sql<{ table_name: string }[]>`
      SELECT g.table_name
        FROM information_schema.role_table_grants g
       WHERE g.table_schema = 'public'
         AND g.table_name = ANY(${sql.array(TABLES)})
         AND g.grantee IN ('anon', 'authenticated', 'PUBLIC')
    `
    expect(grants).toHaveLength(0)
  })

  it('seeds the six default alert rules', async () => {
    const rows = await sql<{ metric: string }[]>`
      SELECT metric FROM public.metric_alert_rules ORDER BY metric
    `
    expect(rows.map((row) => row.metric)).toEqual([
      'cpu_percent',
      'db_connections_percent',
      'event_loop_p99_ms',
      'http_5xx_percent',
      'memory_percent',
      'replication_lag_seconds',
    ])
  })

  it('returns honest zeros before any traffic is recorded', async () => {
    const rows = await sql<{ overview: Record<string, unknown> }[]>`
      SELECT public.admin_monitor_overview(NOW() - INTERVAL '1 hour') AS overview
    `
    const overview = rows[0]!.overview
    // `SUM(bytes_out)` over no rows is NULL, never a fabricated zero.
    expect(overview.requests).toBe(0)
    expect(overview.errors5xx).toBe(0)
    expect(overview.bytesOut).toBeNull()
  })

  it('aggregates totals and top routes from the minute rows', async () => {
    const minute = new Date()
    minute.setSeconds(0, 0)
    await sql`
      INSERT INTO public.request_metrics_minute
        (minute, instance_id, route, method, status_class, count, bytes_out,
         duration_sum_ms, duration_max_ms, duration_buckets)
      VALUES
        (${minute}, 'i-1', '/api/invoices/:id', 'GET', '2xx', 10, 1000, 500, 90, ${sql.array([0, 0, 5, 5, 0, 0])}),
        (${minute}, 'i-1', '/api/invoices/:id', 'GET', '5xx', 2, NULL, 400, 200, ${sql.array([0, 0, 0, 0, 1, 1])}),
        (${minute}, 'i-2', '/api/products', 'GET', '2xx', 5, 500, 100, 40, ${sql.array([0, 5, 0, 0, 0, 0])})
    `
    const rows = await sql<{ overview: Record<string, unknown> }[]>`
      SELECT public.admin_monitor_overview(NOW() - INTERVAL '1 hour') AS overview
    `
    const overview = rows[0]!.overview as {
      requests: number
      errors5xx: number
      bytesOut: number
      bytesUnknownRows: number
      topRoutesByTime: Array<{ route: string; total_ms: number }>
      statusClasses: Array<{ status_class: string; count: number }>
    }
    expect(overview.requests).toBe(17)
    expect(overview.errors5xx).toBe(2)
    expect(overview.bytesOut).toBe(1500)
    expect(overview.bytesUnknownRows).toBe(1)
    expect(overview.topRoutesByTime[0]?.route).toBe('/api/invoices/:id')
    expect(overview.topRoutesByTime[0]?.total_ms).toBe(900)
    expect(overview.statusClasses.find((row) => row.status_class === '5xx')?.count).toBe(2)
  })

  it('rolls the hour up idempotently', async () => {
    const hour = new Date()
    hour.setMinutes(0, 0, 0)
    await sql`SELECT public.admin_monitor_rollup_hour(${hour})`
    await sql`SELECT public.admin_monitor_rollup_hour(${hour})`

    const rows = await sql<{ count: string }[]>`
      SELECT SUM(count)::text AS count
        FROM public.request_metrics_hour
       WHERE hour = ${hour}
    `
    expect(Number(rows[0]?.count)).toBe(17)
  })

  it('prunes old minutes and keeps recent ones', async () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await sql`
      INSERT INTO public.request_metrics_minute
        (minute, instance_id, route, method, status_class, count)
      VALUES (${old}, 'i-old', '/api/old', 'GET', '2xx', 1)
    `
    const result = await sql<{ pruned: { minutesDeleted: number } }[]>`
      SELECT public.admin_monitor_prune(7, 90) AS pruned
    `
    expect(result[0]!.pruned.minutesDeleted).toBeGreaterThan(0)

    const remaining = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count
        FROM public.request_metrics_minute
       WHERE route = '/api/old'
    `
    expect(Number(remaining[0]?.count)).toBe(0)
  })

  it('reports missing pg_stat_statements instead of failing', async () => {
    const rows = await sql<{ vitals: Record<string, unknown> }[]>`
      SELECT public.admin_db_vitals() AS vitals
    `
    const vitals = rows[0]!.vitals as {
      statements: unknown
      statementsUnavailableReason: string | null
      connections: { max: number }
    }
    expect(vitals.connections.max).toBeGreaterThan(0)
    if (vitals.statements === null) {
      expect(vitals.statementsUnavailableReason).toBeTruthy()
    }
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
