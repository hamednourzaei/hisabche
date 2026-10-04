// ============================================
// docs/attendance-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-attendance-01.sql — and the case that matters most: a
// database that ALREADY has duplicates keeps every row and gets no index.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 55000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-att-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const EMP = '11111111-1111-4111-8111-111111111111'

// The table as the base schema + tenant-isolation-closure leave it.
const TABLE = `
  CREATE TABLE attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    check_in time without time zone,
    check_out time without time zone,
    status text,
    notes text,
    user_id uuid NOT NULL,
    workspace_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
  );`

async function database(name: string) {
  await pg.createDatabase(name)
  const sql = postgres(`postgres://postgres:test@localhost:${PORT}/${name}`, {
    max: 1,
    onnotice: () => {},
  })
  await sql.unsafe(TABLE)
  return sql
}
const mark = (sql: postgres.Sql, day: string, workspace: string | null = WS) =>
  sql`INSERT INTO attendance (employee_id, date, status, user_id, workspace_id)
      VALUES (${EMP}, ${day}, 'present', ${EMP}, ${workspace})`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
}, 240_000)

afterAll(async () => {
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('attendance-01', () => {
  it('on a clean table: runs twice, VERIFY is all ok, and a second record for the day is refused', async () => {
    const sql = await database('clean')
    await mark(sql, '2026-10-01')
    await sql.unsafe(read('attendance-01-migration.sql'))
    await sql.unsafe(read('attendance-01-migration.sql'))

    const rows = await sql.unsafe(read('VERIFY-attendance-01.sql'))
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])

    await expect(mark(sql, '2026-10-01')).rejects.toThrow(/attendance_one_per_employee_day/)
    // Another day is another record.
    await expect(mark(sql, '2026-10-02')).resolves.toBeDefined()
    await sql.end()
  })

  it('on a table with duplicates: deletes NOTHING, creates no index, and VERIFY says so', async () => {
    const sql = await database('dirty')
    await mark(sql, '2026-10-01')
    await mark(sql, '2026-10-01')
    await sql.unsafe(read('attendance-01-migration.sql'))

    const [count] = await sql`SELECT COUNT(*)::int AS c FROM attendance`
    expect(count!.c).toBe(2)
    const rows = await sql.unsafe(read('VERIFY-attendance-01.sql'))
    expect(
      rows
        .filter((row) => row.ok !== true)
        .map((row) => row.check)
        .sort(),
    ).toEqual([
      'no employee has two records for one day',
      'one record per employee per day (unique index)',
    ])
    await sql.end()
  })

  it('legacy rows with no workspace are left alone and do not block the index', async () => {
    const sql = await database('legacy')
    await mark(sql, '2026-10-01', null)
    await mark(sql, '2026-10-01', null)
    await sql.unsafe(read('attendance-01-migration.sql'))
    const [index] =
      await sql`SELECT COUNT(*)::int AS c FROM pg_indexes WHERE indexname = 'attendance_one_per_employee_day'`
    expect(index!.c).toBe(1)
    await sql.end()
  })
})
