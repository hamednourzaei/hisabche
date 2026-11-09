// ============================================
// docs/advances-03-migration.sql run twice on real Postgres, then VERIFY:
// only an advance carries lines, the advance can't exceed the document, and
// the document is frozen once written.
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
  databaseDir: pgTempDir('hisabche-pg-adv03-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/adv`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const W = '11111111-1111-4111-8111-111111111111'
const C = '22222222-2222-4222-8222-222222222222'
const doc = (total: number) =>
  JSON.stringify({ lines: [{ name: 'x', quantity: 1, totalMinor: total }], totalMinor: total })

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('adv')
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
    CREATE TABLE public.order_deposits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      order_id uuid NOT NULL,
      customer_id uuid NOT NULL,
      amount_minor bigint NOT NULL CHECK (amount_minor > 0),
      source_type text NOT NULL DEFAULT 'sales_order',
      note text
    );
  `)
  await setup.unsafe(read('advances-03-migration.sql'))
  await setup.unsafe(read('advances-03-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('advances-03', () => {
  it('a pre-sale with lines is accepted and VERIFY is all true', async () => {
    const id = '33333333-3333-4333-8333-333333333333'
    await sql`INSERT INTO order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type, document)
              VALUES (${id}, ${W}, ${id}, ${C}, 500, 'pre_sale', ${doc(1000)}::jsonb)`
    const rows = await sql.unsafe(read('VERIFY-advances-03.sql'))
    expect(rows.length).toBe(5)
    expect(rows.every((row) => row.ok === true)).toBe(true)
  })

  it('refuses an advance larger than its document', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    await expect(
      sql`INSERT INTO order_deposits (id, workspace_id, order_id, customer_id, amount_minor, source_type, document)
          VALUES (${id}, ${W}, ${id}, ${C}, 1500, 'pre_sale', ${doc(1000)}::jsonb)`,
    ).rejects.toThrow(/order_deposits_document_shape/)
  })

  it('refuses lines on an ordinary order deposit', async () => {
    await expect(
      sql`INSERT INTO order_deposits (workspace_id, order_id, customer_id, amount_minor, document)
          VALUES (${W}, ${C}, ${C}, 100, ${doc(1000)}::jsonb)`,
    ).rejects.toThrow(/order_deposits_document_shape/)
  })

  it('the document cannot be changed once written', async () => {
    await expect(
      sql`UPDATE order_deposits SET document = ${doc(2000)}::jsonb WHERE id = '33333333-3333-4333-8333-333333333333'`,
    ).rejects.toThrow(/ADVANCE_DOCUMENT_FROZEN/)
    await sql`UPDATE order_deposits SET note = 'ok' WHERE id = '33333333-3333-4333-8333-333333333333'`
  })
})
