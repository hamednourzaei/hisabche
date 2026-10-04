// ============================================
// docs/report-dashboards-01-migration.sql run unchanged (twice) in a real
// Postgres with Supabase's default privileges, then its VERIFY — plus the
// rules the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 54100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-rd-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/rd`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const REPORT = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('rd')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('report-dashboards-01-migration.sql'))
  await setup.unsafe(read('report-dashboards-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE report_dashboards`
})

const tile = (position: number) => ({ reportId: REPORT, position, span: 1 })
const dashboard = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO report_dashboards ${sql({
    workspace_id: WS,
    created_by: USER,
    name: 'مرور ماهانه',
    tiles: sql.json([tile(0)]),
    ...fields,
  })} RETURNING id`

describe('report-dashboards-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-report-dashboards-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(5)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a dashboard has between one and six tiles, and tiles is a list', async () => {
    await expect(dashboard({ tiles: sql.json([]) })).rejects.toThrow(/tiles/)
    await expect(
      dashboard({ tiles: sql.json(Array.from({ length: 7 }, (_, index) => tile(index))) }),
    ).rejects.toThrow(/tiles/)
    await expect(dashboard({ tiles: sql.json({ reportId: REPORT }) })).rejects.toThrow(/tiles/)
    await expect(
      dashboard({ tiles: sql.json(Array.from({ length: 6 }, (_, index) => tile(index))) }),
    ).resolves.toBeDefined()
  })

  it('one ACTIVE dashboard per name per business; a retired one frees the name', async () => {
    await dashboard()
    await expect(dashboard({ name: ' مرور ماهانه ' })).rejects.toThrow(
      'report_dashboards_active_name',
    )
    await expect(dashboard({ workspace_id: OTHER })).resolves.toBeDefined()
    await sql`UPDATE report_dashboards SET is_active = false WHERE workspace_id = ${WS}`
    await expect(dashboard()).resolves.toBeDefined()
  })

  it('the backend role cannot delete; a browser role sees nothing', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`
        await tx`DELETE FROM report_dashboards`
      }),
    ).rejects.toThrow(/permission denied/)
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM report_dashboards`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
