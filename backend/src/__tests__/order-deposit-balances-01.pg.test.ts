// ============================================
// docs/order-deposit-balances-01-migration.sql run twice on real Postgres.
//
// The subject is ONE call answering the balances of a page. What is asserted is
// the number a person reads and that apply/refund validate against:
//
//   * amount − live applications − live refunds, per deposit;
//   * a payment that is no longer `posted` moves nothing (its application and
//     its refund are both ignored);
//   * another workspace's deposit is not returned, even when its id is asked
//     for by name;
//   * a deposit with no activity answers zeros, not a missing row;
//   * only service_role may execute the function.
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
  databaseDir: pgTempDir('hisabche-pg-depbal-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/depbal`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const W = '11111111-1111-4111-8111-111111111111'
const W2 = '11111111-1111-4111-8111-111111111112'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PAY_POSTED = '10000000-0000-4000-8000-000000000001'
const PAY_REVERSED = '10000000-0000-4000-8000-000000000002'

interface BalanceRow {
  deposit_id: string
  amount_minor: bigint | number
  applied_minor: bigint | number
  refunded_minor: bigint | number
  remaining_minor: bigint | number
}

const ask = async (workspace: string, ids: string[]): Promise<BalanceRow[]> => {
  const rows = await sql`SELECT * FROM public.order_deposit_balances(
        ${workspace}::uuid, ${ids}::uuid[]
      )`
  return rows as unknown as BalanceRow[]
}

const num = (value: bigint | number) => Number(value)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('depbal')
  sql = postgres(url, { max: 1, onnotice: () => {} })

  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    CREATE TABLE public.order_deposits (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      amount_minor bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.payments (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE public.order_deposit_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      deposit_id uuid NOT NULL,
      payment_id uuid NOT NULL,
      amount_minor bigint NOT NULL
    );
    CREATE TABLE public.order_deposit_refunds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      deposit_id uuid NOT NULL,
      payment_id uuid NOT NULL,
      amount_minor bigint NOT NULL
    );

    INSERT INTO public.payments (id, workspace_id, status) VALUES
      ('${PAY_POSTED}', '${W}', 'posted'),
      ('${PAY_REVERSED}', '${W}', 'reversed');

    INSERT INTO public.order_deposits (id, workspace_id, amount_minor, created_at) VALUES
      ('${A}', '${W}', 100000, '2026-11-01T00:00:00Z'),
      ('${B}', '${W}',  20000, '2026-11-02T00:00:00Z'),
      ('${C}', '${W2}', 90000, '2026-11-03T00:00:00Z');

    INSERT INTO public.order_deposit_applications (workspace_id, deposit_id, payment_id, amount_minor) VALUES
      ('${W}', '${A}', '${PAY_POSTED}',   40000),
      ('${W}', '${A}', '${PAY_REVERSED}',  5000),
      ('${W2}', '${C}', '${PAY_POSTED}',  90000);

    INSERT INTO public.order_deposit_refunds (workspace_id, deposit_id, payment_id, amount_minor) VALUES
      ('${W}', '${A}', '${PAY_POSTED}', 10000);
  `)

  // Twice: a re-run must be harmless (CREATE OR REPLACE + the same grants).
  await sql.unsafe(read('order-deposit-balances-01-migration.sql'))
  await sql.unsafe(read('order-deposit-balances-01-migration.sql'))
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('order_deposit_balances — one call, the database’s own arithmetic', () => {
  it('answers every asked deposit with amount − live applications − live refunds', async () => {
    const rows = await ask(W, [A, B])
    expect(rows).toHaveLength(2)

    const a = rows.find((row) => row.deposit_id === A)!
    expect(num(a.amount_minor)).toBe(100_000)
    // The reversed payment's 5,000 application is NOT counted.
    expect(num(a.applied_minor)).toBe(40_000)
    expect(num(a.refunded_minor)).toBe(10_000)
    expect(num(a.remaining_minor)).toBe(50_000)

    const b = rows.find((row) => row.deposit_id === B)!
    expect(num(b.applied_minor)).toBe(0)
    expect(num(b.refunded_minor)).toBe(0)
    expect(num(b.remaining_minor)).toBe(20_000)
  })

  it('does not return another workspace’s deposit, even by id', async () => {
    const rows = await ask(W, [C])
    expect(rows).toHaveLength(0)

    const own = await ask(W2, [C])
    expect(own).toHaveLength(1)
    expect(num(own[0]!.remaining_minor)).toBe(0)
  })

  it('pins search_path and is SECURITY DEFINER', async () => {
    const [row] = await sql`
      SELECT p.prosecdef AS security_definer, p.proconfig AS config
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'order_deposit_balances'`
    expect(row?.security_definer).toBe(true)
    expect(String(row?.config)).toContain('search_path=public, pg_temp')
  })

  it('is executable by service_role only', async () => {
    const [row] = await sql`
      SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'order_deposit_balances'`
    expect(row).toMatchObject({ anon: false, auth: false, service: true })
  })
})
