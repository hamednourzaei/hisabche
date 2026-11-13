// ============================================
// docs/expense-claims-migration.sql, run unchanged — TWICE — on a real Postgres
// carrying Supabase's default privileges, then its VERIFY, then every rule with
// the write it must refuse and the write it must allow.
//
// What can go wrong, and what each part is for:
//
//   · the migration is not idempotent — the second run fails on a table or index
//     that already exists, and the owner is left half-migrated;
//   · a claim gets a status no button can move, or an amount of 0;
//   · a line outlives the claim it belonged to, or belongs to no claim at all;
//   · every new Supabase table is born readable by `anon` and `authenticated`,
//     and `REVOKE ALL` never ran — one workspace's claims visible to a browser.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-expense-claims-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/expense_claims`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const EMP_A = 'eeeeeeee-0000-4000-8000-00000000000a'
const EMP_B = 'eeeeeeee-0000-4000-8000-00000000000b'

/** The message of the refusal, or 'ALLOWED' when the write went through. */
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}

async function newReport(
  options: { workspace?: string; employee?: string; status?: string; title?: string } = {},
): Promise<string> {
  const [row] = await sql`
    INSERT INTO public.expense_reports (workspace_id, employee_id, title, status)
    VALUES (
      ${options.workspace ?? WS_A},
      ${options.employee ?? EMP_A},
      ${options.title ?? 'Trip to Herat'},
      ${options.status ?? 'submitted'}
    )
    RETURNING id
  `
  return String((row as { id: string }).id)
}

async function newLine(reportId: string, amountMinor = 5000, currency = 'AFN') {
  const [row] = await sql`
    INSERT INTO public.expense_lines (workspace_id, report_id, category, amount_minor, currency)
    VALUES (${WS_A}, ${reportId}, 'travel', ${amountMinor}, ${currency})
    RETURNING id
  `
  return String((row as { id: string }).id)
}

const countOf = async (table: 'expense_reports' | 'expense_lines') => {
  const rows = await sql.unsafe(`SELECT count(*)::int AS n FROM public.${table}`)
  const first = rows[0] as unknown as { n: number } | undefined
  if (!first) throw new Error(`count of ${table} returned no row`)
  return first.n
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('expense_claims')
  sql = postgres(url, { max: 4, onnotice: () => {} })

  // Supabase as it really is: the three roles exist, and a table created in
  // `public` is born with ALL granted to anon and authenticated.
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)

  // ⚠️ Twice: a migration the owner has to paste into the SQL editor must
  // survive being run again after a lost response.
  const migration = read('expense-claims-migration.sql')
  await sql.unsafe(migration)
  await sql.unsafe(migration)
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end({ timeout: 2 })
  try {
    await pg.stop()
  } catch {
    // teardown only
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/expense-claims-migration.sql', () => {
  it('ran twice, and its VERIFY says ok on every row', async () => {
    const rows = (await sql.unsafe(read('VERIFY-expense-claims.sql'))) as Array<{
      check_name: string
      ok: boolean | null
    }>
    expect(rows.length).toBe(9)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check_name)).toEqual([])
  })

  it('accepts the five statuses the service gates on, and nothing else', async () => {
    for (const status of ['draft', 'submitted', 'approved', 'rejected', 'reimbursed']) {
      await newReport({ status, title: `status ${status}` })
    }
    expect(await countOf('expense_reports')).toBe(5)

    const refused = await refusal(() => newReport({ status: 'done', title: 'status done' }))
    expect(refused).not.toBe('ALLOWED')
    expect(refused).toContain('check constraint')
    expect(await countOf('expense_reports')).toBe(5)
  })

  it('refuses an amount of zero or less, and keeps a line of one minor unit', async () => {
    const reportId = await newReport({ title: 'amount rules' })

    for (const bad of [0, -5]) {
      const refused = await refusal(() => newLine(reportId, bad))
      expect(refused, `amount ${bad}`).not.toBe('ALLOWED')
      expect(refused).toContain('check constraint')
    }

    // One minor unit of AFN is the smallest real expense; it must survive.
    await newLine(reportId, 1)
    expect(await countOf('expense_lines')).toBe(1)
  })

  it('refuses a line whose claim does not exist', async () => {
    const before = await countOf('expense_lines')
    const refused = await refusal(() => newLine('99999999-9999-4999-8999-999999999999', 5000))
    expect(refused).not.toBe('ALLOWED')
    expect(refused).toContain('foreign key constraint')
    expect(await countOf('expense_lines')).toBe(before)
  })

  it('takes the lines with the claim when the claim is deleted', async () => {
    const reportId = await newReport({ title: 'cascade' })
    const before = await countOf('expense_lines')
    await newLine(reportId, 1500)
    await newLine(reportId, 2500, 'USD')
    expect(await countOf('expense_lines')).toBe(before + 2)

    await sql`DELETE FROM public.expense_reports WHERE id = ${reportId}`

    const left = await sql`
      SELECT count(*)::int AS n FROM public.expense_lines WHERE report_id = ${reportId}
    `
    expect(Number((left[0] as { n: number }).n)).toBe(0)
  })

  it('keeps two workspaces apart: the same claim shape is two rows, not one', async () => {
    const a = await newReport({ workspace: WS_A, title: 'same title' })
    const b = await newReport({ workspace: WS_B, employee: EMP_B, title: 'same title' })
    expect(a).not.toBe(b)

    const rows = await sql`
      SELECT workspace_id::text AS workspace_id
        FROM public.expense_reports
       WHERE title = 'same title'
       ORDER BY workspace_id
    `
    expect(rows.map((row) => (row as { workspace_id: string }).workspace_id)).toEqual([WS_A, WS_B])
  })
})
