// ============================================
// Cost of goods across purchases at different prices — real Postgres.
//
// docs/inventory-costing-migration.sql + inventory-consume-concurrency +
// inventory-avco-01 (run TWICE), and `inventory_consume_layers` called the way
// `costing.service` calls it.
//
// The owner's acceptance case (18 Oct 2026): one gearbox bought three times —
//   #1  1 × $1,000 at 65  → layer 65,000 AFN
//   #2  1 × $2,000 at 66  → layer 132,000 AFN
//   #3  1 × $3,000 at 64  → layer 192,000 AFN
// then sold one at a time. A later, higher market price must never re-cost a
// purchase already made.
//
// ⚠️ The layers are inserted the way a purchase invoice writes them (unit cost
// already in the books' currency at that invoice's rate). This test proves the
// CONSUMPTION — which layer a sale takes and at what cost. Revenue and the
// journal entry are the service's and are not exercised here.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { collapseLines, normaliseLines } from '../services/accounting/accounting.domain'
import { inBooksCurrency, invoiceLedgerLines } from '../services/accounting/invoice-posting.domain'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-avco-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/avco`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const GEARBOX = '20000000-0000-4000-8000-000000000001'
const WH = '30000000-0000-4000-8000-000000000001'

const PURCHASES = [
  { day: '2026-10-01', usd: 1000, rate: 65 },
  { day: '2026-10-05', usd: 2000, rate: 66 },
  { day: '2026-10-09', usd: 3000, rate: 64 },
]

async function buyThreeTimes() {
  for (const [i, p] of PURCHASES.entries()) {
    await sql`
      INSERT INTO cost_layers (workspace_id, product_id, warehouse_id, source_type, source_id,
        source_line, received_qty, remaining_qty, unit_cost, currency, entry_date, created_by)
      VALUES (${WS}, ${GEARBOX}, ${WH}, 'purchase_invoice', gen_random_uuid(), ${String(i)},
        1, 1, ${p.usd * p.rate}, 'AFN', ${p.day}, ${USER})`
  }
}

async function sell(n: number) {
  const [row] = await sql<{ r: { status: string; total_cost: number; shortfall: number } }[]>`
    SELECT public.inventory_consume_layers(${WS}::uuid, ${USER}::uuid, ${sql.json({
      product_id: GEARBOX,
      warehouse_id: WH,
      quantity: 1,
      entry_date: '2026-10-18',
      consumer_type: 'sales_invoice',
      consumer_id: `40000000-0000-4000-8000-00000000000${n}`,
      consumer_line: '0',
    } as never)}::jsonb) AS r`
  return { ...row!.r, total_cost: Number(row!.r.total_cost) }
}

const remainingByLayer = async () =>
  (
    await sql<{ unit_cost: string; remaining_qty: string }[]>`
      SELECT unit_cost, remaining_qty FROM cost_layers ORDER BY entry_date`
  ).map((l) => [Number(l.unit_cost), Number(l.remaining_qty)])

const stockValue = async () =>
  Number(
    (await sql`SELECT COALESCE(SUM(remaining_qty * unit_cost), 0) AS v FROM cost_layers`)[0]!.v,
  )

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('avco')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE workspace_members (workspace_id uuid, user_id uuid, role text, has_access boolean, suspended_at timestamptz);
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid, name text, quantity numeric DEFAULT 0);
    CREATE TABLE warehouses (id uuid PRIMARY KEY, workspace_id uuid, user_id uuid, name text);
    CREATE TABLE warehouse_stock (
      warehouse_id uuid, product_id uuid, quantity numeric DEFAULT 0, workspace_id uuid, user_id uuid,
      updated_at timestamptz DEFAULT now(), PRIMARY KEY (warehouse_id, product_id));
    CREATE TABLE stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, type text NOT NULL,
      quantity numeric NOT NULL DEFAULT 0, reference_type text, reference_id uuid, notes text,
      created_at timestamptz DEFAULT now(), user_id uuid NOT NULL,
      from_warehouse_id uuid, to_warehouse_id uuid, workspace_id uuid);
    CREATE TABLE branches (id uuid PRIMARY KEY, workspace_id uuid, name text);
    -- The ledger tables as docs/base-schema-migration.sql makes them, except
    -- deleted_at: there it defaults to now(), which would hide every row from
    -- the posting check and the trial balance.
    CREATE TABLE accounts (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, code text NOT NULL, name text NOT NULL,
      type text NOT NULL, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(),
      user_id uuid NOT NULL, parent_id uuid, deleted_at timestamp);
    CREATE TABLE journal_entries (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, date date NOT NULL, description text,
      reference text, user_id uuid, created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(), deleted_at timestamp);
    CREATE TABLE journal_lines (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, journal_id uuid, account_id uuid,
      debit numeric(19,4) DEFAULT 0 NOT NULL, credit numeric(19,4) DEFAULT 0 NOT NULL,
      user_id uuid, created_at timestamp DEFAULT now());
`)
  await setup.unsafe(read('accounting-core-migration.sql'))
  // As docs/branch-migration.sql adds it on the live database.
  await setup.unsafe(
    'ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id)',
  )
  await setup.unsafe(read('phase-j-01-branch-period-lock-migration.sql'))
  await setup.unsafe(read('inventory-costing-migration.sql'))
  await setup.unsafe(read('inventory-consume-concurrency-migration.sql'))
  await setup.unsafe(read('inventory-avco-01-migration.sql'))
  await setup.unsafe(read('inventory-avco-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

beforeEach(async () => {
  await sql`DELETE FROM cost_consumptions`
  await sql`DELETE FROM cost_layers`
  await sql`DELETE FROM inventory_settings`
  await buyThreeTimes()
})

describe('FIFO (the default): each sale takes the oldest purchase, at ITS price', () => {
  it('sale 1 → layer 1 (65,000), sale 2 → layer 2 (132,000), the rest stays in layer 3', async () => {
    const first = await sell(1)
    expect(first.total_cost).toBe(65_000)
    expect(await remainingByLayer()).toEqual([
      [65_000, 0],
      [132_000, 1],
      [192_000, 1],
    ])
    // Sold at $4,000 × 65 = 260,000 → gross profit 195,000 (service arithmetic).
    expect(260_000 - first.total_cost).toBe(195_000)

    const second = await sell(2)
    expect(second.total_cost).toBe(132_000)
    expect(await remainingByLayer()).toEqual([
      [65_000, 0],
      [132_000, 0],
      [192_000, 1],
    ])
    expect(await stockValue()).toBe(192_000)
  })

  it('a retried sale takes nothing twice', async () => {
    await sell(1)
    const again = await sell(1)
    expect(again.status).toBe('already_consumed')
    expect(again.total_cost).toBe(65_000)
    expect(await stockValue()).toBe(132_000 + 192_000)
  })

  it('a fourth sale with three bought is refused (negative stock is blocked by default)', async () => {
    await sell(1)
    await sell(2)
    await sell(3)
    await expect(sell(4)).rejects.toThrow(/INVENTORY_INSUFFICIENT_STOCK/)
  })
})

describe('میانگین موزون (avco): every sale at the average, and the average holds', () => {
  beforeEach(async () => {
    await sql`INSERT INTO inventory_settings (workspace_id, costing_method) VALUES (${WS}, 'avco')`
  })

  // Quantities are stored with four decimals (numeric(18,4)): a third of a
  // gearbox is 0.3333, so one sale's share can be off by at most 0.0001 of a
  // unit per layer. That is the whole tolerance — and it never leaks: what was
  // sold plus what is left is ALWAYS exactly what was paid.
  const ROUNDING = 0.0001 * (65_000 + 132_000 + 192_000)

  it('three sales cost what was paid in total — 389,000, not 483,667', async () => {
    const average = (65_000 + 132_000 + 192_000) / 3
    const costs: number[] = []
    for (const n of [1, 2, 3]) {
      costs.push((await sell(n)).total_cost)
      // Conservation, exact after every sale.
      expect(costs.reduce((a, b) => a + b, 0) + (await stockValue())).toBeCloseTo(389_000, 2)
    }
    for (const cost of costs) expect(Math.abs(cost - average)).toBeLessThanOrEqual(ROUNDING)
    expect(costs.reduce((a, b) => a + b, 0)).toBeCloseTo(389_000, 2)
    expect(await stockValue()).toBeCloseTo(0, 2)
  })

  it('after one sale, what is left is still valued at the same average', async () => {
    const sale = await sell(1)
    const left = await stockValue()
    expect(sale.total_cost + left).toBeCloseTo(389_000, 2)
    const qty = Number((await sql`SELECT SUM(remaining_qty) AS q FROM cost_layers`)[0]!.q)
    expect(qty).toBeCloseTo(2, 4)
    // The old function left 162,000 here (the cheap layer gone); now ~129,667.
    expect(Math.abs(left / qty - 389_000 / 3)).toBeLessThanOrEqual(ROUNDING)
  })

  it('every consumption row carries its own layer price (the trail survives)', async () => {
    await sell(1)
    const rows = await sql<{ unit_cost: string }[]>`
      SELECT DISTINCT unit_cost FROM cost_consumptions ORDER BY unit_cost`
    expect(rows.map((r) => Number(r.unit_cost))).toEqual([65_000, 132_000, 192_000])
  })
})

describe('the migration', () => {
  it('ran twice without error and kept the function private', async () => {
    const [row] = await sql<{ anon: boolean; auth: boolean }[]>`
      SELECT has_function_privilege('anon', 'public.inventory_consume_layers(uuid, uuid, jsonb)', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'public.inventory_consume_layers(uuid, uuid, jsonb)', 'EXECUTE') AS auth`
    expect(row).toEqual({ anon: false, auth: false })
  })
})

// ─── The whole chain, on real Postgres (owner's acceptance, 18 Oct 2026) ────
//
// purchase invoice ($ at its rate) → cost layer + journal entry → sale
// invoice ($ at its rate) → inventory_consume_layers → cost of goods →
// journal entry → trial balance → profit → balance sheet.
//
// The journal lines are invoiceLedgerLines — the function
// InvoiceService#createAccountingEntries posts — run through the same
// normaliseLines/collapseLines as ledger.postDocument, into the real
// accounting_post_journal_entry (which refuses an unbalanced entry).
// What is NOT here: HTTP and supabase-js. The arithmetic and the database are.

const ACC = {
  inventory: '50000000-0000-4000-8000-000000000001',
  payable: '50000000-0000-4000-8000-000000000002',
  receivable: '50000000-0000-4000-8000-000000000003',
  sales: '50000000-0000-4000-8000-000000000004',
  cogs: '50000000-0000-4000-8000-000000000005',
}
const TYPES: Record<string, string> = {
  inventory: 'asset',
  payable: 'liability',
  receivable: 'asset',
  sales: 'revenue',
  cogs: 'expense',
}
const ROUNDING_E2E = 0.0001 * (65_000 + 132_000 + 192_000)

async function post(sourceId: string, day: string, lines: ReturnType<typeof invoiceLedgerLines>) {
  const clean = collapseLines(normaliseLines(lines))
  await sql`
    SELECT public.accounting_post_journal_entry(${WS}::uuid, ${USER}::uuid,
      ${sql.json({ date: day, description: 'e2e', reference: sourceId, status: 'posted', source_type: 'invoice', source_id: sourceId } as never)}::jsonb,
      ${sql.json(clean.map((l) => ({ account_id: l.accountId, debit: l.debit, credit: l.credit })) as never)}::jsonb)`
}

async function buyOnInvoices() {
  for (const [i, p] of PURCHASES.entries()) {
    const invoice = `60000000-0000-4000-8000-00000000000${i + 1}`
    const total = inBooksCurrency(p.usd, p.rate)
    await sql`
      INSERT INTO cost_layers (workspace_id, product_id, warehouse_id, source_type, source_id,
        source_line, received_qty, remaining_qty, unit_cost, currency, entry_date, created_by)
      VALUES (${WS}, ${GEARBOX}, ${WH}, 'purchase_invoice', ${invoice}, '0',
        1, 1, ${total}, 'AFN', ${p.day}, ${USER})`
    await post(invoice, p.day, invoiceLedgerLines({ isPurchase: true, total, accounts: ACC }))
  }
}

async function sellOnInvoice(n: number, usd: number, rate: number) {
  const cost = (await sell(n)).total_cost
  const revenue = inBooksCurrency(usd, rate)
  await post(
    `40000000-0000-4000-8000-00000000000${n}`,
    '2026-10-18',
    invoiceLedgerLines({
      isPurchase: false,
      total: revenue,
      costOfGoodsSold: Math.round(cost * 100) / 100,
      accounts: ACC,
    }),
  )
  return { cost, revenue }
}

async function trialBalance() {
  const rows = await sql<{ account_role: string; total_debit: string; total_credit: string }[]>`
    SELECT account_role, total_debit, total_credit
      FROM public.accounting_trial_balance(${WS}::uuid, NULL, NULL)`
  const by: Record<string, number> = {}
  let debit = 0
  let credit = 0
  for (const r of rows) {
    by[r.account_role] = Number(r.total_debit) - Number(r.total_credit)
    debit += Number(r.total_debit)
    credit += Number(r.total_credit)
  }
  return { by, debit, credit }
}

describe.each(['fifo', 'avco'] as const)('E2E %s: invoices → ledger → trial balance', (method) => {
  beforeEach(async () => {
    await sql`DELETE FROM journal_lines`
    await sql`DELETE FROM journal_entries`
    await sql`DELETE FROM accounts`
    await sql`DELETE FROM cost_consumptions`
    await sql`DELETE FROM cost_layers`
    await sql`DELETE FROM inventory_settings`
    for (const [role, id] of Object.entries(ACC)) {
      await sql`INSERT INTO accounts (id, code, name, type, user_id, workspace_id, role)
        VALUES (${id}, ${role}, ${role}, ${TYPES[role]!}, ${USER}, ${WS}, ${role})`
    }
    if (method === 'avco') {
      await sql`INSERT INTO inventory_settings (workspace_id, costing_method) VALUES (${WS}, 'avco')`
    }
    await buyOnInvoices()
  })

  it('after the purchases: inventory 389,000 owed to the supplier, books balanced', async () => {
    const tb = await trialBalance()
    expect(tb.debit).toBeCloseTo(tb.credit, 2)
    expect(tb.by.inventory).toBeCloseTo(389_000, 2)
    expect(tb.by.payable).toBeCloseTo(-389_000, 2)
  })

  it('two sales ($4,000 at 65, $4,500 at 70): revenue, cost, profit, balance sheet', async () => {
    const one = await sellOnInvoice(1, 4000, 65)
    const two = await sellOnInvoice(2, 4500, 70)
    expect(one.revenue).toBe(260_000)
    expect(two.revenue).toBe(315_000)

    if (method === 'fifo') {
      expect(one.cost).toBe(65_000)
      expect(two.cost).toBe(132_000)
    } else {
      expect(Math.abs(one.cost - 389_000 / 3)).toBeLessThanOrEqual(ROUNDING_E2E)
      expect(Math.abs(two.cost - 389_000 / 3)).toBeLessThanOrEqual(ROUNDING_E2E)
    }

    const tb = await trialBalance()
    expect(tb.debit).toBeCloseTo(tb.credit, 2)
    const revenue = -(tb.by.sales ?? 0)
    const cogs = tb.by.cogs ?? 0
    expect(revenue).toBeCloseTo(575_000, 2)
    expect(cogs).toBeCloseTo(one.cost + two.cost, 1)
    const profit = revenue - cogs
    // Assets = Liabilities + Equity, where equity is this year's profit.
    const assets = (tb.by.inventory ?? 0) + (tb.by.receivable ?? 0)
    const liabilities = -(tb.by.payable ?? 0)
    expect(assets).toBeCloseTo(liabilities + profit, 1)
    // The inventory account agrees with the goods still on the layers.
    expect(tb.by.inventory ?? 0).toBeCloseTo(await stockValue(), 1)
    // Today's higher rate (70) re-prices nothing bought at 65/66/64.
    const bought = await sql`SELECT SUM(received_qty * unit_cost) AS v FROM cost_layers`
    expect(Number(bought[0]!.v)).toBeCloseTo(389_000, 2)
  })
})
