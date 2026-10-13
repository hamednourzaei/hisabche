// ============================================
// docs/opening-capital-and-fees-01-migration.sql — on top of till-payments-01,
// TWICE on a real Postgres, then its VERIFY, then what it adds:
//
//   · a payment with a fee is ONE transaction, with or without a till
//   · a fee of zero, or a fee that is the whole of money received, is refused
//     and leaves no payment
//   · a retry is the same payment
//   · a till movement may be opening capital; the two new account roles exist
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 59300 + Math.floor(Math.random() * 500)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-capital-fees-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/capital_fees`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OPEN = '11111111-1111-4111-8111-111111111111'
const CLOSED = '33333333-3333-4333-8333-333333333333'

const body = (direction: 'in' | 'out', amount: number) =>
  JSON.stringify({ direction, party_type: 'customer', amount, currency: 'AFN', method: 'cash' })

async function record(options: {
  direction?: 'in' | 'out'
  amount?: number
  fee: number | null
  session?: string | null
  key?: string | null
}): Promise<{ payment_id: string; replayed: boolean }> {
  const rows = await sql.unsafe(
    `SELECT public.payments_record_with_fee($1::uuid, $2::uuid, $3::text::jsonb, '[]'::jsonb, $4, $5::uuid, $6::bigint, $7::numeric) AS out`,
    [
      SHOP,
      USER,
      body(options.direction ?? 'in', options.amount ?? 100),
      options.key ?? null,
      options.session ?? null,
      options.session ? 9800 : null,
      options.fee,
    ],
  )
  return rows[0]!.out as { payment_id: string; replayed: boolean }
}
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}
const payments = async () =>
  Number((await sql.unsafe('SELECT count(*)::int AS n FROM public.payments'))[0]!.n)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('capital_fees')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE TABLE pos_sessions (
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, status text NOT NULL DEFAULT 'open'
    );
    CREATE TABLE pos_cash_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
      session_id uuid NOT NULL, kind text NOT NULL, amount_minor bigint NOT NULL, reason text,
      CONSTRAINT pos_cash_movements_kind_check
        CHECK (kind IN ('cash_in', 'cash_out', 'transfer_to_bank', 'transfer_from_bank'))
    );
    CREATE TABLE payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL, direction text, party_type text,
      amount numeric(18,2) NOT NULL, currency text, method text NOT NULL DEFAULT 'cash',
      status text NOT NULL DEFAULT 'posted', created_by uuid, client_request_id text
    );
    CREATE UNIQUE INDEX payments_client_request_key
      ON payments (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
    CREATE TABLE accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, code text, role text
    );

    CREATE FUNCTION payments_record(p_workspace_id uuid, p_user_id uuid, p_payment jsonb, p_allocations jsonb)
    RETURNS uuid LANGUAGE plpgsql AS $fn$
    DECLARE v_id uuid;
    BEGIN
      INSERT INTO payments (workspace_id, direction, party_type, amount, currency, method, created_by)
      VALUES (p_workspace_id, p_payment ->> 'direction', p_payment ->> 'party_type',
              (p_payment ->> 'amount')::numeric, p_payment ->> 'currency',
              COALESCE(p_payment ->> 'method', 'cash'), p_user_id)
      RETURNING id INTO v_id;
      RETURN v_id;
    END $fn$;
    CREATE FUNCTION payments_record_keyed(p_workspace_id uuid, p_user_id uuid, p_payment jsonb, p_allocations jsonb, p_client_request_id text)
    RETURNS jsonb LANGUAGE plpgsql AS $fn$
    DECLARE v_existing uuid; v_id uuid;
    BEGIN
      SELECT id INTO v_existing FROM payments
       WHERE workspace_id = p_workspace_id AND client_request_id = p_client_request_id;
      IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('payment_id', v_existing, 'replayed', true);
      END IF;
      v_id := payments_record(p_workspace_id, p_user_id, p_payment, p_allocations);
      UPDATE payments SET client_request_id = p_client_request_id WHERE id = v_id;
      RETURN jsonb_build_object('payment_id', v_id, 'replayed', false);
    END $fn$;

    INSERT INTO pos_sessions VALUES ('${OPEN}', '${SHOP}', 'open'), ('${CLOSED}', '${SHOP}', 'closed');
  `)
  await setup.unsafe(read('till-payments-01-migration.sql'))
  await setup.unsafe(read('opening-capital-and-fees-01-migration.sql'))
  await setup.unsafe(read('opening-capital-and-fees-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // teardown only
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/opening-capital-and-fees-01-migration.sql', () => {
  it('ran twice; every check of its VERIFY says ok — and till-payments-01 still verifies', async () => {
    const rows = await sql.unsafe(read('VERIFY-opening-capital-and-fees-01.sql'))
    expect(rows).toHaveLength(4)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.name)).toEqual([])
    // It rewrote accounts_role_check: the earlier role must still be in it.
    const earlier = await sql.unsafe(read('VERIFY-till-payments-01.sql'))
    expect(earlier.filter((row) => row.ok === false).map((row) => row.name)).toEqual([])
  })

  it('a payment with a fee and no till: the payment, with its fee', async () => {
    const out = await record({ fee: 2 })
    const rows = await sql.unsafe(
      'SELECT fee_amount::text AS fee, pos_session_id FROM public.payments WHERE id = $1',
      [out.payment_id],
    )
    expect(rows[0]).toMatchObject({ fee: '2.00', pos_session_id: null })
  })

  it('a payment with a fee INTO a till: payment, till and fee together', async () => {
    const out = await record({ fee: 2, session: OPEN })
    const rows = await sql.unsafe(
      'SELECT fee_amount::text AS fee, pos_session_id, till_amount_minor::text AS minor FROM public.payments WHERE id = $1',
      [out.payment_id],
    )
    expect(rows[0]).toMatchObject({ fee: '2.00', pos_session_id: OPEN, minor: '9800' })
  })

  it.each([
    ['no fee', { fee: null }, 'PAYMENT_FEE_INVALID'],
    ['a fee of zero', { fee: 0 }, 'PAYMENT_FEE_INVALID'],
    ['a negative fee', { fee: -1 }, 'PAYMENT_FEE_INVALID'],
    ['a fee that is all of the money received', { fee: 100 }, 'PAYMENT_FEE_EXCEEDS_AMOUNT'],
    ['a closed till', { fee: 2, session: CLOSED }, 'PAYMENT_TILL_NOT_OPEN'],
  ] as const)('⚠️ %s is refused — and no payment is left behind', async (_name, options, code) => {
    const before = await payments()
    expect(await refusal(() => record(options))).toContain(code)
    expect(await payments()).toBe(before)
  })

  it('money OUT may carry a fee larger than nothing in particular: it is paid on top', async () => {
    const out = await record({ direction: 'out', amount: 100, fee: 5 })
    expect(out.replayed).toBe(false)
  })

  it('⚠️ a retry of the same request is the same payment, with one fee', async () => {
    const first = await record({ fee: 2, key: 'fee-retry-0001' })
    expect(await record({ fee: 2, key: 'fee-retry-0001' })).toEqual({
      payment_id: first.payment_id,
      replayed: true,
    })
    const rows = await sql.unsafe(
      `SELECT count(*)::int AS n FROM public.payments WHERE client_request_id = 'fee-retry-0001'`,
    )
    expect(rows[0]!.n).toBe(1)
  })

  it('the table refuses a fee of zero written directly', async () => {
    expect(
      await refusal(() =>
        sql.unsafe(
          `INSERT INTO public.payments (workspace_id, amount, fee_amount) VALUES ('${SHOP}', 5, 0)`,
        ),
      ),
    ).toContain('payments_fee_positive')
  })

  it('a till movement may be opening capital; an unknown kind still is not', async () => {
    await sql.unsafe(
      `INSERT INTO public.pos_cash_movements (workspace_id, session_id, kind, amount_minor, reason)
       VALUES ('${SHOP}', '${OPEN}', 'opening_capital', 5000000, 'سرمایه')`,
    )
    expect(
      await refusal(() =>
        sql.unsafe(
          `INSERT INTO public.pos_cash_movements (workspace_id, session_id, kind, amount_minor)
           VALUES ('${SHOP}', '${OPEN}', 'gift', 1)`,
        ),
      ),
    ).toContain('pos_cash_movements_kind_check')
  })

  it('both account roles are accepted', async () => {
    await sql.unsafe(
      `INSERT INTO public.accounts (workspace_id, code, role) VALUES
       ('${SHOP}', '3200', 'owner_capital'), ('${SHOP}', '6100', 'bank_fees'), ('${SHOP}', '4900', 'fx_gain_loss')`,
    )
    expect(
      await refusal(() =>
        sql.unsafe(
          `INSERT INTO public.accounts (workspace_id, code, role) VALUES ('${SHOP}', '9', 'petty')`,
        ),
      ),
    ).toContain('accounts_role_check')
  })
})
