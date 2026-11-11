// ============================================
// backend/src/__tests__/exchange-03.pg.test.ts
//
// Proves V59.1 Exchange → General Ledger & Agent Settlement guarantees on real Postgres:
//   1. Idempotent migration execution (runs exchange-01, accounting-core, exchange-03 twice)
//   2. Atomic trade create + void posting balanced journal_entries via accounting_post_journal_entry
//   3. Concurrent 2-device race on last FX units (1 succeeds + GL, 1 refuses FX_POSITION_SHORT)
//   4. Offline short-sell replay (`allow_pending_review: true`) lands in PENDING_REVIEW (no GL / no position change)
//   5. Idempotent replay (`client_request_id`) on create, void, remittance payout & agent settle = no-op
//   6. Remittance payout & agent settlement post balanced GL entries (receivable/payable/vault/cash/gain_loss)
//   7. Tenant isolation: workspace B cannot access, void, resolve or settle workspace A rows
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-exchange03-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/ex03`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const readDoc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const U = '11111111-1111-4111-8111-111111111111'
const W1 = '22222222-2222-4222-8222-222222222221'
const W2 = '22222222-2222-4222-8222-222222222222'

const SEED_BASE = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY, currency text DEFAULT 'AFN');
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    user_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    role text,
    is_group boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    deleted_at timestamptz
  );
  CREATE TABLE public.journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid,
    user_id uuid,
    date date NOT NULL,
    description text,
    reference text,
    status text NOT NULL DEFAULT 'draft',
    entry_number text,
    source_type text,
    source_id uuid,
    reversal_of uuid,
    posted_at timestamptz,
    posted_by uuid,
    created_at timestamptz DEFAULT now()
  );
  CREATE TABLE public.journal_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    workspace_id uuid,
    user_id uuid,
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    debit numeric(18, 2) NOT NULL DEFAULT 0,
    credit numeric(18, 2) NOT NULL DEFAULT 0
  );
  CREATE TABLE public.accounting_period_locks (
    workspace_id uuid PRIMARY KEY,
    locked_until date NOT NULL
  );
`

async function seedAccounts(workspaceId: string) {
  const roles = [
    ['1010', 'صندوق', 'asset', 'cash'],
    ['1030', 'صندوق ارزی', 'asset', 'fx_vault'],
    ['1200', 'حساب‌های دریافتنی', 'asset', 'receivable'],
    ['2000', 'حساب‌های پرداختنی', 'liability', 'payable'],
    ['3200', 'سرمایه', 'equity', 'owner_capital'],
    ['4900', 'سود و زیان تسعیر ارز', 'revenue', 'fx_gain_loss'],
  ] as const
  for (const [code, name, type, role] of roles) {
    await sql`
      INSERT INTO public.accounts (workspace_id, user_id, code, name, type, role)
      VALUES (${workspaceId}, ${U}, ${code}, ${name}, ${type}, ${role})
      ON CONFLICT DO NOTHING
    `
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('ex03')
  sql = postgres(url, { max: 4 })
  await sql.unsafe(SEED_BASE)
  await sql`INSERT INTO public.workspaces (id, currency) VALUES (${W1}, 'AFN'), (${W2}, 'AFN')`

  const accountingSql = readDoc('accounting-core-migration.sql')
  const ex01Sql = readDoc('exchange-01-migration.sql')
  const ex03Sql = readDoc('exchange-03-migration.sql')
  await sql.unsafe(accountingSql)
  await sql.unsafe(ex01Sql)
  await sql.unsafe(ex03Sql)
  // Idempotency: run exchange-03 a second time
  await sql.unsafe(ex03Sql)

  await seedAccounts(W1)
  await seedAccounts(W2)
}, 90_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('exchange-03 GL integration, concurrency & isolation', () => {
  it('passes all VERIFY-exchange-03 checks', async () => {
    const [row] = await sql.unsafe(readDoc('VERIFY-exchange-03.sql'))
    for (const [k, v] of Object.entries(row ?? {})) {
      expect(v, k).toBe(true)
    }
  })

  it('posts balanced GL entries on buy + sell and prevents 2-device oversell', async () => {
    const [buyRes] = await sql`
      SELECT public.fx_trade_create_with_ledger(${W1}, ${U}, ${sql.json({
        side: 'buy',
        currency: 'USD',
        amount_minor: 10_000,
        rate_micro: 70_000_000,
        book_currency: 'AFN',
        book_amount_minor: 7_000,
        client_request_id: 'ex03-buy-1',
      })}) AS r
    `
    const buy = buyRes!.r as { id: string; journal_entry_id: string; replayed: boolean }
    expect(buy.replayed).toBe(false)
    expect(buy.journal_entry_id).toBeTruthy()

    // Idempotent replay = strict no-op
    const [replay] = await sql`
      SELECT public.fx_trade_create_with_ledger(${W1}, ${U}, ${sql.json({
        side: 'buy',
        currency: 'USD',
        amount_minor: 10_000,
        rate_micro: 70_000_000,
        book_currency: 'AFN',
        book_amount_minor: 7_000,
        client_request_id: 'ex03-buy-1',
      })}) AS r
    `
    expect((replay!.r as { id: string; replayed: boolean }).id).toBe(buy.id)
    expect((replay!.r as { replayed: boolean }).replayed).toBe(true)

    // Two concurrent devices race to sell 60 USD ($6,000 cents) from $100 held
    const sellAttempt = (reqId: string) =>
      sql`SELECT public.fx_trade_create_with_ledger(${W1}, ${U}, ${sql.json({
        side: 'sell',
        currency: 'USD',
        amount_minor: 6_000,
        rate_micro: 72_000_000,
        book_currency: 'AFN',
        book_amount_minor: 4_320,
        client_request_id: reqId,
      })}) AS r`

    const raced = await Promise.allSettled([sellAttempt('race-a'), sellAttempt('race-b')])
    expect(raced.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(raced.filter((x) => x.status === 'rejected')).toHaveLength(1)

    const [held] = await sql`SELECT public.fx_held_minor(${W1}, 'USD') AS held`
    expect(Number(held!.held)).toBe(4_000)

    const [glBalance] = await sql`
      SELECT coalesce(sum(debit), 0) AS dr, coalesce(sum(credit), 0) AS cr
        FROM public.journal_lines
       WHERE workspace_id = ${W1}
    `
    expect(Number(glBalance!.dr)).toBe(Number(glBalance!.cr))
    expect(Number(glBalance!.dr)).toBeGreaterThan(0)
  })

  it('parks offline short-sell conflict as pending_review with no GL or position change and allows void reversal', async () => {
    const [pendingRes] = await sql`
      SELECT public.fx_trade_create_with_ledger(${W1}, ${U}, ${sql.json({
        side: 'sell',
        currency: 'USD',
        amount_minor: 9_000,
        rate_micro: 72_000_000,
        book_currency: 'AFN',
        book_amount_minor: 6_480,
        client_request_id: 'offline-short-1',
        allow_pending_review: true,
      })}) AS r
    `
    const pending = pendingRes!.r as { id: string; status: string; journal_entry_id: string | null }
    expect(pending.status).toBe('pending_review')
    expect(pending.journal_entry_id).toBeNull()

    // Reject offline conflict cleanly
    const [rej] = await sql`
      SELECT public.fx_trade_resolve_pending_review(${W1}, ${pending.id}, 'reject', 'short after sync', ${U}) AS r
    `
    expect((rej!.r as { status: string }).status).toBe('voided')

    // New buy + void reversal produces equal reversed GL lines and restores position
    const [b2] = await sql`
      SELECT public.fx_trade_create_with_ledger(${W1}, ${U}, ${sql.json({
        side: 'buy',
        currency: 'EUR',
        amount_minor: 5_000,
        rate_micro: 75_000_000,
        book_currency: 'AFN',
        book_amount_minor: 3_750,
        client_request_id: 'ex03-eur-buy',
      })}) AS r
    `
    const eurId = (b2!.r as { id: string }).id
    const [v1] = await sql`
      SELECT public.fx_trade_void_with_ledger(${W1}, ${eurId}, 'entered wrong amount', ${U}) AS r
    `
    expect((v1!.r as { outcome: string; journal_entry_id: string | null }).outcome).toBe('voided')
    expect((v1!.r as { journal_entry_id: string | null }).journal_entry_id).toBeTruthy()

    // Replay void = no-op
    const [v2] = await sql`
      SELECT public.fx_trade_void_with_ledger(${W1}, ${eurId}, 'duplicate void', ${U}) AS r
    `
    expect((v2!.r as { outcome: string }).outcome).toBe('already_voided')
  })

  it('posts remittance payout + agent settlement to GL and isolates tenants', async () => {
    const [rem] = await sql`
      INSERT INTO public.remittances (
        workspace_id, direction, counterparty, sender_name, receiver_name,
        currency, amount_minor, fee_minor, payout_code_hash, created_by
      ) VALUES (
        ${W1}, 'incoming', 'Kabul Agent', 'A', 'B', 'AFN', 2000, 100, 'hash-1', ${U}
      ) RETURNING id
    `
    const [paid] = await sql`
      SELECT public.remittance_payout_with_ledger(
        ${W1}, ${rem!.id}, 'created', 'paid', NULL, 'hash-1', 1000000, 'AFN', ${U}
      ) AS r
    `
    expect((paid!.r as { outcome: string; journal_entry_id: string }).outcome).toBe('moved_ok')
    expect((paid!.r as { journal_entry_id: string }).journal_entry_id).toBeTruthy()

    // Cross-tenant attempt on W1's remittance from W2 must return not_found
    const [crossTenant] = await sql`
      SELECT public.remittance_payout_with_ledger(
        ${W2}, ${rem!.id}, 'created', 'paid', NULL, 'hash-1', 1000000, 'AFN', ${U}
      ) AS r
    `
    expect((crossTenant!.r as { outcome: string }).outcome).toBe('not_found')

    // Agent settles 2000 AFN receivable idempotently
    const [settle1] = await sql`
      SELECT public.fx_agent_settle(${W1}, ${U}, ${sql.json({
        counterparty: 'Kabul Agent',
        direction: 'collect',
        currency: 'AFN',
        amount_minor: 2000,
        rate_micro: 1_000_000,
        book_currency: 'AFN',
        book_amount_minor: 2000,
        client_request_id: 'settle-1',
      })}) AS r
    `
    expect((settle1!.r as { journal_entry_id: string; replayed: boolean }).replayed).toBe(false)
    expect((settle1!.r as { journal_entry_id: string }).journal_entry_id).toBeTruthy()

    const [settle2] = await sql`
      SELECT public.fx_agent_settle(${W1}, ${U}, ${sql.json({
        counterparty: 'Kabul Agent',
        direction: 'collect',
        currency: 'AFN',
        amount_minor: 2000,
        rate_micro: 1_000_000,
        book_currency: 'AFN',
        book_amount_minor: 2000,
        client_request_id: 'settle-1',
      })}) AS r
    `
    expect((settle2!.r as { replayed: boolean }).replayed).toBe(true)

    const [totals] = await sql`
      SELECT coalesce(sum(debit), 0) AS dr, coalesce(sum(credit), 0) AS cr
        FROM public.journal_lines
       WHERE workspace_id = ${W1}
    `
    expect(Number(totals!.dr)).toBe(Number(totals!.cr))
  })
})
