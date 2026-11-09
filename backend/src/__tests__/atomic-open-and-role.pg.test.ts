// ============================================
// cycle-count-04 and role-permissions-atomic-01 on real Postgres, each run
// TWICE. ⚠️ Cannot run on the owner's machine since 31 Oct 2026
// (embedded-postgres binaries removed by Defender) — runs in CI.
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
  databaseDir: pgTempDir('hisabche-pg-atomic-open-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/atomicopen`
let sql: postgres.Sql

const docs = join(__dirname, '..', '..', '..', 'docs')
const read = (f: string) => readFileSync(join(docs, f), 'utf8')

const WS = '11111111-1111-4111-8111-111111111111'
const OTHER_WS = '22222222-2222-4222-8222-222222222222'
const WH = '33333333-3333-4333-8333-333333333333'
const OTHER_WH = '44444444-4444-4444-8444-444444444444'
const P1 = '55555555-5555-4555-8555-555555555555'
const P_OTHER = '66666666-6666-4666-8666-666666666666'
const USER = '77777777-7777-4777-8777-777777777777'
const ROLE = '88888888-8888-4888-8888-888888888888'
const PERM_A = '99999999-9999-4999-8999-999999999991'
const PERM_B = '99999999-9999-4999-8999-999999999992'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('atomicopen')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE warehouses (id uuid PRIMARY KEY, workspace_id uuid NOT NULL);
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, quantity numeric);
    CREATE TABLE cycle_counts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
      warehouse_id uuid NOT NULL, status text NOT NULL DEFAULT 'draft',
      created_by uuid, notes text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE cycle_count_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
      count_id uuid NOT NULL REFERENCES cycle_counts (id) ON DELETE CASCADE,
      product_id uuid NOT NULL, expected_qty numeric(18,4) NOT NULL, counted_qty numeric(18,4));
    CREATE TABLE roles (id uuid PRIMARY KEY, name text NOT NULL, description text, updated_at timestamp);
    CREATE TABLE role_permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_id uuid NOT NULL, permission_id uuid NOT NULL);
  `)
  for (const f of ['cycle-count-04-migration.sql', 'role-permissions-atomic-01-migration.sql']) {
    await setup.unsafe(read(f))
    await setup.unsafe(read(f))
  }
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
  await sql`INSERT INTO warehouses VALUES (${WH}, ${WS}), (${OTHER_WH}, ${OTHER_WS})`
  await sql`INSERT INTO products VALUES (${P1}, ${WS}, 7), (${P_OTHER}, ${OTHER_WS}, 9)`
  await sql`INSERT INTO roles (id, name) VALUES (${ROLE}, 'clerk')`
  await sql`INSERT INTO role_permissions (role_id, permission_id) VALUES (${ROLE}, ${PERM_A})`
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  await pg.stop()
})

describe('cycle_count_open', () => {
  it('writes header and frozen lines for this workspace only', async () => {
    const opened =
      await sql`SELECT cycle_count_open(${WS}, ${WH}, ${USER}, 'n', ${[P1, P_OTHER]}::uuid[]) AS id`
    const id = String(opened[0]?.id)
    const lines =
      await sql`SELECT product_id, expected_qty, counted_qty FROM cycle_count_lines WHERE count_id = ${id}`
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ product_id: P1, counted_qty: null })
    expect(Number(lines[0]?.expected_qty)).toBe(7)
  })

  it('leaves NO header behind when no product matches', async () => {
    const before = await sql`SELECT count(*)::int AS n FROM cycle_counts`
    await expect(
      sql`SELECT cycle_count_open(${WS}, ${WH}, ${USER}, null, ${[P_OTHER]}::uuid[])`,
    ).rejects.toThrow(/CYCLE_COUNT_NO_PRODUCTS/)
    const after = await sql`SELECT count(*)::int AS n FROM cycle_counts`
    expect(after[0]?.n).toBe(before[0]?.n)
  })

  it("refuses another workspace's warehouse", async () => {
    await expect(
      sql`SELECT cycle_count_open(${WS}, ${OTHER_WH}, ${USER}, null, ${[P1]}::uuid[])`,
    ).rejects.toThrow(/CYCLE_COUNT_WAREHOUSE_NOT_FOUND/)
  })

  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-cycle-count-04.sql'))
    expect(rows.filter((r) => r.ok !== true)).toEqual([])
  })
})

describe('role_update_with_permissions', () => {
  it('replaces the set and the name in one call', async () => {
    await sql`SELECT role_update_with_permissions(${ROLE}, true, 'cashier', false, null, ${[PERM_B, PERM_B]}::uuid[])`
    const perms = await sql`SELECT permission_id FROM role_permissions WHERE role_id = ${ROLE}`
    expect(perms.map((p) => p.permission_id)).toEqual([PERM_B])
    const [role] = await sql`SELECT name FROM roles WHERE id = ${ROLE}`
    expect(role?.name).toBe('cashier')
  })

  it('NULL permission ids leaves the set alone', async () => {
    await sql`SELECT role_update_with_permissions(${ROLE}, false, null, true, 'd', null)`
    const perms = await sql`SELECT permission_id FROM role_permissions WHERE role_id = ${ROLE}`
    expect(perms.map((p) => p.permission_id)).toEqual([PERM_B])
  })

  it('an unknown role changes nothing', async () => {
    await expect(
      sql`SELECT role_update_with_permissions(${USER}, false, null, false, null, ${[PERM_A]}::uuid[])`,
    ).rejects.toThrow(/ROLE_NOT_FOUND/)
  })

  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-role-permissions-atomic-01.sql'))
    expect(rows.filter((r) => r.ok !== true)).toEqual([])
  })
})
