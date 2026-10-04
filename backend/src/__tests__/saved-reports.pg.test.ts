// ============================================
// docs/saved-reports-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-saved-reports-01.sql — plus the rules only the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 61000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-rep-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/rep`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('rep')
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
  await setup.unsafe(read('saved-reports-01-migration.sql'))
  await setup.unsafe(read('saved-reports-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE saved_reports`
})

const save = (name: string, workspace = WS, definition = '{"dataset":"invoices"}') => sql`
  INSERT INTO saved_reports (workspace_id, name, definition, created_by)
  VALUES (${workspace}, ${name}, ${definition}::text::jsonb, ${USER})`

describe('saved-reports-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-saved-reports-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(5)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('one ACTIVE report per name per workspace, whatever the padding; retiring frees the name', async () => {
    await save('فروش ماهانه')
    await expect(save('  فروش ماهانه ')).rejects.toThrow('saved_reports_active_name')
    await expect(save('فروش ماهانه', OTHER)).resolves.toBeDefined()
    await sql`UPDATE saved_reports SET is_active = false WHERE workspace_id = ${WS}`
    await expect(save('فروش ماهانه')).resolves.toBeDefined()
  })

  it('three people saving the same name at once leave exactly one', async () => {
    const settled = await Promise.allSettled([save('x'), save('x'), save('x')])
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const [count] = await sql`SELECT COUNT(*)::int AS c FROM saved_reports`
    expect(count!.c).toBe(1)
  })

  it('a definition that is not an object, and an empty name, are refused', async () => {
    await expect(save('a', WS, '[1]')).rejects.toThrow(/definition/)
    await expect(save('   ')).rejects.toThrow(/name/)
  })

  it('a browser role cannot read saved reports', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM saved_reports`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
