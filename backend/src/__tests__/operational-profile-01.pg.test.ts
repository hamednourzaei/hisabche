// ============================================
// docs/operational-profile-01-migration.sql run unchanged (twice) in a real
// Postgres with Supabase's default privileges, then its VERIFY — plus the rules
// the writer exists for: one version per change, a replay writes nothing, a
// stale version is refused BY NAME, and the history cannot be edited.
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
  databaseDir: pgTempDir('hisabche-pg-opdna-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/opdna`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '22222222-2222-4222-8222-222222222222'
const ACTOR = '11111111-1111-4111-8111-111111111111'
const NAIL = {
  version: 1,
  offering: ['TIME_SERVICE', 'PHYSICAL_GOODS'],
  intake: ['APPOINTMENT_BOOKING'],
}
const SALON = { ...NAIL, workforce: ['COMMISSION_PROVIDERS'] }

const save = (dna: object, expected: number) =>
  sql`SELECT public.workspace_set_operational_dna(
        ${WS}::uuid, ${ACTOR}::uuid, ${JSON.stringify(dna)}::text::jsonb, ${expected}) AS r`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('opdna')
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
    CREATE TABLE workspaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
    INSERT INTO workspaces (id, name) VALUES ('${WS}', 'نمونه');
  `)
  // Twice: the file must be safe to re-run.
  await setup.unsafe(read('operational-profile-01-migration.sql'))
  await setup.unsafe(read('operational-profile-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('operational-profile-01', () => {
  it('first save is version 1, with one history row', async () => {
    const [row] = await save(NAIL, 0)
    expect(row?.r).toEqual({ version: 1, replayed: false })
    const [h] = await sql`SELECT count(*)::int AS n FROM workspace_operational_dna_history`
    expect(h?.n).toBe(1)
  })

  it('the same DNA again is a replay: no new version, no new history', async () => {
    const [row] = await save(NAIL, 0)
    expect(row?.r).toEqual({ version: 1, replayed: true })
    const [h] = await sql`SELECT count(*)::int AS n FROM workspace_operational_dna_history`
    expect(h?.n).toBe(1)
  })

  it('a save on a stale version is refused by name and changes nothing', async () => {
    await expect(save(SALON, 0)).rejects.toThrow('OPERATIONAL_PROFILE_CHANGED')
    const [w] = await sql`SELECT operational_dna_version AS v FROM workspaces WHERE id = ${WS}`
    expect(w?.v).toBe(1)
  })

  it('two saves from the same version at once: exactly one wins', async () => {
    const results = await Promise.allSettled([
      save(SALON, 1),
      save({ ...SALON, topology: ['MULTI_BRANCH'] }, 1),
    ])
    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(String((failed[0] as PromiseRejectedResult).reason)).toContain(
      'OPERATIONAL_PROFILE_CHANGED',
    )
    const [w] = await sql`SELECT operational_dna_version AS v FROM workspaces WHERE id = ${WS}`
    expect(w?.v).toBe(2)
  })

  it('the history cannot be edited or deleted', async () => {
    await expect(sql`UPDATE workspace_operational_dna_history SET version = 9`).rejects.toThrow(
      'OPERATIONAL_DNA_HISTORY_IS_APPEND_ONLY',
    )
    await expect(sql`DELETE FROM workspace_operational_dna_history`).rejects.toThrow(
      'OPERATIONAL_DNA_HISTORY_IS_APPEND_ONLY',
    )
  })

  it('every VERIFY block answers ok', async () => {
    const blocks = read('VERIFY-operational-profile-01.sql')
      .split(/\n\s*\n/)
      .map((b) => b.replace(/^\s*--.*$/gm, '').trim())
      .filter((b) => b.toUpperCase().startsWith('SELECT'))
    expect(blocks.length).toBe(6)
    for (const block of blocks) {
      const [row] = await sql.unsafe(block)
      expect(row?.ok, block).toBe(true)
    }
  })
})
