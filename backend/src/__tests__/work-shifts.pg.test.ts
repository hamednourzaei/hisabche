// ============================================
// docs/work-shifts-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-work-shifts-01.sql — plus the rules only the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 58000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-shift-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/shift`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('shift')
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
  await setup.unsafe(read('work-shifts-01-migration.sql'))
  await setup.unsafe(read('work-shifts-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE work_shifts`
})

const add = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO work_shifts ${sql({
    workspace_id: WS,
    created_by: USER,
    name: 'صبح',
    starts_at: '08:00',
    ends_at: '16:00',
    break_minutes: 30,
    ...fields,
  })}`

describe('work-shifts-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-work-shifts-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(6)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a shift that ends before it starts, or at the same minute, is refused', async () => {
    // Both rules are broken by such a shift; the database names whichever it checks first.
    const refused = /work_shifts_(ends_after_start|break_shorter_than_shift)/
    await expect(add({ starts_at: '22:00', ends_at: '06:00' })).rejects.toThrow(refused)
    await expect(add({ starts_at: '08:00', ends_at: '08:00' })).rejects.toThrow(refused)
    const [count] = await sql`SELECT COUNT(*)::int AS c FROM work_shifts`
    expect(count!.c).toBe(0)
  })

  it('a break as long as the shift, or negative, is refused', async () => {
    await expect(add({ break_minutes: 480 })).rejects.toThrow(
      'work_shifts_break_shorter_than_shift',
    )
    await expect(add({ break_minutes: -1 })).rejects.toThrow(/break_minutes/)
    await expect(add({ break_minutes: 479 })).resolves.toBeDefined()
  })

  it('one ACTIVE shift per name per workspace — a retired one frees the name', async () => {
    await add()
    await expect(add({ name: '  صبح ' })).rejects.toThrow('work_shifts_active_name')
    await expect(add({ workspace_id: OTHER })).resolves.toBeDefined()
    await sql`UPDATE work_shifts SET is_active = false WHERE workspace_id = ${WS}`
    await expect(add()).resolves.toBeDefined()
  })

  it('two people saving the same name at once leave exactly one', async () => {
    const settled = await Promise.allSettled([
      add({ name: 'عصر' }),
      add({ name: 'عصر' }),
      add({ name: 'عصر' }),
    ])
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    for (const result of settled) {
      if (result.status === 'rejected')
        expect(String(result.reason)).toContain('work_shifts_active_name')
    }
  })

  it('a browser role cannot read shifts', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM work_shifts`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
