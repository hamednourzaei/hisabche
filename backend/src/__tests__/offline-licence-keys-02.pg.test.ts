// ============================================
// offline-licence-keys-02 rev2 on real Postgres. The private signing key stays
// in the database and can never be cleared (owner decision, 9 Nov 2026).
// Applied after 01 and after rev1's shape (nullable column, «clear only»
// guard), the way the live database has it — then TWICE.
// ⚠️ Cannot run on the owner's machine since 31 Oct 2026 (embedded-postgres
// binaries removed by Defender) — runs in CI.
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
  databaseDir: pgTempDir('hisabche-pg-licence-keys-02-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/licencekeys2`
let sql: postgres.Sql

const docs = join(__dirname, '..', '..', '..', 'docs')
const migration01 = readFileSync(join(docs, 'offline-licence-keys-01-migration.sql'), 'utf8')
const migration02 = readFileSync(join(docs, 'offline-licence-keys-02-migration.sql'), 'utf8')
const verify02 = readFileSync(join(docs, 'VERIFY-offline-licence-keys-02.sql'), 'utf8')

const HEX_A = 'a'.repeat(64)
const HEX_B = 'b'.repeat(64)

/** What rev1 left on the live database: nullable column, «clear only» guard. */
const REV1_SHAPE = `
  ALTER TABLE public.offline_license_signing_keys ALTER COLUMN private_key_hex DROP NOT NULL;
  CREATE OR REPLACE FUNCTION public.offline_license_signing_keys_guard()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT'; END IF;
    IF NEW.private_key_hex IS DISTINCT FROM OLD.private_key_hex
       AND NEW.private_key_hex IS NOT NULL THEN
      RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
    END IF;
    RETURN NEW;
  END $$;
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('licencekeys2')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  `)
  await setup.unsafe(migration01)
  await setup.unsafe(REV1_SHAPE)
  await setup`INSERT INTO offline_license_signing_keys (key_id, private_key_hex, public_key_hex) VALUES ('k1', ${HEX_A}, ${HEX_B})`
  await setup.unsafe(migration02)
  await setup.unsafe(migration02)
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  await pg.stop()
})

describe('offline-licence-keys-02 rev2', () => {
  it('refuses clearing the private half', async () => {
    await expect(
      sql`UPDATE offline_license_signing_keys SET private_key_hex = NULL WHERE key_id = 'k1'`,
    ).rejects.toThrow(/OFFLINE_SIGNING_KEY_PERMANENT|null value/)
    const [row] = await sql`SELECT private_key_hex FROM offline_license_signing_keys`
    expect(row?.private_key_hex).toBe(HEX_A)
  })

  it('refuses replacing the private half', async () => {
    await expect(
      sql`UPDATE offline_license_signing_keys SET private_key_hex = ${HEX_B}`,
    ).rejects.toThrow(/OFFLINE_SIGNING_KEY_PERMANENT/)
  })

  it('still refuses DELETE and public-key changes', async () => {
    await expect(sql`DELETE FROM offline_license_signing_keys`).rejects.toThrow(
      /OFFLINE_SIGNING_KEY_PERMANENT/,
    )
    await expect(
      sql`UPDATE offline_license_signing_keys SET public_key_hex = ${HEX_A}`,
    ).rejects.toThrow(/OFFLINE_SIGNING_KEY_PERMANENT/)
  })

  it('refuses to run on a database where a key was already cleared', async () => {
    const probe = postgres(url, { max: 1, onnotice: () => {} })
    try {
      await expect(
        probe.begin(async (tx) => {
          await tx.unsafe(REV1_SHAPE)
          await tx`UPDATE offline_license_signing_keys SET private_key_hex = NULL`
          await tx.unsafe(migration02.replace(/\bBEGIN;|\bCOMMIT;/g, ''))
        }),
      ).rejects.toThrow(/OFFLINE_SIGNING_KEY_CLEARED/)
    } finally {
      await probe.end()
    }
    const [row] = await sql`SELECT private_key_hex FROM offline_license_signing_keys`
    expect(row?.private_key_hex).toBe(HEX_A)
  })

  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(verify02)
    expect(rows.length).toBe(8)
    expect(rows.filter((r) => r.ok !== true)).toEqual([])
  })
})
