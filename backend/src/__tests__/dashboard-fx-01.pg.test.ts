// ============================================
// docs/dashboard-fx-01-migration.sql — on a real Postgres, TWICE, then its
// VERIFY and the owner's own numbers (18 Oct 2026):
//
//   300,012,740 AFN of sales, a 2,307,692.3 USD sale at 65 (= 150,000,000),
//   and an 80 USD sale with NO rate.
//
//   v1 said 302,320,512 on the chart (dollars added raw) and 300,012,740 on
//   the headline (dollars left out). v2 says 450,012,740 on both, and names
//   the one invoice it could not convert instead of adding it at 1.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dashboard-fx-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dashboard_fx`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CUSTOMER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TODAY = '2026-10-18T09:00:00Z'
const DAY_START = '2026-10-18T00:00:00Z'
const MONTH = '2026-10-01T00:00:00Z'
const PREV = '2026-09-01T00:00:00Z'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dashboard_fx')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid, full_name text);
    CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      quantity numeric, min_stock_level numeric, buy_price numeric, category text, is_active boolean DEFAULT true);
    CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      type text, status text, total numeric, paid_amount numeric, currency text,
      exchange_rate numeric, date timestamptz, customer_id uuid);
    CREATE TABLE public.invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid,
      product_id uuid, product_name text, total_price numeric);
    INSERT INTO customers VALUES ('${CUSTOMER}', '${SHOP}', 'مشتری تست');
  `)
  await setup.unsafe(read('perf-aggregates-analytics-migration.sql'))
  // ⚠️ Twice: re-runnable, or nobody dares run it on a half-migrated database.
  await setup.unsafe(read('dashboard-fx-01-migration.sql'))
  await setup.unsafe(read('dashboard-fx-01-migration.sql'))
  await setup.unsafe(`
    INSERT INTO invoices (workspace_id, type, status, total, paid_amount, currency, exchange_rate, date, customer_id) VALUES
      -- the owner's afghani sales: 150M + 30M + 120M + 12,740
      ('${SHOP}', 'sale', 'paid', 150000000, 150000000, 'AFN', NULL, '${TODAY}', '${CUSTOMER}'),
      ('${SHOP}', 'sale', 'paid',  30000000,  30000000, 'AFN', NULL, '${TODAY}', '${CUSTOMER}'),
      ('${SHOP}', 'sale', 'paid', 120000000, 120000000, NULL,  NULL, '${TODAY}', '${CUSTOMER}'),
      ('${SHOP}', 'sale', 'paid',     12740,     12740, 'AFN', NULL, '${TODAY}', NULL),
      -- 2,307,692.3 USD at 65 — half paid, so 75M AFN still owed
      ('${SHOP}', 'sale', 'partial', 2307692.3, 1153846.15, 'USD', 65, '${TODAY}', '${CUSTOMER}'),
      -- 80 USD with no rate: cannot be converted
      ('${SHOP}', 'sale', 'paid', 80, 80, 'USD', NULL, '${TODAY}', NULL),
      -- a dollar PURCHASE at 64: 1,000 USD = 64,000 AFN
      ('${SHOP}', 'purchase', 'paid', 1000, 1000, 'USD', 64, '${TODAY}', NULL),
      -- another business: never counted
      ('${OTHER}', 'sale', 'paid', 999999999, 999999999, 'AFN', NULL, '${TODAY}', NULL);
  `)
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

const kpis = async (fn: string, books?: string) =>
  (books
    ? await sql.unsafe(`SELECT public.${fn}($1, $2, $3, $4, $5) AS r`, [
        SHOP,
        DAY_START,
        MONTH,
        PREV,
        books,
      ])
    : await sql.unsafe(`SELECT public.${fn}($1, $2, $3, $4) AS r`, [
        SHOP,
        DAY_START,
        MONTH,
        PREV,
      ]))[0]!.r
const sales = async (fn: string, books?: string) =>
  (books
    ? await sql.unsafe(`SELECT public.${fn}($1, $2, $3, $4, $5) AS r`, [
        SHOP,
        PREV,
        '2026-10-19T00:00:00Z',
        PREV,
        books,
      ])
    : await sql.unsafe(`SELECT public.${fn}($1, $2, $3, $4) AS r`, [
        SHOP,
        PREV,
        '2026-10-19T00:00:00Z',
        PREV,
      ]))[0]!.r

describe('dashboard-fx-01', () => {
  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-dashboard-fx-01.sql'))
    expect(rows.length).toBe(10)
    expect(rows.filter((row) => row.ok !== true)).toEqual([])
  })

  it('before: v1 adds the dollars raw on the chart — the owner’s 302,320,512 (minus 12,740 + the 80)', async () => {
    const v1 = await sales('analytics_sales_summary')
    // 300,012,740 + 2,307,692.3 + 80 — the very number on the live dashboard
    expect(Number(v1.total_revenue)).toBeCloseTo(302_320_512.3, 1)
  })

  it('after: the KPIs are in afghani at each invoice’s rate — 450,012,740, the 80 USD counted as not convertible', async () => {
    const r = await kpis('analytics_dashboard_kpis_v2', 'AFN')
    expect(Number(r.books.total_sales)).toBeCloseTo(450_012_739.5, 1)
    expect(Number(r.books.today_sales)).toBeCloseTo(450_012_739.5, 1)
    expect(Number(r.books.monthly_revenue)).toBeCloseTo(450_012_739.5, 1)
    expect(Number(r.books.customer_debt)).toBeCloseTo(74_999_999.75, 1)
    expect(Number(r.books.total_purchases)).toBe(64_000)
    expect(Number(r.books.unconverted_count)).toBe(1)
    expect(Number(r.books.today_invoices)).toBe(5)
    // the raw buckets are still there, as what they are
    const usd = r.currencies.find((c: { currency: string }) => c.currency === 'USD')
    expect(Number(usd.total_sales)).toBeCloseTo(2_307_772.3, 1)
  })

  it('after: the 7-day chart and the sales total read the same 450,012,740', async () => {
    const r = await sales('analytics_sales_summary_v2', 'AFN')
    expect(Number(r.total_revenue)).toBeCloseTo(450_012_739.5, 1)
    expect(Number(r.unconverted_count)).toBe(1)
    expect(Number(r.total_invoices)).toBe(5)
    const chart = r.chart.reduce((sum: number, d: { value: number }) => sum + Number(d.value), 0)
    expect(chart).toBeCloseTo(450_012_739.5, 1)
    // a customer's revenue is in afghani too: 300,000,000 + 150,000,000
    expect(Number(r.top_customers[0].revenue)).toBeCloseTo(449_999_999.5, 1)
  })

  it('a business keeping its books in dollars sees the afghani invoices as not convertible, never × 1', async () => {
    const r = await kpis('analytics_dashboard_kpis_v2', 'USD')
    // USD invoices are the books currency (as-is); an invoice with NO currency is
    // the books currency by the established rule (120M here); the three AFN ones
    // have no USD rate and are counted, not added.
    expect(Number(r.books.total_sales)).toBeCloseTo(2_307_692.3 + 80 + 120_000_000, 1)
    expect(Number(r.books.unconverted_count)).toBe(3)
  })

  it('anon and authenticated cannot call the new functions', async () => {
    const rows = await sql`
      SELECT has_function_privilege('anon', 'public.analytics_dashboard_kpis_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE') AS a,
             has_function_privilege('authenticated', 'public.analytics_sales_summary_v2(uuid, timestamptz, timestamptz, timestamptz, text)', 'EXECUTE') AS b`
    expect(rows[0]).toEqual({ a: false, b: false })
  })
})
