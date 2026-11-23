// ============================================
// docs/advances-04-party-identity-migration.sql run twice on real Postgres,
// testing party identity separation: pre_purchase requires supplier_id,
// pre_sale requires customer_id, and data backfill links existing suppliers.
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
  databaseDir: pgTempDir('hisabche-pg-adv04-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/adv04`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const W = '11111111-1111-4111-8111-111111111111'
const C = '22222222-2222-4222-8222-222222222222'
const S = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('adv04')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

    CREATE TABLE public.customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      full_name text NOT NULL
    );

    CREATE TABLE public.suppliers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      name text NOT NULL
    );

    CREATE TABLE public.order_deposits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      order_id uuid NOT NULL,
      customer_id uuid NOT NULL,
      amount_minor bigint NOT NULL CHECK (amount_minor > 0),
      source_type text NOT NULL DEFAULT 'sales_order',
      note text
    );

    INSERT INTO public.customers (id, workspace_id, full_name) VALUES ('${C}', '${W}', 'Test Customer');
    INSERT INTO public.suppliers (id, workspace_id, name) VALUES ('${S}', '${W}', 'Test Supplier');

    -- Legacy row: pre_purchase stored with supplier ID in customer_id
    INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${W}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${S}', 500, 'pre_purchase');

    -- Legacy row that CANNOT be mapped: the stored party is a customer, which
    -- is the shape the old route produced. It must survive the migration and
    -- stay updatable, or a historical refund would be blocked forever.
    INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type)
    VALUES ('abababab-abab-4bab-8bab-abababababab', '${W}', 'abababab-abab-4bab-8bab-abababababab', '${C}', 700, 'pre_purchase');
  `)

  // Run migration twice for idempotency proof
  await setup.unsafe(read('advances-04-party-identity-migration.sql'))
  await setup.unsafe(read('advances-04-party-identity-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('advances-04-party-identity', () => {
  it('backfills legacy pre_purchase row to supplier_id', async () => {
    const [row] = await sql`
      SELECT customer_id, supplier_id
      FROM public.order_deposits
      WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    `
    expect(row).toBeDefined()
    expect(row!.supplier_id).toBe(S)
    expect(row!.customer_id).toBeNull()
  })

  it('allows pre_purchase with supplier_id', async () => {
    const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    await sql`
      INSERT INTO public.order_deposits (id, workspace_id, order_id, supplier_id, amount_minor, source_type)
      VALUES (${id}, ${W}, ${id}, ${S}, 1000, 'pre_purchase')
    `
    const [row] =
      await sql`SELECT supplier_id, customer_id FROM public.order_deposits WHERE id = ${id}`
    expect(row).toBeDefined()
    expect(row!.supplier_id).toBe(S)
    expect(row!.customer_id).toBeNull()
  })

  it('allows pre_sale with customer_id', async () => {
    const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await sql`
      INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type)
      VALUES (${id}, ${W}, ${id}, ${C}, 1200, 'pre_sale')
    `
    const [row] =
      await sql`SELECT supplier_id, customer_id FROM public.order_deposits WHERE id = ${id}`
    expect(row).toBeDefined()
    expect(row!.customer_id).toBe(C)
    expect(row!.supplier_id).toBeNull()
  })

  it('refuses pre_purchase with missing supplier_id', async () => {
    const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    await expect(
      sql`
        INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type)
        VALUES (${id}, ${W}, ${id}, NULL, 800, 'pre_purchase')
      `,
    ).rejects.toThrow(/order_deposits_party_check/)
  })

  it('keeps an unmappable legacy row and leaves it updatable', async () => {
    const id = 'abababab-abab-4bab-8bab-abababababab'
    // The party is a customer, not a supplier: no deterministic mapping exists,
    // so the migration must not invent one.
    const [before] =
      await sql`SELECT customer_id, supplier_id FROM public.order_deposits WHERE id = ${id}`
    expect(before).toBeDefined()
    expect(before!.customer_id).toBe(C)
    expect(before!.supplier_id).toBeNull()

    // Posting / refunding must still work: those writes do not touch the party.
    await sql`UPDATE public.order_deposits SET note = 'reviewed' WHERE id = ${id}`
  })

  it('refuses changing the party columns of an unresolved legacy row', async () => {
    const id = 'abababab-abab-4bab-8bab-abababababab'
    await expect(
      sql`UPDATE public.order_deposits SET customer_id = NULL WHERE id = ${id}`,
    ).rejects.toThrow(/order_deposits_party_check/)
  })

  it('refuses pre_purchase whose party is only customer_id (the D-1 corruption shape)', async () => {
    const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    await expect(
      sql`
        INSERT INTO public.order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type)
        VALUES (${id}, ${W}, ${id}, ${C}, 800, 'pre_purchase')
      `,
    ).rejects.toThrow(/order_deposits_party_check/)
  })

  it('refuses pre_sale whose party is only supplier_id', async () => {
    const id = '12121212-1212-4212-8212-121212121212'
    await expect(
      sql`
        INSERT INTO public.order_deposits (id, workspace_id, order_id, supplier_id, amount_minor, source_type)
        VALUES (${id}, ${W}, ${id}, ${S}, 900, 'pre_sale')
      `,
    ).rejects.toThrow(/order_deposits_party_check/)
  })

  it('refuses pre_purchase with nonexistent supplier_id (FK)', async () => {
    const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const nonExistent = '99999999-9999-4999-8999-999999999999'
    await expect(
      sql`
        INSERT INTO public.order_deposits (id, workspace_id, order_id, supplier_id, amount_minor, source_type)
        VALUES (${id}, ${W}, ${id}, ${nonExistent}, 800, 'pre_purchase')
      `,
    ).rejects.toThrow(/violates foreign key constraint/)
  })
})
