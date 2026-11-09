// ============================================
// docs/user-dashboard-kpis-01-migration.sql run twice on real Postgres with
// Supabase's default privileges, then VERIFY: one row per (person, workspace),
// at most 4 KPIs, nothing for anon / authenticated, no DELETE for the backend.
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
  databaseDir: pgTempDir('hisabche-pg-dashkpi-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dashkpi`
let sql: postgres.Sql
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const U = '11111111-1111-4111-8111-111111111111'
const W = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dashkpi')
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
  await setup.unsafe(read('user-dashboard-kpis-01-migration.sql'))
  await setup.unsafe(read('user-dashboard-kpis-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('user-dashboard-kpis-01', () => {
  it('VERIFY is all true', async () => {
    const rows = await sql.unsafe(read('VERIFY-user-dashboard-kpis-01.sql'))
    expect(rows.length).toBe(5)
    expect(rows.every((row) => row.ok === true)).toBe(true)
  })

  it('one row per person and workspace; an upsert replaces the list', async () => {
    await sql`INSERT INTO user_dashboard_kpis (user_id, workspace_id, kpis) VALUES (${U}, ${W}, ${['sales.total']})`
    await sql`INSERT INTO user_dashboard_kpis (user_id, workspace_id, kpis) VALUES (${U}, ${W}, ${['customers.count', 'products.count']})
              ON CONFLICT (user_id, workspace_id) DO UPDATE SET kpis = EXCLUDED.kpis`
    const rows = await sql`SELECT kpis FROM user_dashboard_kpis WHERE user_id = ${U}`
    expect(rows.length).toBe(1)
    expect(rows[0]?.kpis).toEqual(['customers.count', 'products.count'])
  })

  it('refuses a fifth KPI', async () => {
    await expect(
      sql`INSERT INTO user_dashboard_kpis (user_id, workspace_id, kpis)
          VALUES (${W}, ${W}, ${['a', 'b', 'c', 'd', 'e']})`,
    ).rejects.toThrow(/user_dashboard_kpis_shape/)
  })
})
