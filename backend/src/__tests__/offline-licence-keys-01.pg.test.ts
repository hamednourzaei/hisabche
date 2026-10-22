// ============================================
// offline-licence-keys-01 on real Postgres, run TWICE: only the backend can
// read the signing key, there is one active key, and a key is permanent.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-licence-keys-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/licencekeys`
let sql: postgres.Sql

const migrationSql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'offline-licence-keys-01-migration.sql'),
  'utf8',
)
const verifySql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-offline-licence-keys-01.sql'),
  'utf8',
)

const HEX_A = 'a'.repeat(64)
const HEX_B = 'b'.repeat(64)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('licencekeys')
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
  await setup.unsafe(migrationSql)
  await setup.unsafe(migrationSql)
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  await pg.stop()
})

async function asRole<T>(
  role: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`)
    return fn(tx)
  }) as Promise<T>
}

describe('offline-licence-keys-01', () => {
  it('lets the backend store and read a key', async () => {
    await asRole(
      'service_role',
      (tx) =>
        tx`INSERT INTO offline_license_signing_keys (key_id, private_key_hex, public_key_hex) VALUES ('k1', ${HEX_A}, ${HEX_B})`,
    )
    const rows = await asRole(
      'service_role',
      (tx) => tx`SELECT key_id FROM offline_license_signing_keys`,
    )
    expect(rows.map((r) => r.key_id)).toEqual(['k1'])
  })

  it('hides the table from anon and authenticated', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(
        asRole(role, (tx) => tx`SELECT private_key_hex FROM offline_license_signing_keys`),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('allows only one active key', async () => {
    await expect(
      asRole(
        'service_role',
        (tx) =>
          tx`INSERT INTO offline_license_signing_keys (key_id, private_key_hex, public_key_hex) VALUES ('k2', ${HEX_A}, ${HEX_B})`,
      ),
    ).rejects.toThrow(/offline_license_signing_keys_one_active/)
  })

  it('never deletes or rewrites a key; retiring is the only change', async () => {
    await expect(
      asRole('service_role', (tx) => tx`DELETE FROM offline_license_signing_keys`),
    ).rejects.toThrow(/permission denied/)
    await expect(sql`DELETE FROM offline_license_signing_keys`).rejects.toThrow(
      /OFFLINE_SIGNING_KEY_PERMANENT/,
    )
    await expect(
      sql`UPDATE offline_license_signing_keys SET private_key_hex = ${HEX_B}`,
    ).rejects.toThrow(/OFFLINE_SIGNING_KEY_PERMANENT/)
    await asRole(
      'service_role',
      (tx) => tx`UPDATE offline_license_signing_keys SET retired_at = now()`,
    )
    await expect(
      asRole('service_role', (tx) => tx`UPDATE offline_license_signing_keys SET retired_at = NULL`),
    ).rejects.toThrow(/OFFLINE_SIGNING_KEY_PERMANENT/)
  })

  it('rejects a malformed key', async () => {
    await expect(
      sql`INSERT INTO offline_license_signing_keys (key_id, private_key_hex, public_key_hex) VALUES ('bad', 'xyz', ${HEX_B})`,
    ).rejects.toThrow(/check constraint/)
  })

  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(verifySql)
    expect(rows.length).toBe(7)
    expect(rows.filter((r) => r.ok !== true)).toEqual([])
  })
})
