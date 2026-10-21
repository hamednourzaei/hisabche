// ============================================
// docs/always-local-operational-pull-migration.sql, run unchanged — twice —
// on a real Postgres, then the rules it has to hold.
//
// A migration that throws leaves the old schema in place and is retried on
// the next launch; a trigger that fires for the wrong table sends every
// device the wrong rows. So this runs the file twice and then sends the
// writes the change log must record — and the one it must not.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-operational-'))
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
const MIGRATION = readFileSync(join(DOCS, 'always-local-operational-pull-migration.sql'), 'utf8')
const VERIFY = readFileSync(join(DOCS, 'VERIFY-always-local-operational-pull.sql'), 'utf8')

/**
 * The ROLLBACK block the migration documents, as SQL.
 *
 * Read out of the file itself, so the rollback a person would run is the one
 * this test runs. CRLF is stripped first: `$` never matches before a carriage
 * return, and an empty parse would make the test below assert nothing.
 */
function documentedRollback(file: string): string {
  const lines = file.split('\n').map((line) => line.replace(/\r$/, ''))
  const start = lines.findIndex((line) => /^--\s*ROLLBACK\s*$/.test(line))
  if (start < 0) throw new Error('the migration documents no ROLLBACK block')
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^--\s*={5,}/.test(line)) break
    if (/^--\s*-{5,}/.test(line)) continue
    const match = /^--\s?(.*)$/.exec(line)
    if (match) body.push(match[1]!)
  }
  const rollback = body.join('\n')
  if (!/DROP\s+TRIGGER/i.test(rollback)) {
    throw new Error('the ROLLBACK block parsed to nothing usable')
  }
  return rollback
}

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WAREHOUSE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let sql: ReturnType<typeof postgres>

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

    CREATE TABLE workspaces (id uuid PRIMARY KEY, name text);
    INSERT INTO workspaces (id, name) VALUES ('${SHOP}', 'shop'), ('${OTHER}', 'other');

    CREATE TABLE sync_change_log (
      id           bigserial PRIMARY KEY,
      workspace_id uuid NOT NULL,
      entity_type  text NOT NULL,
      entity_id    uuid NOT NULL,
      operation    text NOT NULL,
      entity_version bigint,
      origin_device text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE warehouses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      name text NOT NULL,
      location text,
      branch_id uuid,
      is_active boolean DEFAULT true,
      updated_at timestamp DEFAULT now()
    );

    CREATE TABLE branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      code text NOT NULL,
      name text NOT NULL,
      parent_branch_id uuid,
      is_active boolean NOT NULL DEFAULT true,
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE exchange_rates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      currency_code text NOT NULL,
      rate numeric(20, 8) NOT NULL,
      rate_date date NOT NULL DEFAULT CURRENT_DATE,
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE warehouse_stock (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid,
      warehouse_id uuid NOT NULL,
      product_id uuid NOT NULL,
      quantity numeric NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('the operational pull', () => {
  it('runs twice without error', async () => {
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION)
  })

  it('the version columns exist, with the default the trigger reads', async () => {
    const rows = await sql<{ table_name: string; data_type: string }[]>`
      SELECT table_name, data_type FROM information_schema.columns
      WHERE column_name = 'version'
        AND table_name IN ('warehouses', 'branches', 'exchange_rates', 'warehouse_stock')
      ORDER BY table_name`
    expect(rows.map((r) => r.table_name)).toEqual([
      'branches',
      'exchange_rates',
      'warehouse_stock',
      'warehouses',
    ])
    expect(rows.every((r) => r.data_type === 'bigint')).toBe(true)
  })

  it('a changed warehouse lands in the change log, with its workspace', async () => {
    await sql`INSERT INTO warehouses (id, workspace_id, name) VALUES (${WAREHOUSE}, ${SHOP}, 'Main')`
    await sql`UPDATE warehouses SET name = 'Main store' WHERE id = ${WAREHOUSE}`

    const rows = await sql<{ entity_type: string; operation: string; workspace_id: string }[]>`
      SELECT entity_type, operation, workspace_id::text FROM sync_change_log
      WHERE entity_id = ${WAREHOUSE} ORDER BY id`
    expect(rows.length).toBe(2)
    expect(rows[0]?.entity_type).toBe('warehouse')
    expect(rows[0]?.operation).toBe('create')
    expect(rows[1]?.operation).toBe('update')
    expect(rows[1]?.workspace_id).toBe(SHOP)
  })

  it('the version moves forward on every update', async () => {
    const [row] = await sql<
      { version: number }[]
    >`SELECT version FROM warehouses WHERE id = ${WAREHOUSE}`
    await sql`UPDATE warehouses SET location = 'Kabul' WHERE id = ${WAREHOUSE}`
    const [after] = await sql<
      { version: number }[]
    >`SELECT version FROM warehouses WHERE id = ${WAREHOUSE}`
    expect(Number(after?.version)).toBe(Number(row?.version) + 1)
  })

  it('a row with no workspace is never logged', async () => {
    await sql`INSERT INTO warehouses (id, workspace_id, name) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', NULL, 'Nowhere')`
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM sync_change_log
      WHERE entity_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'`
    expect(rows[0]?.n).toBe(0)
  })

  it('a delete is logged as a delete', async () => {
    await sql`DELETE FROM warehouses WHERE id = ${WAREHOUSE}`
    const rows = await sql<{ operation: string }[]>`
      SELECT operation FROM sync_change_log WHERE entity_id = ${WAREHOUSE} ORDER BY id`
    expect(rows[rows.length - 1]?.operation).toBe('delete')
  })

  it('another business is never mixed into this one', async () => {
    await sql`INSERT INTO branches (workspace_id, code, name) VALUES (${OTHER}, 'X', 'Other')`
    const rows = await sql<{ workspace_id: string }[]>`
      SELECT workspace_id::text FROM sync_change_log WHERE entity_type = 'branch'`
    expect(rows.every((r) => r.workspace_id === OTHER)).toBe(true)
  })

  it('the VERIFY file runs against the migrated schema', async () => {
    await sql.unsafe(VERIFY)
  })

  it('the documented ROLLBACK stops the logging, and the migration restores it', async () => {
    await sql.unsafe(documentedRollback(MIGRATION))

    const [gone] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM pg_trigger
      WHERE tgname IN ('warehouses_change_log_trg', 'branches_change_log_trg',
                       'exchange_rates_change_log_trg', 'warehouse_stock_change_log_trg')`
    expect(gone?.n).toBe(0)

    // With the rule off, a new branch is NOT logged: the rollback really
    // removed the behaviour, so the tests above are not passing by accident.
    const probe = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    await sql`INSERT INTO branches (id, workspace_id, code, name) VALUES (${probe}, ${SHOP}, 'RB', 'Rollback probe')`
    const [silent] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM sync_change_log WHERE entity_id = ${probe}`
    expect(silent?.n).toBe(0)

    // Back-test: the same file, run again, puts the rule back.
    await sql.unsafe(MIGRATION)
    await sql`UPDATE branches SET name = 'Restored' WHERE id = ${probe}`
    const [logged] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM sync_change_log
      WHERE entity_id = ${probe} AND operation = 'update'`
    expect(logged?.n).toBe(1)
  })
})
