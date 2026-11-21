// ============================================
// Workspace purge — docs/workspace-purge-migration.sql run TWICE on a real
// Postgres.
//
// The owner asked for «حذف کامل اشتراک و دیتابیسشون»: delete one business and
// every row it owns, in one transaction, and never leave half a business
// behind. The test proves:
//   * the typed name is required (a wrong name deletes nothing),
//   * rows are removed from workspace_id tables AND from child tables that
//     carry only their parent's id,
//   * another workspace is untouched,
//   * an unreachable row makes the function refuse instead of half-deleting.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-purge-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/purge`
let sql: postgres.Sql

const migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'workspace-purge-migration.sql'),
  'utf8',
)

const WS = '11111111-1111-1111-1111-111111111111'
const OTHER_WS = '22222222-2222-2222-2222-222222222222'
const UNREACHABLE_WS = '33333333-3333-3333-3333-333333333333'
const OWNER = '44444444-4444-4444-4444-444444444444'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('purge')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    -- The shape a real business has: workspace-owned parents, children that
    -- carry only the parent id, and a join table with no id of its own.
    CREATE TABLE workspaces (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      owner_id uuid
    );
    CREATE TABLE workspace_members (
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      user_id uuid NOT NULL,
      role text NOT NULL,
      PRIMARY KEY (workspace_id, user_id)
    );
    CREATE TABLE customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      name text NOT NULL
    );
    CREATE TABLE products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      name text NOT NULL
    );
    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
      total_minor bigint NOT NULL DEFAULT 0
    );
    CREATE TABLE invoice_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
      quantity integer NOT NULL DEFAULT 1
    );
    CREATE TABLE journal_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      memo text
    );
    CREATE TABLE journal_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
      debit_minor bigint NOT NULL DEFAULT 0
    );
    CREATE TABLE subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid REFERENCES workspaces(id) ON DELETE RESTRICT,
      plan text NOT NULL
    );
    CREATE TABLE subscription_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      event text NOT NULL
    );
  `)

  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  sql = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

async function seed(workspaceId: string, name: string) {
  await sql`INSERT INTO workspaces (id, name, owner_id) VALUES (${workspaceId}, ${name}, ${OWNER})`
  await sql`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${workspaceId}, ${OWNER}, 'owner')`
  const [customer] = await sql`
    INSERT INTO customers (workspace_id, name) VALUES (${workspaceId}, 'Customer')
    RETURNING id`
  const [product] = await sql`
    INSERT INTO products (workspace_id, name) VALUES (${workspaceId}, 'Product')
    RETURNING id`
  const [invoice] = await sql`
    INSERT INTO invoices (workspace_id, customer_id, total_minor)
    VALUES (${workspaceId}, ${customer!.id}, 5000) RETURNING id`
  await sql`
    INSERT INTO invoice_items (invoice_id, product_id, quantity)
    VALUES (${invoice!.id}, ${product!.id}, 2)`
  const [entry] = await sql`
    INSERT INTO journal_entries (workspace_id, memo) VALUES (${workspaceId}, 'sale')
    RETURNING id`
  await sql`
    INSERT INTO journal_lines (journal_entry_id, debit_minor)
    VALUES (${entry!.id}, 5000)`
  await sql`
    INSERT INTO subscriptions (workspace_id, plan) VALUES (${workspaceId}, 'pro')`
  await sql`
    INSERT INTO subscription_events (workspace_id, event) VALUES (${workspaceId}, 'upgrade_approved')`
}

async function counts(workspaceId: string) {
  const [row] = await sql`
    SELECT
      (SELECT count(*)::int FROM workspace_members WHERE workspace_id = ${workspaceId}) AS members,
      (SELECT count(*)::int FROM customers WHERE workspace_id = ${workspaceId}) AS customers,
      (SELECT count(*)::int FROM products WHERE workspace_id = ${workspaceId}) AS products,
      (SELECT count(*)::int FROM invoices WHERE workspace_id = ${workspaceId}) AS invoices,
      (SELECT count(*)::int FROM invoice_items i JOIN invoices v ON v.id = i.invoice_id
        WHERE v.workspace_id = ${workspaceId}) AS invoice_items,
      (SELECT count(*)::int FROM journal_entries WHERE workspace_id = ${workspaceId}) AS entries,
      (SELECT count(*)::int FROM journal_lines l JOIN journal_entries e ON e.id = l.journal_entry_id
        WHERE e.workspace_id = ${workspaceId}) AS lines,
      (SELECT count(*)::int FROM subscriptions WHERE workspace_id = ${workspaceId}) AS subscriptions,
      (SELECT count(*)::int FROM subscription_events WHERE workspace_id = ${workspaceId}) AS events`
  return row!
}

beforeEach(async () => {
  // Last test creates an unreachable row; clear it before the others.
  await sql`DROP TABLE IF EXISTS product_tags`
  await sql`DROP TABLE IF EXISTS products_without_id`
  await sql`DELETE FROM subscription_events`
  await sql`DELETE FROM subscriptions`
  await sql`DELETE FROM journal_lines`
  await sql`DELETE FROM journal_entries`
  await sql`DELETE FROM invoice_items`
  await sql`DELETE FROM invoices`
  await sql`DELETE FROM products`
  await sql`DELETE FROM customers`
  await sql`DELETE FROM workspace_members`
  await sql`DELETE FROM workspaces`
})

describe('purge one business, keep the other', () => {
  it('requires the exact typed name and deletes nothing on a mismatch', async () => {
    await seed(WS, 'Lolokhan')
    await seed(OTHER_WS, 'Gallery')

    await expect(sql`SELECT purge_workspace(${WS}::uuid, 'Lolokha')`).rejects.toThrow(
      /WORKSPACE_NAME_MISMATCH/,
    )

    const after = await counts(WS)
    expect(after).toMatchObject({
      members: 1,
      customers: 1,
      products: 1,
      invoices: 1,
      invoice_items: 1,
      entries: 1,
      lines: 1,
      subscriptions: 1,
      events: 1,
    })
    expect(await sql`SELECT 1 FROM workspaces WHERE id = ${WS}`).toHaveLength(1)
  })

  it('deletes the workspace, every workspace-owned row and every child row', async () => {
    await seed(WS, 'Lolokhan')
    await seed(OTHER_WS, 'Gallery')

    const [result] = (await sql`
      SELECT purge_workspace(${WS}::uuid, 'Lolokhan') AS result`) as unknown as [
      { result: { deleted_rows: number; passes: number } },
    ]
    expect(result.result.deleted_rows).toBeGreaterThanOrEqual(10)
    expect(result.result.passes).toBeGreaterThanOrEqual(1)

    const gone = await counts(WS)
    for (const value of Object.values(gone)) expect(value).toBe(0)
    expect(await sql`SELECT 1 FROM workspaces WHERE id = ${WS}`).toHaveLength(0)

    // The other business is whole.
    const kept = await counts(OTHER_WS)
    expect(kept).toMatchObject({
      members: 1,
      customers: 1,
      products: 1,
      invoices: 1,
      invoice_items: 1,
      entries: 1,
      lines: 1,
      subscriptions: 1,
      events: 1,
    })
    expect(await sql`SELECT 1 FROM workspaces WHERE id = ${OTHER_WS}`).toHaveLength(1)
  })

  it('is not repeatable: a second call does not find the workspace', async () => {
    await seed(WS, 'Lolokhan')
    await sql`SELECT purge_workspace(${WS}::uuid, 'Lolokhan')`
    await expect(sql`SELECT purge_workspace(${WS}::uuid, 'Lolokhan')`).rejects.toThrow(
      /WORKSPACE_NOT_FOUND/,
    )
  })
})

describe('a half-deletable business is refused', () => {
  it('raises and rolls back when a child is unreachable', async () => {
    await sql`
      CREATE TABLE products_without_id (
        code text PRIMARY KEY,
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT
      )`
    await sql`
      CREATE TABLE product_tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_code text NOT NULL REFERENCES products_without_id(code) ON DELETE RESTRICT
      )`
    await sql`INSERT INTO workspaces (id, name, owner_id)
      VALUES (${UNREACHABLE_WS}, 'Stuck shop', ${OWNER})`
    await sql`INSERT INTO products_without_id (code, workspace_id)
      VALUES ('P-1', ${UNREACHABLE_WS})`
    await sql`INSERT INTO product_tags (product_code) VALUES ('P-1')`

    await expect(
      sql`SELECT purge_workspace(${UNREACHABLE_WS}::uuid, 'Stuck shop')`,
    ).rejects.toThrow(/WORKSPACE_PURGE_INCOMPLETE/)

    // Nothing was half-deleted.
    expect(await sql`SELECT 1 FROM workspaces WHERE id = ${UNREACHABLE_WS}`).toHaveLength(1)
    expect(
      await sql`SELECT 1 FROM products_without_id WHERE workspace_id = ${UNREACHABLE_WS}`,
    ).toHaveLength(1)
    expect(await sql`SELECT 1 FROM product_tags`).toHaveLength(1)
  })
})

describe('privileges', () => {
  it('clients cannot execute the function; service_role can', async () => {
    const [row] = await sql`
      SELECT has_function_privilege('anon', 'public.purge_workspace(uuid, text)', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'public.purge_workspace(uuid, text)', 'EXECUTE') AS member,
             has_function_privilege('service_role', 'public.purge_workspace(uuid, text)', 'EXECUTE') AS backend`
    expect(row).toEqual({ anon: false, member: false, backend: true })
  })
})
