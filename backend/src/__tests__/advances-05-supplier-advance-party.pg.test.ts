// ============================================
// docs/advances-05-supplier-advance-party-migration.sql run twice on real Postgres.
//
// The subject is the PARTY the supplier-advance engine books against after
// advances-04 moved the supplier out of `customer_id`. The two database
// dependencies that are not the subject - `payments_record` and
// `accounting_post_journal_entry` - are stubs that RECORD what the function
// asked them to write, so the assertion is on the contract:
//
//   * a new-style row (supplier_id set, customer_id NULL) books against the
//     supplier, not NULL;
//   * a historical mapped row (supplier_id NULL, customer_id = supplier) still
//     works through COALESCE;
//   * an unresolved row is refused, never posted under a guessed party;
//   * another workspace's advance is not found;
//   * only service_role may execute the functions.
//
// Advances-04's triggers are not installed here on purpose: the historical row
// this test protects was written BEFORE those triggers existed.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const pg = new EmbeddedPostgres({
  databaseDir: pgTempDir('hisabche-pg-adv05-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/adv05`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const W = '11111111-1111-4111-8111-111111111111'
const W2 = '11111111-1111-4111-8111-111111111112'
const S = '33333333-3333-4333-8333-333333333333'
const BUYER = '44444444-4444-4444-8444-444444444444'
const NEW_ADVANCE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LEGACY_ADVANCE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const UNRESOLVED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const FOREIGN_ADVANCE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const PURCHASE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const ACCOUNT_ADVANCES = '10000000-0000-4000-8000-000000000001'
const ACCOUNT_OTHER = '10000000-0000-4000-8000-000000000002'

type Row = Record<string, unknown>

async function reject(statement: string, pattern: RegExp): Promise<string> {
  try {
    await sql.unsafe(statement)
  } catch (error) {
    const message = String((error as Error).message)
    expect(message).toMatch(pattern)
    return message
  }
  throw new Error('statement was ACCEPTED but must be refused: ' + statement.slice(0, 120))
}

const callApply = async (deposit: string, workspace = W): Promise<Row> => {
  const rows = await sql`SELECT public.supplier_advance_apply(
        ${workspace}::uuid, ${BUYER}::uuid, ${deposit}::uuid, ${PURCHASE}::uuid,
        100000::bigint, 0::smallint, '2026-11-23'::date, 'apply-key-0001',
        ${ACCOUNT_ADVANCES}::uuid, ${ACCOUNT_OTHER}::uuid, 'owner'
      ) AS result`
  return rows[0]!.result as Row
}

const callRefund = async (deposit: string, workspace = W): Promise<Row> => {
  const rows = await sql`SELECT public.supplier_advance_refund(
        ${workspace}::uuid, ${BUYER}::uuid, ${deposit}::uuid, 50000::bigint, 0::smallint,
        '2026-11-23'::date, 'cash', 'supplier returned the money', 'refund-key-0001',
        ${ACCOUNT_ADVANCES}::uuid, ${ACCOUNT_OTHER}::uuid, 'owner'
      ) AS result`
  return rows[0]!.result as Row
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('adv05')
  sql = postgres(url, { max: 1, onnotice: () => {} })

  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    CREATE TABLE public.customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      full_name text NOT NULL
    );
    CREATE TABLE public.suppliers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE public.order_deposits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      order_id uuid NOT NULL,
      customer_id uuid,
      supplier_id uuid,
      amount_minor bigint NOT NULL,
      currency text,
      posting_status text,
      applied_invoice_id uuid,
      source_type text NOT NULL DEFAULT 'sales_order',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      type text,
      customer_id uuid,
      supplier_id uuid,
      currency text,
      total numeric(18,2) NOT NULL DEFAULT 0,
      status text
    );
    CREATE TABLE public.payment_allocations (
      workspace_id uuid NOT NULL,
      invoice_id uuid NOT NULL,
      amount numeric(18,2) NOT NULL
    );
    CREATE TABLE public.payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      payment_number text,
      journal_entry_id uuid,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.journal_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      source_type text,
      source_id uuid,
      status text,
      entry_number text
    );
    CREATE TABLE public.order_deposit_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      deposit_id uuid NOT NULL,
      invoice_id uuid NOT NULL,
      amount_minor bigint NOT NULL,
      currency text,
      idempotency_key text NOT NULL,
      payment_id uuid,
      journal_entry_id uuid,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.order_deposit_refunds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      deposit_id uuid NOT NULL,
      amount_minor bigint NOT NULL,
      currency text,
      method text,
      reason text,
      idempotency_key text NOT NULL,
      payment_id uuid,
      journal_entry_id uuid,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    -- What the stubs were asked to write.
    CREATE TABLE public.test_payment_calls (
      seq bigserial,
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      payload jsonb NOT NULL,
      allocations jsonb NOT NULL
    );
    CREATE TABLE public.test_journal_calls (
      seq bigserial,
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      header jsonb NOT NULL,
      lines jsonb NOT NULL
    );

    CREATE OR REPLACE FUNCTION public.order_deposit_balance(p_workspace_id uuid, p_deposit_id uuid)
    RETURNS jsonb LANGUAGE sql AS $stub$
      SELECT jsonb_build_object('applied_minor', 0, 'refunded_minor', 0, 'remaining_minor', 1000000)
    $stub$;

    CREATE OR REPLACE FUNCTION public.payments_record(
      p_workspace_id uuid, p_user_id uuid, p_payload jsonb, p_allocations jsonb
    ) RETURNS uuid LANGUAGE plpgsql AS $stub$
    DECLARE v_id uuid;
    BEGIN
      INSERT INTO public.test_payment_calls (workspace_id, payload, allocations)
      VALUES (p_workspace_id, p_payload, p_allocations) RETURNING id INTO v_id;
      INSERT INTO public.payments (workspace_id, payment_number)
      VALUES (p_workspace_id, p_payload ->> 'payment_number');
      RETURN v_id;
    END $stub$;

    CREATE OR REPLACE FUNCTION public.accounting_post_journal_entry(
      p_workspace_id uuid, p_user_id uuid, p_header jsonb, p_lines jsonb
    ) RETURNS uuid LANGUAGE plpgsql AS $stub$
    DECLARE v_id uuid;
    BEGIN
      INSERT INTO public.test_journal_calls (workspace_id, header, lines)
      VALUES (p_workspace_id, p_header, p_lines) RETURNING id INTO v_id;
      INSERT INTO public.journal_entries (id, workspace_id, source_type, source_id, status)
      VALUES (v_id, p_workspace_id, p_header ->> 'source_type', (p_header ->> 'source_id')::uuid, 'posted');
      RETURN v_id;
    END $stub$;

    INSERT INTO public.customers (id, workspace_id, full_name) VALUES ('${W}', '${W}', 'Buyer');
    INSERT INTO public.suppliers (id, workspace_id, name) VALUES ('${S}', '${W}', 'Supplier');

    -- New style (advances-04): supplier_id set, customer_id NULL.
    INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, supplier_id, amount_minor, currency, posting_status, source_type)
    VALUES ('${NEW_ADVANCE}', '${W}', '${NEW_ADVANCE}', NULL, '${S}', 500000, 'AFN', 'posted', 'pre_purchase');

    -- Historical mapped row: the id still sits in customer_id.
    INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, supplier_id, amount_minor, currency, posting_status, source_type)
    VALUES ('${LEGACY_ADVANCE}', '${W}', '${LEGACY_ADVANCE}', '${S}', NULL, 500000, 'AFN', 'posted', 'pre_purchase');

    -- Unresolved: neither column names the party. Must never be guessed.
    INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, supplier_id, amount_minor, currency, posting_status, source_type)
    VALUES ('${UNRESOLVED}', '${W}', '${UNRESOLVED}', NULL, NULL, 500000, 'AFN', 'posted', 'pre_purchase');

    -- Another business's advance.
    INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, supplier_id, amount_minor, currency, posting_status, source_type)
    VALUES ('${FOREIGN_ADVANCE}', '${W2}', '${FOREIGN_ADVANCE}', NULL, '${S}', 500000, 'AFN', 'posted', 'pre_purchase');

    INSERT INTO public.invoices (id, workspace_id, type, supplier_id, currency, total, status)
    VALUES ('${PURCHASE}', '${W}', 'purchase', '${S}', 'AFN', 400000, 'pending');

    INSERT INTO public.journal_entries (workspace_id, source_type, source_id, status, entry_number)
    VALUES ('${W}', 'invoice', '${PURCHASE}', 'posted', 'JV-2026-000001');
    INSERT INTO public.journal_entries (workspace_id, source_type, source_id, status, entry_number)
    VALUES ('${W}', 'order_deposit', '${NEW_ADVANCE}', 'posted', 'JV-2026-000002');
    INSERT INTO public.journal_entries (workspace_id, source_type, source_id, status, entry_number)
    VALUES ('${W}', 'order_deposit', '${LEGACY_ADVANCE}', 'posted', 'JV-2026-000003');
    INSERT INTO public.journal_entries (workspace_id, source_type, source_id, status, entry_number)
    VALUES ('${W}', 'order_deposit', '${UNRESOLVED}', 'posted', 'JV-2026-000004');
  `)

  await sql.unsafe(read('advances-05-supplier-advance-party-migration.sql'))
  await sql.unsafe(read('advances-05-supplier-advance-party-migration.sql'))
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('advances-05 — the supplier advance books against the supplier', () => {
  it('applies a new-style advance: Dr payable / Cr supplier advances, party = supplier', async () => {
    const result = await callApply(NEW_ADVANCE)
    expect(result.replayed).toBe(false)
    expect(result.currency).toBe('AFN')

    const calls = await sql`SELECT payload, allocations FROM public.test_payment_calls ORDER BY seq`
    const payload = calls[calls.length - 1]!.payload as Row
    expect(payload.party_id).toBe(S)
    expect(payload.party_type).toBe('supplier')
    expect(payload.direction).toBe('out')

    const journal = await sql`SELECT lines FROM public.test_journal_calls ORDER BY seq DESC LIMIT 1`
    const lines = journal[0]!.lines as Row[]
    // 100,000 minor units of AFN (0 digits) — the amount APPLIED, not the
    // invoice's 400,000 total.
    expect(lines[0]).toMatchObject({ account_id: ACCOUNT_OTHER, debit: 100_000, credit: 0 })
    expect(lines[1]).toMatchObject({ account_id: ACCOUNT_ADVANCES, debit: 0, credit: 100_000 })

    const invoice = await sql`SELECT id FROM public.invoices WHERE id = ${PURCHASE}`
    expect(invoice).toHaveLength(1)
  })

  it('still applies a historical advance whose supplier sits in customer_id', async () => {
    const result = await callApply(LEGACY_ADVANCE)
    expect(result.replayed).toBe(false)

    const calls = await sql`SELECT payload FROM public.test_payment_calls ORDER BY seq DESC LIMIT 1`
    expect((calls[0]!.payload as Row).party_id).toBe(S)
  })

  it('refunds back IN, against the supplier and supplier advances', async () => {
    const result = await callRefund(NEW_ADVANCE)
    expect(result.replayed).toBe(false)

    const calls = await sql`SELECT payload FROM public.test_payment_calls ORDER BY seq DESC LIMIT 1`
    const payload = calls[0]!.payload as Row
    expect(payload.party_id).toBe(S)
    expect(payload.direction).toBe('in')

    const journal = await sql`SELECT lines FROM public.test_journal_calls ORDER BY seq DESC LIMIT 1`
    const lines = journal[0]!.lines as Row[]
    expect(lines[0]).toMatchObject({ account_id: ACCOUNT_OTHER, debit: 50000, credit: 0 })
    expect(lines[1]).toMatchObject({ account_id: ACCOUNT_ADVANCES, debit: 0, credit: 50000 })
  })

  it('refuses an unresolved party on both moves instead of booking NULL', async () => {
    await reject(
      `SELECT public.supplier_advance_apply(
         '${W}', '${BUYER}', '${UNRESOLVED}', '${PURCHASE}', 100000::bigint, 0::smallint, CURRENT_DATE,
         'apply-key-0002', '${ACCOUNT_ADVANCES}', '${ACCOUNT_OTHER}', 'owner')`,
      /ADVANCE_PARTY_UNKNOWN/,
    )
    await reject(
      `SELECT public.supplier_advance_refund(
         '${W}', '${BUYER}', '${UNRESOLVED}', 50000::bigint, 0::smallint, CURRENT_DATE, 'cash', 'no party',
         'refund-key-0002', '${ACCOUNT_ADVANCES}', '${ACCOUNT_OTHER}', 'owner')`,
      /ADVANCE_PARTY_UNKNOWN/,
    )

    const calls = await sql`SELECT count(*)::int AS n FROM public.test_payment_calls`
    expect(calls[0]!.n).toBe(3)
  })

  it('cannot reach another workspace’s advance', async () => {
    await reject(
      `SELECT public.supplier_advance_apply(
         '${W}', '${BUYER}', '${FOREIGN_ADVANCE}', '${PURCHASE}', 100000::bigint, 0::smallint, CURRENT_DATE,
         'apply-key-0003', '${ACCOUNT_ADVANCES}', '${ACCOUNT_OTHER}', 'owner')`,
      /DEPOSIT_NOT_FOUND/,
    )
  })

  it('is executable by service_role only', async () => {
    const rows = await sql`
      SELECT p.proname,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('supplier_advance_apply', 'supplier_advance_refund')
       ORDER BY p.proname`
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.anon).toBe(false)
      expect(row.auth).toBe(false)
      expect(row.service).toBe(true)
    }
  })

  it('resolves the party from supplier_id first in both bodies', async () => {
    const rows = await sql`
      SELECT p.proname,
             position('v_party := COALESCE(v_dep.supplier_id, v_dep.customer_id)' IN pg_get_functiondef(p.oid)) > 0 AS resolves,
             position('ADVANCE_PARTY_UNKNOWN' IN pg_get_functiondef(p.oid)) > 0 AS refuses
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('supplier_advance_apply', 'supplier_advance_refund')`
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.resolves).toBe(true)
      expect(row.refuses).toBe(true)
    }
  })
})
