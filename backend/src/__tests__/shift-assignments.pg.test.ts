// ============================================
// docs/shift-assignments-01-migration.sql run unchanged (twice) in a real
// Postgres, after work-shifts-01, with Supabase's default privileges — then its
// VERIFY, plus the rules only the database holds: the hours are the shift's,
// nobody is planned twice at once, and a plan is cancelled, never rewritten.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 53100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-sa-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/sa`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const ALI = '22222222-2222-4222-8222-222222222222'
const SARA = '33333333-3333-4333-8333-333333333333'

const ROLES = `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  END $$;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`

let morning: string
let evening: string
let midday: string
let theirs: string

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('sa')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(ROLES)
  // Without the shifts table the script stops and says which script to run.
  await expect(setup.unsafe(read('shift-assignments-01-migration.sql'))).rejects.toThrow(
    'work-shifts-01-migration.sql first',
  )
  await setup.unsafe(read('work-shifts-01-migration.sql'))
  await setup.unsafe(read('shift-assignments-01-migration.sql'))
  await setup.unsafe(read('shift-assignments-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const shift = async (workspace: string, name: string, from: string, to: string) => {
  const [row] = await sql`
    INSERT INTO work_shifts (workspace_id, name, starts_at, ends_at, created_by)
    VALUES (${workspace}, ${name}, ${from}, ${to}, ${USER}) RETURNING id`
  return row!.id as string
}

beforeEach(async () => {
  // Emptied as the table owner, with the guard set aside for the cleanup only.
  await sql`ALTER TABLE shift_assignments DISABLE TRIGGER shift_assignments_guard_trg`
  await sql`DELETE FROM shift_assignments`
  await sql`ALTER TABLE shift_assignments ENABLE TRIGGER shift_assignments_guard_trg`
  await sql`DELETE FROM work_shifts`
  morning = await shift(WS, 'صبح', '08:00', '14:00')
  evening = await shift(WS, 'عصر', '14:00', '20:00')
  midday = await shift(WS, 'میان‌روز', '12:00', '16:00')
  theirs = await shift(OTHER, 'صبح', '08:00', '14:00')
})

const assign = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO shift_assignments ${sql({
    workspace_id: WS,
    employee_id: ALI,
    shift_id: morning,
    work_date: '2026-10-05',
    shift_name: 'whatever the caller sent',
    starts_at: '00:00',
    ends_at: '23:59',
    assigned_by: USER,
    ...fields,
  })} RETURNING id, shift_name, starts_at::text AS starts_at, ends_at::text AS ends_at`

describe('shift-assignments-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-shift-assignments-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(8)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('the hours and the name are the SHIFT’s, whatever was sent', async () => {
    const [row] = await assign()
    expect(row).toMatchObject({ shift_name: 'صبح', starts_at: '08:00:00', ends_at: '14:00:00' })
  })

  it('a shift of another business, and a retired shift, cannot be assigned', async () => {
    await expect(assign({ shift_id: theirs })).rejects.toThrow('SHIFT_ASSIGNMENT_SHIFT_NOT_FOUND')
    await sql`UPDATE work_shifts SET is_active = false WHERE id = ${morning}`
    await expect(assign()).rejects.toThrow('SHIFT_ASSIGNMENT_SHIFT_RETIRED')
  })

  it('one person is not planned for two overlapping shifts on one day', async () => {
    await assign()
    // The same shift again, and one that starts before the first ends.
    await expect(assign()).rejects.toThrow('SHIFT_ASSIGNMENT_OVERLAP')
    await expect(assign({ shift_id: midday })).rejects.toThrow('SHIFT_ASSIGNMENT_OVERLAP')
    // Back to back is not an overlap; another day and another person are free.
    await expect(assign({ shift_id: evening })).resolves.toBeDefined()
    await expect(assign({ work_date: '2026-10-06' })).resolves.toBeDefined()
    await expect(assign({ employee_id: SARA })).resolves.toBeDefined()
  })

  it('two managers planning the same person at once: one row, and the loser is told why', async () => {
    const results = await Promise.allSettled([assign(), assign({ shift_id: midday })])
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(String(failed[0]!.reason)).toContain('SHIFT_ASSIGNMENT_OVERLAP')
    const [total] = await sql`SELECT count(*)::int AS count FROM shift_assignments`
    expect(total!.count).toBe(1)
  })

  it('a cancelled assignment frees the time; the row stays', async () => {
    const [row] = await assign()
    await sql`
      UPDATE shift_assignments
         SET is_cancelled = true, cancelled_by = ${USER}, cancelled_at = now()
       WHERE id = ${row!.id}`
    await expect(assign({ shift_id: midday })).resolves.toBeDefined()
    const [total] = await sql`SELECT count(*)::int AS count FROM shift_assignments`
    expect(total!.count).toBe(2)
  })

  it('an assignment is cancelled once and never otherwise changed or deleted', async () => {
    const [row] = await assign()
    await expect(
      sql`UPDATE shift_assignments SET work_date = '2026-10-09' WHERE id = ${row!.id}`,
    ).rejects.toThrow('SHIFT_ASSIGNMENT_IMMUTABLE')
    await expect(
      sql`UPDATE shift_assignments SET is_cancelled = true WHERE id = ${row!.id}`,
    ).rejects.toThrow('shift_assignments_cancel_is_whole')
    await expect(sql`DELETE FROM shift_assignments WHERE id = ${row!.id}`).rejects.toThrow(
      'SHIFT_ASSIGNMENT_IMMUTABLE',
    )
    await sql`
      UPDATE shift_assignments
         SET is_cancelled = true, cancelled_by = ${USER}, cancelled_at = now()
       WHERE id = ${row!.id}`
    await expect(
      sql`UPDATE shift_assignments
             SET is_cancelled = false, cancelled_by = NULL, cancelled_at = NULL
           WHERE id = ${row!.id}`,
    ).rejects.toThrow('SHIFT_ASSIGNMENT_IMMUTABLE')
  })

  it('the backend role cannot delete; a browser role sees nothing', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`
        await tx`DELETE FROM shift_assignments`
      }),
    ).rejects.toThrow(/permission denied/)
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM shift_assignments`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
