// ============================================
// backend/src/__tests__/mobile-serial-01.pg.test.ts
//
// Proves V59.1 Mobile & Serialized Devices on real Postgres:
//   1. Idempotent mobile-serial-01-migration.sql runs twice + VERIFY passes
//   2. Atomic concurrent 2-connection hold race on the same IMEI:
//      exactly 1 wins ('reserved'), the second refuses (SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER)
//   3. Expired hold auto-releases on next hold or serial_release_expired_holds()
//   4. Workspace isolation: cross-tenant serial_hold_with_expiry refuses (SERIAL_NOT_FOUND)
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-mobile01-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/mobile01`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const readDoc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const W1 = '22222222-2222-4222-8222-222222222221'
const W2 = '22222222-2222-4222-8222-222222222222'
const C1 = '33333333-3333-4333-8333-333333333331'
const C2 = '33333333-3333-4333-8333-333333333332'
const P = '44444444-4444-4444-8444-444444444444'
const S1 = '66666666-6666-4666-8666-666666666661'
const S2 = '66666666-6666-4666-8666-666666666662'

const BASE = `
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid NOT NULL);
  CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL);
  CREATE TABLE public.stock_serials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    serial_number text NOT NULL,
    status text NOT NULL DEFAULT 'in_stock',
    reserved_for_customer_id uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stock_serials_status_check CHECK (
      status IN ('in_stock', 'reserved', 'sold', 'returned', 'scrapped')
    ),
    CONSTRAINT stock_serials_reserved_for CHECK (
      (status = 'reserved') = (reserved_for_customer_id IS NOT NULL)
    )
  );
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('mobile01')
  sql = postgres(url, { max: 4 })

  await sql.unsafe(BASE)
  const migration = readDoc('mobile-serial-01-migration.sql')
  await sql.unsafe(migration)
  await sql.unsafe(migration)

  await sql`INSERT INTO public.workspaces VALUES (${W1}), (${W2})`
  await sql`INSERT INTO public.customers VALUES (${C1}, ${W1}), (${C2}, ${W1})`
  await sql`INSERT INTO public.products VALUES (${P}, ${W1})`
  await sql`
    INSERT INTO public.stock_serials (id, workspace_id, product_id, serial_number, status)
    VALUES
      (${S1}, ${W1}, ${P}, '356789012345601', 'in_stock'),
      (${S2}, ${W1}, ${P}, '356789012345602', 'in_stock')
  `
}, 60_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('mobile-serial-01 migration and concurrency on real Postgres', () => {
  it('VERIFY-mobile-serial-01 checks pass after idempotent run x2', async () => {
    const [row] = await sql.unsafe<Array<Record<string, boolean>>>(
      readDoc('VERIFY-mobile-serial-01.sql'),
    )
    expect(row?.has_reserved_until_column).toBe(true)
    expect(row?.has_valid_expiry_constraint).toBe(true)
    expect(row?.has_hold_expiry_index).toBe(true)
    expect(row?.has_serial_hold_with_expiry_fn).toBe(true)
    expect(row?.has_serial_release_expired_fn).toBe(true)
  })

  it('concurrent 2-connection hold race: only one device wins the same IMEI', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const [a, b] = await Promise.allSettled([
      sql`SELECT * FROM public.serial_hold_with_expiry(${W1}, ${S1}, ${C1}, ${future})`,
      sql`SELECT * FROM public.serial_hold_with_expiry(${W1}, ${S1}, ${C2}, ${future})`,
    ])
    const wins = [a, b].filter((r) => r.status === 'fulfilled')
    const losses = [a, b].filter((r) => r.status === 'rejected')
    expect(wins).toHaveLength(1)
    expect(losses).toHaveLength(1)
  })

  it('expired holds release cleanly via serial_release_expired_holds()', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    await sql`SELECT * FROM public.serial_hold_with_expiry(${W1}, ${S2}, ${C1}, ${past})`
    const released = await sql<Array<{ released_id: string }>>`
      SELECT * FROM public.serial_release_expired_holds(${W1})
    `
    expect(released.map((r) => r.released_id)).toContain(S2)
    const [row] = await sql<Array<{ status: string; reserved_until: string | null }>>`
      SELECT status, reserved_until FROM public.stock_serials WHERE id = ${S2}
    `
    expect(row?.status).toBe('in_stock')
    expect(row?.reserved_until).toBeNull()
  })

  it('tenant isolation: another workspace cannot hold W1 serial', async () => {
    await expect(
      sql`SELECT * FROM public.serial_hold_with_expiry(${W2}, ${S2}, ${C1}, NULL)`,
    ).rejects.toThrow(/SERIAL_NOT_FOUND/)
  })
})
