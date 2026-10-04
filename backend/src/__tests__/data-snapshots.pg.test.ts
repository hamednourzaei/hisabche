// ============================================
// docs/data-snapshots-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-data-snapshots-01.sql — and the two rules only the database
// can hold: a marker is never changed, and never claims to be restorable.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 62000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-snap-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/snap`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('snap')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles. A migration that only GRANTs a narrower
    -- set, without revoking first, passes on a bare Postgres and fails there.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('data-snapshots-01-migration.sql'))
  await setup.unsafe(read('data-snapshots-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const take = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO data_snapshots ${sql({
    workspace_id: WS,
    taken_by: USER,
    label: 'پایان سال',
    kind: 'full',
    source_schema_version: '1.0.0',
    counts: sql.json({ invoices: 12 }),
    ...fields,
  })} RETURNING id`

describe('data-snapshots-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-data-snapshots-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(6)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a marker is stored, and can never claim to be restorable', async () => {
    await expect(take()).resolves.toHaveLength(1)
    await expect(take({ restorable: true })).rejects.toThrow(/restorable/)
  })

  it('an unknown kind, a version that is not a version, and counts that are not an object are refused', async () => {
    await expect(take({ kind: 'backup' })).rejects.toThrow(/kind/)
    await expect(take({ source_schema_version: 'latest' })).rejects.toThrow(/source_schema_version/)
    await expect(take({ counts: sql.json([1, 2]) })).rejects.toThrow(/counts/)
  })

  it('a marker cannot be changed or removed — by the table owner either', async () => {
    const [row] = await take()
    await expect(sql`UPDATE data_snapshots SET label = 'x' WHERE id = ${row!.id}`).rejects.toThrow(
      'DATA_SNAPSHOT_IMMUTABLE',
    )
    await expect(sql`DELETE FROM data_snapshots WHERE id = ${row!.id}`).rejects.toThrow(
      'DATA_SNAPSHOT_IMMUTABLE',
    )
  })

  it('a browser role cannot read markers', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM data_snapshots`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
