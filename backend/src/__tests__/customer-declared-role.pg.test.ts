// ============================================
// docs/customer-declared-role-01-migration.sql, run unchanged — twice — on a real
// Postgres.
// Proves the CHECK refuses a bad value and accepts NULL and the three valid roles.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-role-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const MIGRATION = readFileSync(join(DOCS, 'customer-declared-role-01-migration.sql'), 'utf8')
const VERIFY = readFileSync(join(DOCS, 'VERIFY-customer-declared-role-01.sql'), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

let sql: ReturnType<typeof postgres>

async function refusal(work: () => Promise<unknown>): Promise<string | null> {
  try {
    await work()
    return null
  } catch (error) {
    return String((error as Error).message)
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    password: 'test',
    max: 1,
    onnotice: () => undefined,
  })
  await sql.unsafe(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE TABLE workspaces (id uuid PRIMARY KEY, base_currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id),
      full_name text NOT NULL,
      type text NOT NULL DEFAULT 'cash',
      opening_balance numeric NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true
    );

    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      customer_id uuid,
      type text
    );

    INSERT INTO workspaces (id) VALUES ('${SHOP}');
    INSERT INTO customers (id, workspace_id, full_name) VALUES ('${id(1)}', '${SHOP}', 'Hamid');
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('customer-declared-role-01', () => {
  it('runs twice without an error (idempotent)', async () => {
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION)
  })

  it('runs the verification query and all checks pass', async () => {
    const results = await sql.unsafe<{ check_name: string; ok: boolean }[]>(VERIFY)
    expect(results.length).toBeGreaterThanOrEqual(2)
    for (const r of results) {
      expect(r.ok).toBe(true)
    }
  })

  it('leaves existing row with declared_role as NULL', async () => {
    const [row] = await sql`SELECT declared_role FROM customers WHERE id = ${id(1)}`
    expect(row!.declared_role).toBeNull()
  })

  it('accepts NULL as declared_role', async () => {
    const cid = id(2)
    await sql`INSERT INTO customers (id, workspace_id, full_name, declared_role)
              VALUES (${cid}, ${SHOP}, 'Null Role Party', NULL)`
    const [row] = await sql`SELECT declared_role FROM customers WHERE id = ${cid}`
    expect(row!.declared_role).toBeNull()
  })

  it('accepts buyer as declared_role', async () => {
    const cid = id(3)
    await sql`INSERT INTO customers (id, workspace_id, full_name, declared_role)
              VALUES (${cid}, ${SHOP}, 'Buyer Party', 'buyer')`
    const [row] = await sql`SELECT declared_role FROM customers WHERE id = ${cid}`
    expect(row!.declared_role).toBe('buyer')
  })

  it('accepts seller as declared_role', async () => {
    const cid = id(4)
    await sql`INSERT INTO customers (id, workspace_id, full_name, declared_role)
              VALUES (${cid}, ${SHOP}, 'Supplier Party', 'seller')`
    const [row] = await sql`SELECT declared_role FROM customers WHERE id = ${cid}`
    expect(row!.declared_role).toBe('seller')
  })

  it('accepts both as declared_role', async () => {
    const cid = id(5)
    await sql`INSERT INTO customers (id, workspace_id, full_name, declared_role)
              VALUES (${cid}, ${SHOP}, 'Both Party', 'both')`
    const [row] = await sql`SELECT declared_role FROM customers WHERE id = ${cid}`
    expect(row!.declared_role).toBe('both')
  })

  it('refuses an invalid declared_role', async () => {
    const cid = id(6)
    const err = await refusal(
      () => sql`INSERT INTO customers (id, workspace_id, full_name, declared_role)
                VALUES (${cid}, ${SHOP}, 'Invalid Role Party', 'other')`,
    )
    expect(err).toContain('customers_declared_role_check')
  })

  it('customer_invoice_roles: one row per party, by workspace, and a missing type is a sale', async () => {
    const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    await sql.unsafe(`
      INSERT INTO workspaces (id) VALUES ('${OTHER}');
      INSERT INTO invoices (workspace_id, customer_id, type) VALUES
        ('${SHOP}', '${id(11)}', 'sale'),
        ('${SHOP}', '${id(11)}', 'sale'),
        ('${SHOP}', '${id(12)}', 'purchase'),
        ('${SHOP}', '${id(13)}', 'sale'),
        ('${SHOP}', '${id(13)}', 'purchase'),
        ('${SHOP}', '${id(14)}', NULL),
        ('${SHOP}', NULL, 'sale'),
        ('${OTHER}', '${id(12)}', 'sale');
    `)
    const rows = await sql`SELECT * FROM public.customer_invoice_roles(${SHOP})`
    expect(rows.map((row) => [row.customer_id, row.has_sale, row.has_purchase])).toEqual([
      [id(11), true, false],
      [id(12), false, true],
      [id(13), true, true],
      [id(14), true, false],
    ])
    // In pages by key: two, then the two after them, then none.
    const first = await sql`SELECT customer_id FROM public.customer_invoice_roles(${SHOP}, NULL, 2)`
    expect(first.map((row) => row.customer_id)).toEqual([id(11), id(12)])
    const second = await sql`
      SELECT customer_id FROM public.customer_invoice_roles(${SHOP}, ${id(12)}, 2)
    `
    expect(second.map((row) => row.customer_id)).toEqual([id(13), id(14)])
    const third = await sql`
      SELECT customer_id FROM public.customer_invoice_roles(${SHOP}, ${id(14)}, 2)
    `
    expect(third.length).toBe(0)

    // The other business's sale to the same id is not ours.
    const theirs = await sql`SELECT * FROM public.customer_invoice_roles(${OTHER})`
    expect(theirs.map((row) => [row.customer_id, row.has_sale, row.has_purchase])).toEqual([
      [id(12), true, false],
    ])
  })

  it('⚠️ with Supabase default grants, the browser roles still cannot call it', async () => {
    const [row] = await sql`
      SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
        FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'customer_invoice_roles'
    `
    expect(row).toEqual({ anon: false, authed: false, service: true })
  })
})
