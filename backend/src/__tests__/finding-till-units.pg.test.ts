// ============================================
// docs/FINDING-till-units-and-routing-2026-10-14.sql, run for real.
//
// The owner pastes this into the live SQL editor to measure the damage of the
// live-audit bugs (#1 ×100 till figures, #2 ÷100 till ledger entries, #36 bank
// payments on the cash account, #47 the rates key). It must parse, must not
// write, and must count exactly the broken rows of a world built by hand.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 55000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-findtill-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const FILE = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'FINDING-till-units-and-routing-2026-10-14.sql'),
  'utf8',
)

const statements = FILE.split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TILL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CAPITAL_MOVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const BANK_PAY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const CASH_ACC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

let sql: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  await sql.unsafe(`
    CREATE TABLE workspaces (id uuid PRIMARY KEY, base_currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE pos_sessions (id uuid PRIMARY KEY, workspace_id uuid, currency text,
      status text NOT NULL DEFAULT 'open', label text, opened_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      method text, amount numeric(18,2), status text DEFAULT 'posted', pos_session_id uuid,
      till_amount_minor bigint, created_at timestamptz DEFAULT now());
    CREATE TABLE pos_cash_movements (id uuid PRIMARY KEY, session_id uuid, amount_minor bigint);
    CREATE TABLE journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      source_type text, source_id uuid);
    CREATE TABLE journal_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_id uuid,
      account_id uuid, debit numeric(19,4) DEFAULT 0, credit numeric(19,4) DEFAULT 0);
    CREATE TABLE accounts (id uuid PRIMARY KEY, role text);
    CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz);
    CREATE TABLE exchange_rates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      currency_code text, rate_date date);
    CREATE UNIQUE INDEX exchange_rates_workspace_currency_date_key
      ON exchange_rates (workspace_id, currency_code, rate_date);

    INSERT INTO workspaces VALUES ('${SHOP}', 'AFN');
    INSERT INTO pos_sessions (id, workspace_id, currency, label) VALUES ('${TILL}', '${SHOP}', NULL, 'صندوق تست');
    INSERT INTO accounts VALUES ('${CASH_ACC}', 'cash');

    -- Two cash payments into the afghani till: 4,000 stored ×100 (broken), 240 stored right.
    INSERT INTO payments (workspace_id, method, amount, pos_session_id, till_amount_minor) VALUES
      ('${SHOP}', 'cash', 4000, '${TILL}', 400000),
      ('${SHOP}', 'cash', 240,  '${TILL}', 240);

    -- Opening capital 10,000 in the drawer, 100 in the ledger.
    INSERT INTO pos_cash_movements VALUES ('${CAPITAL_MOVE}', '${TILL}', 10000);
    INSERT INTO journal_entries (id, workspace_id, source_type, source_id)
      VALUES ('11111111-1111-4111-8111-111111111111', '${SHOP}', 'opening_capital', '${CAPITAL_MOVE}');
    INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES
      ('11111111-1111-4111-8111-111111111111', '${CASH_ACC}', 100, 0),
      ('11111111-1111-4111-8111-111111111111', NULL, 0, 100);

    -- A bank transfer of 3,000 booked to the cash account.
    INSERT INTO payments (id, workspace_id, method, amount) VALUES ('${BANK_PAY}', '${SHOP}', 'bank', 3000);
    INSERT INTO journal_entries (id, workspace_id, source_type, source_id)
      VALUES ('22222222-2222-4222-8222-222222222222', '${SHOP}', 'payment', '${BANK_PAY}');
    INSERT INTO journal_lines (journal_id, account_id, debit, credit) VALUES
      ('22222222-2222-4222-8222-222222222222', '${CASH_ACC}', 3000, 0);
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const block = (marker: string) => {
  const found = statements.find((statement) => statement.includes(marker))
  if (!found) throw new Error(`no statement containing ${marker}`)
  return found
}

describe('FINDING-till-units-and-routing — runs, writes nothing, counts right', () => {
  it('every block parses and runs inside a read-only transaction', async () => {
    expect(statements.length).toBe(9)
    await sql.begin(async (tx) => {
      await tx.unsafe('SET TRANSACTION READ ONLY')
      for (const statement of statements) await tx.unsafe(statement)
    })
  })

  it('F1 finds the one ×100 payment, not the correct one', async () => {
    const rows = await sql.unsafe(block('sum(round(p.amount))'))
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.payments)).toBe(1)
    expect(Number(rows[0]!.stored_minor)).toBe(400_000)
    expect(Number(rows[0]!.should_be_minor)).toBe(4_000)
  })

  it('F2 finds the opening capital booked at 1/100', async () => {
    const rows = await sql.unsafe(block('ledger_debit'))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.source_type).toBe('opening_capital')
    expect(Number(rows[0]!.drawer_minor)).toBe(10_000)
    expect(Number(rows[0]!.ledger_debit)).toBe(100)
  })

  it('F3 finds the bank transfer on the cash account', async () => {
    const rows = await sql.unsafe(block("a.role = 'cash'"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.method).toBe('bank')
    expect(Number(rows[0]!.amount)).toBe(3000)
  })

  it('F4 shows the rates key when it exists', async () => {
    const rows = await sql.unsafe(block('FROM pg_indexes'))
    expect(rows.map((row) => row.indexname)).toContain('exchange_rates_workspace_currency_date_key')
  })

  it('F5 names the open till that must not be closed before a repair', async () => {
    const rows = await sql.unsafe(block('excess_minor'))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.label).toBe('صندوق تست')
    expect(Number(rows[0]!.excess_minor)).toBe(396_000)
  })
})
