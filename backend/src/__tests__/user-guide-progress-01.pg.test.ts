// ============================================
// docs/user-guide-progress-01-migration.sql run unchanged (twice) on real
// Postgres with Supabase's default privileges, then VERIFY; append-only for
// the backend, nothing for anon / authenticated.
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
  databaseDir: pgTempDir('hisabche-pg-guide-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/guide`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const U = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('guide')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)
  await setup.unsafe(read('user-guide-progress-01-migration.sql'))
  await setup.unsafe(read('user-guide-progress-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('user-guide-progress-01', () => {
  it('VERIFY is all true', async () => {
    const [row] = await sql.unsafe(read('VERIFY-user-guide-progress-01.sql'))
    expect(row).toMatchObject({
      table_exists: true,
      rls_on: true,
      locked_down: true,
      service_append_only: true,
      ok: true,
    })
  })

  it('a step is recorded once; a repeat keeps the first time', async () => {
    await sql`INSERT INTO user_guide_progress (user_id, step_id, route_id) VALUES (${U}, 'invoices-list', 'invoices')`
    await sql`INSERT INTO user_guide_progress (user_id, step_id, route_id) VALUES (${U}, 'invoices-list', 'invoices') ON CONFLICT DO NOTHING`
    const rows = await sql`SELECT count(*)::int AS n FROM user_guide_progress WHERE user_id = ${U}`
    expect(rows[0]?.n).toBe(1)
  })

  it('refuses an empty step id', async () => {
    await expect(
      sql`INSERT INTO user_guide_progress (user_id, step_id, route_id) VALUES (${U}, '', 'x')`,
    ).rejects.toThrow()
  })
})
