// ============================================
// docs/pos-till-currency-01-migration.sql run unchanged (twice) in a real
// Postgres, with Supabase's default privileges, then its VERIFY — plus the
// currency check constraint and the per-currency unique index rules.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-till-cur-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/till_cur`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('till_cur')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

    -- The base table with the old unique index, before pos-till-currency-01
    CREATE TABLE pos_sessions (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id        uuid NOT NULL,
      branch_id           uuid,
      status              text NOT NULL DEFAULT 'open',
      opening_float_minor bigint NOT NULL DEFAULT 0,
      opened_at           timestamptz NOT NULL DEFAULT now(),
      opened_by           uuid NOT NULL
    );

    CREATE UNIQUE INDEX pos_sessions_one_open
      ON pos_sessions (workspace_id, opened_by, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE status = 'open';

    -- A pre-existing till: must survive untouched with currency IS NULL.
    INSERT INTO pos_sessions (workspace_id, opened_by, opening_float_minor)
    VALUES ('${WS}', '${USER}', 5000);
  `)

  // Run the migration TWICE to prove idempotency
  await setup.unsafe(read('pos-till-currency-01-migration.sql'))
  await setup.unsafe(read('pos-till-currency-01-migration.sql'))
  await setup.end()

  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('pos-till-currency-01 migration', () => {
  it('ran twice, and its VERIFY says ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-pos-till-currency-01.sql'))
    expect(row).toMatchObject({
      currency_column_exists: true,
      currency_is_nullable: true,
      currency_check_exists: true,
      currency_index_updated: true,
      ok: true,
    })
  })

  it('left the pre-existing till untouched with currency NULL', async () => {
    const rows =
      await sql`SELECT currency, opening_float_minor FROM pos_sessions WHERE opening_float_minor = 5000`
    expect(rows).toHaveLength(1)
    expect(rows[0]!.currency).toBeNull()
    expect(Number(rows[0]!.opening_float_minor)).toBe(5000)
  })

  describe('CHECK constraint on currency', () => {
    it('accepts NULL and valid 3-letter uppercase codes (including precious metals like XAU)', async () => {
      // NULL already tested on pre-existing row
      const valid = await sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, '22222222-2222-4222-8222-222222222222', 'XAU', 'closed')
        RETURNING currency;
      `
      expect(valid[0]!.currency).toBe('XAU')

      const validUsd = await sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, '33333333-3333-4333-8333-333333333333', 'USD', 'closed')
        RETURNING currency;
      `
      expect(validUsd[0]!.currency).toBe('USD')
    })

    it('refuses lowercase letters ("usd")', async () => {
      await expect(sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, '44444444-4444-4444-8444-444444444444', 'usd', 'closed')
      `).rejects.toThrow(/pos_sessions_currency_check/)
    })

    it('refuses strings that are not 3 letters ("DOLLAR", "US")', async () => {
      await expect(sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, '55555555-5555-4555-8555-555555555555', 'DOLLAR', 'closed')
      `).rejects.toThrow(/pos_sessions_currency_check/)

      await expect(sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, '66666666-6666-4666-8666-666666666666', 'US', 'closed')
      `).rejects.toThrow(/pos_sessions_currency_check/)
    })
  })

  describe('unique index pos_sessions_one_open per currency', () => {
    const PERSON = '77777777-7777-4777-8777-777777777777'

    it('allows the same person to have open tills of DIFFERENT currencies', async () => {
      const afn = await sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, ${PERSON}, 'AFN', 'open')
        RETURNING id, currency;
      `
      expect(afn).toHaveLength(1)
      expect(afn[0]!.currency).toBe('AFN')

      const usd = await sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, ${PERSON}, 'USD', 'open')
        RETURNING id, currency;
      `
      expect(usd).toHaveLength(1)
      expect(usd[0]!.currency).toBe('USD')
    })

    it('refuses a second open till of the SAME currency for the same person', async () => {
      await expect(sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, ${PERSON}, 'USD', 'open')
      `).rejects.toThrow(/pos_sessions_one_open/)
    })

    it('refuses a second open till with NULL currency when one is already open', async () => {
      // USER already has an open till with currency NULL inserted in beforeAll
      await expect(sql`
        INSERT INTO pos_sessions (workspace_id, opened_by, currency, status)
        VALUES (${WS}, ${USER}, NULL, 'open')
      `).rejects.toThrow(/pos_sessions_one_open/)
    })
  })
})
