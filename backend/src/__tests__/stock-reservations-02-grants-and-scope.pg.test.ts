// ============================================
// backend/src/__tests__/stock-reservations-02-grants-and-scope.pg.test.ts
//
// docs/stock-reservations-02-grants-and-scope-migration.sql, run on real
// Postgres, after the file it repairs.
//
// The two defects it closes, proven from the OUTSIDE (a role, not the text):
//
//   A. `stock-reservations-01` revoked EXECUTE from PUBLIC/anon/authenticated
//      and never granted it to service_role. Asking as service_role must fail
//      with 42501 BEFORE the new file, and answer AFTER it.
//   B. `stock_available` read `warehouse_stock` without `workspace_id`. Asking
//      workspace A for workspace B's warehouse must answer B's quantity before
//      the new file, and 0 after it.
//
// The end re-opens both defects and proves the new file closes them again.
// ⚠️ A tagged template binds a VALUE, so ids are written `${ID}::uuid`, never
// `'${ID}'::uuid` (that binds the literal text `'$1'`). Plain strings — the
// fixture and the multi-statement files — keep their quotes.
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
  databaseDir: pgTempDir('hisabche-pg-stock02-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/stock02`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const W1 = '33333333-3333-4333-8333-333333333333'
const W2 = '44444444-4444-4444-8444-444444444444'
const P1 = '55555555-5555-4555-8555-555555555555'
const ACTOR = '66666666-6666-4666-8666-666666666666'

/** Run one statement as a role, in a transaction that is rolled back. */
async function asRole<T>(
  role: string,
  run: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`)
    return run(tx)
  }) as Promise<T>
}

/** The first sentence of a refusal, or 'ALLOWED'. */
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return String((error as Error).message)
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('stock02')
  sql = postgres(url, { max: 1, onnotice: () => {} })

  await sql.unsafe(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    CREATE TABLE public.warehouses (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE public.warehouse_stock (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      warehouse_id uuid NOT NULL,
      product_id uuid NOT NULL,
      quantity numeric NOT NULL DEFAULT 0,
      UNIQUE (warehouse_id, product_id)
    );

    INSERT INTO public.warehouses (id, workspace_id, name) VALUES
      ('${W1}', '${SHOP}', 'Shop warehouse'),
      ('${W2}', '${OTHER}', 'Other warehouse');

    INSERT INTO public.warehouse_stock (workspace_id, warehouse_id, product_id, quantity) VALUES
      ('${SHOP}',  '${W1}', '${P1}',  10),
      ('${OTHER}', '${W2}', '${P1}',  20),
      -- Legacy row: written before the column was backfilled.
      (NULL,       '${W1}', gen_random_uuid(), 7);
  `)

  // The file under repair, exactly as the owner will have run it.
  await sql.unsafe(read('stock-reservations-01-migration.sql'))
  await sql.unsafe(`
    GRANT SELECT, INSERT, UPDATE ON public.warehouse_stock TO service_role;
    GRANT SELECT, INSERT, UPDATE ON public.stock_reservations TO service_role;
  `)
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('before the fix — the two defects are real', () => {
  it('service_role cannot execute stock_available (42501: the missing GRANT)', async () => {
    const message = await refusal(() =>
      asRole(
        'service_role',
        (tx) => tx`SELECT public.stock_available(${SHOP}::uuid, ${W1}::uuid, ${P1}::uuid)`,
      ),
    )
    expect(message).toMatch(/permission denied for function stock_available/i)
  })

  it("reading workspace B's warehouse answers B's quantity (the missing tenant filter)", async () => {
    const rows = await sql`SELECT public.stock_available(
      ${SHOP}::uuid, ${W2}::uuid, ${P1}::uuid
    )::numeric AS atp`
    expect(Number(rows[0]!.atp)).toBe(20)
  })
})

describe('after the fix', () => {
  beforeAll(async () => {
    // Twice: the file must be re-runnable.
    await sql.unsafe(read('stock-reservations-02-grants-and-scope-migration.sql'))
    await sql.unsafe(read('stock-reservations-02-grants-and-scope-migration.sql'))
  })

  it('service_role reads its own available-to-promise', async () => {
    const rows = await asRole(
      'service_role',
      (tx) =>
        tx`SELECT public.stock_available(${SHOP}::uuid, ${W1}::uuid, ${P1}::uuid)::numeric AS atp`,
    )
    expect(Number(rows[0]!.atp)).toBe(10)
  })

  it("another workspace's warehouse answers 0, not B's quantity", async () => {
    const rows = await asRole(
      'service_role',
      (tx) =>
        tx`SELECT public.stock_available(${SHOP}::uuid, ${W2}::uuid, ${P1}::uuid)::numeric AS atp`,
    )
    expect(Number(rows[0]!.atp)).toBe(0)
  })

  it('an unowned stock row (workspace_id NULL) is not promiseable', async () => {
    const rows = await sql`
      SELECT public.stock_available(${SHOP}::uuid, ${W1}::uuid, s.product_id)::numeric AS atp
        FROM public.warehouse_stock s
       WHERE s.workspace_id IS NULL AND s.warehouse_id = ${W1}::uuid`
    expect(Number(rows[0]!.atp)).toBe(0)
  })

  it('service_role can reserve against its own stock and is refused another workspace', async () => {
    const own = await asRole(
      'service_role',
      (tx) =>
        tx`SELECT public.stock_reserve(
        ${SHOP}::uuid, ${ACTOR}::uuid, ${W1}::uuid, ${P1}::uuid, 4::numeric,
        'sale_order', NULL, 'stock02-key-1', NULL
      ) AS result`,
    )
    expect(own[0]!.result).toMatchObject({ status: 'reserved', quantity: 4 })

    const atp = await asRole(
      'service_role',
      (tx) =>
        tx`SELECT public.stock_available(${SHOP}::uuid, ${W1}::uuid, ${P1}::uuid)::numeric AS atp`,
    )
    expect(Number(atp[0]!.atp)).toBe(6)

    const foreign = await refusal(() =>
      asRole(
        'service_role',
        (tx) =>
          tx`SELECT public.stock_reserve(
          ${SHOP}::uuid, ${ACTOR}::uuid, ${W2}::uuid, ${P1}::uuid, 1::numeric,
          'sale_order', NULL, 'stock02-key-2', NULL
        )`,
      ),
    )
    expect(foreign).toMatch(/STOCK_RESERVATION_NO_STOCK/)
  })

  it('anon and authenticated still cannot execute any of the four', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const name of [
        'stock_available',
        'stock_reserve',
        'stock_release_reservation',
        'stock_settle_reservation',
      ]) {
        const [row] = await sql`
          SELECT has_function_privilege(${role}, p.oid, 'EXECUTE') AS allowed
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = ${name}`
        expect({ role, name, allowed: row!.allowed }).toEqual({ role, name, allowed: false })
      }
    }
  })

  it('pins search_path on stock_available and keeps it invoker-rights', async () => {
    const [row] = await sql`
      SELECT p.prosecdef AS definer, p.proconfig AS config
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'stock_available'`
    expect(row!.definer).toBe(false)
    expect(String(row!.config)).toContain('search_path=public, pg_temp')
  })
})

describe('the proof that the new file is what fixes it', () => {
  it('UNDO B: re-applying stock-reservations-01 brings the tenant leak back', async () => {
    await sql.unsafe(read('stock-reservations-01-migration.sql'))

    const rows = await sql`SELECT public.stock_available(
      ${SHOP}::uuid, ${W2}::uuid, ${P1}::uuid
    )::numeric AS atp`
    expect(Number(rows[0]!.atp)).toBe(20)
  })

  // ⚠️ NOT the same undo. Re-running 01 revokes from PUBLIC/anon/authenticated;
  // it does not touch a grant made to service_role, because an ACL entry
  // belongs to the grantee. Defect A is undone the only way it can be on an
  // existing database: revoke service_role explicitly.
  it('UNDO A: revoking service_role brings 42501 back', async () => {
    await sql.unsafe(`
      REVOKE EXECUTE ON FUNCTION public.stock_available(uuid, uuid, uuid) FROM service_role;
      REVOKE EXECUTE ON FUNCTION public.stock_reserve(uuid, uuid, uuid, uuid, numeric, text, uuid, text, timestamptz, uuid, text) FROM service_role;
      REVOKE EXECUTE ON FUNCTION public.stock_release_reservation(uuid, uuid, uuid, numeric, text) FROM service_role;
      REVOKE EXECUTE ON FUNCTION public.stock_settle_reservation(uuid, uuid, uuid, numeric, text) FROM service_role;
    `)

    const message = await refusal(() =>
      asRole(
        'service_role',
        (tx) => tx`SELECT public.stock_available(${SHOP}::uuid, ${W1}::uuid, ${P1}::uuid)`,
      ),
    )
    expect(message).toMatch(/permission denied for function stock_available/i)
  })

  it('RESTORE: the new file fixes both again', async () => {
    await sql.unsafe(read('stock-reservations-02-grants-and-scope-migration.sql'))

    const own = await asRole(
      'service_role',
      (tx) =>
        tx`SELECT public.stock_available(${SHOP}::uuid, ${W1}::uuid, ${P1}::uuid)::numeric AS atp`,
    )
    expect(Number(own[0]!.atp)).toBe(6)

    const foreign = await asRole(
      'service_role',
      (tx) =>
        tx`SELECT public.stock_available(${SHOP}::uuid, ${W2}::uuid, ${P1}::uuid)::numeric AS atp`,
    )
    expect(Number(foreign[0]!.atp)).toBe(0)
  })
})
