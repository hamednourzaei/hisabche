// ============================================
// docs/till-payments-01-migration.sql — TWICE on a real Postgres, then its
// VERIFY, then the rules it adds:
//
//   · a cash payment lands in the till that was named, in one transaction
//   · a closed, suspended, foreign or missing till refuses it — and then there
//     is NO payment either
//   · a retry of the same request is the same payment, once in the drawer
//   · the till of a payment is history: it cannot be moved afterwards
//   · an old payment is given no till
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-till-pay-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/till_pay`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OPEN = '11111111-1111-4111-8111-111111111111'
const SECOND = '22222222-2222-4222-8222-222222222222'
const CLOSED = '33333333-3333-4333-8333-333333333333'
const SUSPENDED = '44444444-4444-4444-8444-444444444444'
const THEIRS = '55555555-5555-4555-8555-555555555555'

const body = (method = 'cash', amount = 500) =>
  JSON.stringify({
    payment_number: null,
    direction: 'out',
    party_type: 'supplier',
    party_id: '',
    amount,
    currency: 'AFN',
    method,
    entry_date: '2026-10-13',
    status: 'posted',
  })

async function record(
  session: string | null,
  options: { key?: string | null; method?: string; minor?: number | null; shop?: string } = {},
): Promise<{ payment_id: string; replayed: boolean }> {
  const rows = await sql.unsafe(
    `SELECT public.payments_record_at_till($1::uuid, $2::uuid, $3::text::jsonb, '[]'::jsonb, $4, $5::uuid, $6::bigint) AS out`,
    [
      options.shop ?? SHOP,
      USER,
      body(options.method),
      options.key ?? null,
      session,
      options.minor === undefined ? 50000 : options.minor,
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
  await pg.createDatabase('till_pay')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    -- As on Supabase: every new object is born open to all three.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE TABLE pos_sessions (
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, status text NOT NULL DEFAULT 'open'
    );
    CREATE TABLE payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      payment_number text, direction text, party_type text, party_id uuid,
      amount numeric(18,2) NOT NULL, currency text, method text NOT NULL DEFAULT 'cash',
      entry_date date, reference text, notes text, status text NOT NULL DEFAULT 'posted',
      created_by uuid, client_request_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX payments_client_request_key
      ON payments (workspace_id, client_request_id) WHERE client_request_id IS NOT NULL;
    CREATE TABLE accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, code text, role text,
      CONSTRAINT accounts_role_check CHECK (role IS NULL OR role IN ('cash', 'bank'))
    );

    -- The two functions the new one calls, with their real signatures.
    CREATE FUNCTION payments_record(p_workspace_id uuid, p_user_id uuid, p_payment jsonb, p_allocations jsonb)
    RETURNS uuid LANGUAGE plpgsql AS $fn$
    DECLARE v_id uuid;
    BEGIN
      INSERT INTO payments (workspace_id, direction, party_type, amount, currency, method, entry_date, status, created_by)
      VALUES (p_workspace_id, p_payment ->> 'direction', p_payment ->> 'party_type',
              (p_payment ->> 'amount')::numeric, p_payment ->> 'currency',
              COALESCE(p_payment ->> 'method', 'cash'), (p_payment ->> 'entry_date')::date, 'posted', p_user_id)
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

    INSERT INTO pos_sessions VALUES
      ('${OPEN}', '${SHOP}', 'open'), ('${SECOND}', '${SHOP}', 'open'),
      ('${CLOSED}', '${SHOP}', 'closed'), ('${SUSPENDED}', '${SHOP}', 'suspended'),
      ('${THEIRS}', '${OTHER}', 'open');
    -- Made before the migration: cash, and nobody said which drawer.
    INSERT INTO payments (workspace_id, amount, method) VALUES ('${SHOP}', 120, 'cash');
  `)
  await setup.unsafe(read('till-payments-01-migration.sql'))
  await setup.unsafe(read('till-payments-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 3, onnotice: () => {} })
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

describe('docs/till-payments-01-migration.sql', () => {
  it('ran twice; every check of its VERIFY says ok and the finding counts the old cash payment', async () => {
    const rows = await sql.unsafe(read('VERIFY-till-payments-01.sql'))
    expect(rows).toHaveLength(8)
    expect(rows.filter((row) => row.ok === false).map((row) => row.name)).toEqual([])
    expect(rows.filter((row) => row.ok === true)).toHaveLength(7)
    expect(String(rows[7]!.detail)).toMatch(/^1 /)
  })

  it('⚠️ NO BACKFILL: the payment made before it has no till', async () => {
    const rows = await sql.unsafe(
      'SELECT pos_session_id, till_amount_minor FROM public.payments WHERE amount = 120',
    )
    expect(rows[0]!.pos_session_id).toBeNull()
    expect(rows[0]!.till_amount_minor).toBeNull()
  })

  it('a cash payment lands in the till that was named, with what moved in that till', async () => {
    const out = await record(OPEN, { minor: 50000 })
    expect(out.replayed).toBe(false)
    const rows = await sql.unsafe(
      'SELECT pos_session_id, till_amount_minor::text AS minor, amount::text AS amount FROM public.payments WHERE id = $1',
      [out.payment_id],
    )
    expect(rows[0]!.pos_session_id).toBe(OPEN)
    expect(rows[0]!.minor).toBe('50000')
    expect(rows[0]!.amount).toBe('500.00')
  })

  it.each([
    ['a closed till', CLOSED, 'PAYMENT_TILL_NOT_OPEN'],
    ['a suspended till', SUSPENDED, 'PAYMENT_TILL_NOT_OPEN'],
    ['the till of another business', THEIRS, 'PAYMENT_TILL_NOT_FOUND'],
    [
      'a till that does not exist',
      '99999999-9999-4999-8999-999999999999',
      'PAYMENT_TILL_NOT_FOUND',
    ],
    ['no till at all', null, 'PAYMENT_TILL_REQUIRED'],
  ])('⚠️ %s refuses it — and no payment is left behind', async (_name, session, code) => {
    const before = await payments()
    expect(await refusal(() => record(session))).toContain(code)
    expect(await payments()).toBe(before)
  })

  it('a card or a bank transfer is not money in a drawer', async () => {
    const before = await payments()
    expect(await refusal(() => record(OPEN, { method: 'card' }))).toContain(
      'PAYMENT_TILL_ONLY_CASH',
    )
    expect(await refusal(() => record(OPEN, { minor: 0 }))).toContain('PAYMENT_TILL_AMOUNT_INVALID')
    expect(await payments()).toBe(before)
  })

  it('⚠️ a retry of the same request is the SAME payment — once in the drawer', async () => {
    const key = 'retry-key-0001'
    const first = await record(OPEN, { key })
    const again = await record(OPEN, { key })
    expect(again).toEqual({ payment_id: first.payment_id, replayed: true })
    const rows = await sql.unsafe(
      'SELECT count(*)::int AS n, sum(till_amount_minor)::text AS minor FROM public.payments WHERE client_request_id = $1',
      [key],
    )
    expect(rows[0]!.n).toBe(1)
    expect(rows[0]!.minor).toBe('50000')
  })

  it('a retry that arrives after the till was closed still answers with the payment it made', async () => {
    const key = 'retry-key-0002'
    const first = await record(SECOND, { key })
    await sql.unsafe(`UPDATE public.pos_sessions SET status = 'closed' WHERE id = '${SECOND}'`)
    expect(await record(SECOND, { key })).toEqual({ payment_id: first.payment_id, replayed: true })
    // A NEW payment into it is refused.
    expect(await refusal(() => record(SECOND, { key: 'retry-key-0003' }))).toContain(
      'PAYMENT_TILL_NOT_OPEN',
    )
    await sql.unsafe(`UPDATE public.pos_sessions SET status = 'open' WHERE id = '${SECOND}'`)
  })

  it('⚠️ two concurrent twins of one request: one payment, one movement in the drawer', async () => {
    const key = 'twin-key-0001'
    const results = await Promise.allSettled([record(OPEN, { key }), record(OPEN, { key })])
    const won = results.filter((r) => r.status === 'fulfilled')
    expect(won.length).toBeGreaterThanOrEqual(1)
    // The loser either replays or is refused as a duplicate — never a second row.
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(String((result.reason as Error).message)).toContain('payments_client_request_key')
      }
    }
    const rows = await sql.unsafe(
      'SELECT count(*)::int AS n FROM public.payments WHERE client_request_id = $1',
      [key],
    )
    expect(rows[0]!.n).toBe(1)
  })

  it('⚠️ the till of a payment is history: it cannot be moved or re-priced afterwards', async () => {
    const out = await record(OPEN)
    expect(
      await refusal(() =>
        sql.unsafe(`UPDATE public.payments SET pos_session_id = '${SECOND}' WHERE id = $1`, [
          out.payment_id,
        ]),
      ),
    ).toContain('PAYMENT_TILL_IMMUTABLE')
    expect(
      await refusal(() =>
        sql.unsafe('UPDATE public.payments SET till_amount_minor = 1 WHERE id = $1', [
          out.payment_id,
        ]),
      ),
    ).toContain('PAYMENT_TILL_IMMUTABLE')
    // Anything else about the payment still changes (it is cancelled this way).
    await sql.unsafe(`UPDATE public.payments SET status = 'cancelled' WHERE id = $1`, [
      out.payment_id,
    ])
  })

  it('the table itself refuses a direct write that breaks the rules', async () => {
    const insert = (columns: string, values: string) => () =>
      sql.unsafe(
        `INSERT INTO public.payments (workspace_id, amount, ${columns}) VALUES ('${SHOP}', 5, ${values})`,
      )
    expect(await refusal(insert('method, pos_session_id', `'cash', '${OPEN}'`))).toContain(
      'payments_till_pair_check',
    )
    expect(
      await refusal(insert('method, pos_session_id, till_amount_minor', `'card', '${OPEN}', 500`)),
    ).toContain('payments_till_cash_only')
    expect(
      await refusal(
        insert('method, pos_session_id, till_amount_minor', `'cash', '${THEIRS}', 500`),
      ),
    ).toContain('PAYMENT_TILL_NOT_FOUND')
  })

  it('the exchange-difference role is accepted; an unknown role still is not', async () => {
    await sql.unsafe(
      `INSERT INTO public.accounts (workspace_id, code, role) VALUES ('${SHOP}', '4900', 'fx_gain_loss')`,
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
