// ============================================
// backend/src/__tests__/operational-pull-02.pg.test.ts
//
// Real PostgreSQL: docs/operational-pull-02-migration.sql, applied TWICE.
//
// The four tables the delta pull did not carry — product_variants,
// service_delivery_sessions, package_credit_ledger, repair_tickets — must now
// write to `sync_change_log` inside the same transaction as the business write,
// with the entity name the protocol uses, a bumped `version`, and no client
// allowed to call the trigger functions.
//
// ⚠️ WHEN THE EMBEDDED BINARY CANNOT START the tests are reported SKIPPED,
// never passed. A skipped Postgres test is not a green test.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-operational-pull-02-')
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
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const W = '22222222-2222-4222-8222-222222222222'
const C = '66666666-6666-4666-8666-666666666666'
const P = '33333333-3333-4333-8333-333333333333'
const U = '11111111-1111-4111-8111-111111111111'

/**
 * Only the columns the triggers and the assertions need. The real tables are
 * created by their own migrations; this file is about the change log, not the
 * shape of a product variant.
 */
const BASE = `
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.employees (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.branches (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.invoices (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.stock_serials (id uuid PRIMARY KEY, workspace_id uuid);

  CREATE TABLE public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    template_product_id uuid NOT NULL,
    sku text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE public.service_delivery_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    service_offering_id uuid NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'scheduled',
    session_date date NOT NULL DEFAULT CURRENT_DATE,
    start_time varchar(10) NOT NULL DEFAULT '10:00',
    end_time varchar(10) NOT NULL DEFAULT '11:00'
  );
  CREATE TABLE public.package_credit_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    package_product_id uuid NOT NULL,
    entry_type text NOT NULL,
    quantity numeric(18,4) NOT NULL
  );
  CREATE TABLE public.repair_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    device_label text NOT NULL,
    problem text NOT NULL,
    status text NOT NULL DEFAULT 'received'
  );

  -- The log exactly as docs/sync-engine-migration.sql creates it.
  CREATE TABLE public.sync_change_log (
    sync_version   BIGSERIAL PRIMARY KEY,
    workspace_id   UUID NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      UUID NOT NULL,
    operation      TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
    entity_version BIGINT NOT NULL DEFAULT 1,
    origin_device  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`

let sql: postgres.Sql | undefined
let started = false

const q = async (text: string, params?: unknown[]) => {
  if (!sql) throw new Error('database not started')
  const rows = await sql.unsafe(text, (params ?? []) as never[])
  return rows as unknown as Array<Record<string, unknown>>
}

const logFor = async (entityType: string) =>
  q(
    `SELECT operation, entity_id, entity_version FROM public.sync_change_log
     WHERE entity_type = $1 ORDER BY sync_version ASC`,
    [entityType],
  )

describe('Postgres: the four tables reach the delta pull (operational-pull-02)', () => {
  beforeAll(async () => {
    try {
      await pg.initialise()
      await pg.start()
    } catch {
      return // non-elevated Windows (error 1314) or a quarantined binary
    }
    started = true

    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE operational_pull_test;`
    await admin.end()

    sql = postgres(`postgres://postgres:test@localhost:${PORT}/operational_pull_test`, {
      max: 1,
      onnotice: () => {},
    })

    await q(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      END $$;
    `)
    await q(BASE)

    // ⚠️ Twice: a migration nobody dares run twice is a migration that will
    // half-apply on a database somebody already touched.
    await q(read('operational-pull-02-migration.sql'))
    await q(read('operational-pull-02-migration.sql'))

    await q(`INSERT INTO public.workspaces (id) VALUES ($1)`, [W])
    await q(`INSERT INTO public.customers (id, workspace_id) VALUES ($1, $2)`, [C, W])
    await q(`INSERT INTO public.products (id, workspace_id) VALUES ($1, $2)`, [P, W])
    await q(`INSERT INTO public.stock_serials (id, workspace_id) VALUES (gen_random_uuid(), $1)`, [
      W,
    ])
  }, 180_000)

  afterAll(async () => {
    if (sql) await sql.end()
    try {
      await pg.stop()
    } catch {
      /* the directory is removed below either way */
    }
  })

  it('adds `version` to all four tables and the change-log trigger to each', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    const tables = [
      'product_variants',
      'service_delivery_sessions',
      'package_credit_ledger',
      'repair_tickets',
    ]
    for (const table of tables) {
      const v = await q(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'version'`,
        [table],
      )
      expect(v.length, `${table} has no version column`).toBe(1)

      const triggers = await q(
        `SELECT tgname FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         WHERE NOT t.tgisinternal AND c.relname = $1
         ORDER BY tgname`,
        [table],
      )
      const names = triggers.map((row) => String(row.tgname))
      expect(names, `${table} triggers`).toEqual([
        `${table}_bump_version_trg`,
        `${table}_change_log_trg`,
      ])
    }
  })

  it('writes one log row per business write, under the protocol entity name', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    const variant = '44444444-4444-4444-8444-444444444441'
    await q(
      `INSERT INTO public.product_variants (id, workspace_id, template_product_id, sku)
       VALUES ($1, $2, $3, 'SKU-1')`,
      [variant, W, P],
    )
    // The protocol name, not the table name spelled differently: the client
    // filters on this string.
    const created = await logFor('product_variants')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ operation: 'create', entity_id: variant, entity_version: 1 })

    await q(`UPDATE public.product_variants SET sku = 'SKU-2' WHERE id = $1`, [variant])
    const updated = await logFor('product_variants')
    expect(updated).toHaveLength(2)
    expect(updated[1]).toMatchObject({ operation: 'update', entity_version: 2 })

    await q(`DELETE FROM public.product_variants WHERE id = $1`, [variant])
    const deleted = await logFor('product_variants')
    expect(deleted).toHaveLength(3)
    expect(deleted[2]).toMatchObject({ operation: 'delete', entity_id: variant })
  })

  it('carries the other three tables too — a ticket a device cannot see is a ticket nobody does', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    await q(
      `INSERT INTO public.service_delivery_sessions (workspace_id, customer_id, service_offering_id)
       VALUES ($1, $2, $3)`,
      [W, C, P],
    )
    await q(
      `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity)
       VALUES ($1, $2, $3, 'GRANT', 10)`,
      [W, C, P],
    )
    await q(
      `INSERT INTO public.repair_tickets (workspace_id, customer_id, device_label, problem)
       VALUES ($1, $2, 'iPhone 13', 'no charging')`,
      [W, C],
    )

    for (const entity of ['service_delivery_sessions', 'package_credit_ledger', 'repair_tickets']) {
      const rows = await logFor(entity)
      expect(rows.length, `${entity} produced no change-log row`).toBe(1)
      expect(rows[0]?.operation).toBe('create')
    }
  })

  it('refuses a client the trigger functions, and allows service_role to read the log', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    const privilege = await q(
      `SELECT
         has_function_privilege('anon', 'public.sync_bump_version()', 'EXECUTE') AS anon_bump,
         has_function_privilege('authenticated', 'public.sync_record_change()', 'EXECUTE') AS auth_record,
         has_function_privilege('service_role', 'public.sync_record_change()', 'EXECUTE') AS service_record`,
    )
    expect(privilege[0]).toMatchObject({
      anon_bump: false,
      auth_record: false,
      service_record: true,
    })
  })

  it('leaves the VERIFY queries answering what they promise', async () => {
    if (!started) return expect(started, 'postgres did not start — run in CI').toBe(true)

    const verify = read('VERIFY-operational-pull-02.sql')
    // Each statement in the file must run; a VERIFY that throws on the real
    // database is worse than none, because it is what the owner runs.
    for (const statement of verify.split(/;\s*\n/).map((s) => s.trim())) {
      const body = statement.replace(/^--.*$/gm, '').trim()
      if (body.length === 0) continue
      await q(body)
    }
  })
})
