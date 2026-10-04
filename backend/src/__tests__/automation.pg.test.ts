// ============================================
// Automation — docs/automation-01-migration.sql run unchanged (twice) in a real
// Postgres, then docs/VERIFY-automation-01.sql on the result.
//
// What only a database can prove here: that two simultaneous successes for one
// (arrangement, day) are ONE row, that a failed and a skipped row for the same
// day are still allowed beside it, and that a browser role can read none of it.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 55000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-auto-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/auto`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
let automationId: string

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('auto')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- The job runtime the verification script checks for.
    CREATE FUNCTION claim_scheduled_run(p_task text, p_slot text, p_holder text, p_lease_seconds integer)
      RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`)
  await setup.unsafe(read('automation-01-migration.sql'))
  await setup.unsafe(read('automation-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE automation_runs, automations`
  const [row] = await sql`
    INSERT INTO automations (workspace_id, name, action_type, cadence, created_by)
    VALUES (${WS}, 'rent', 'recurring_invoice',
            ${sql.json({ kind: 'monthly', dayOfMonth: 1, from: '2026-01-01' })}, ${USER})
    RETURNING id, enabled, on_failure, max_attempts, attempts`
  automationId = row!.id
  // The defaults a row gets when nobody says otherwise.
  expect(row).toMatchObject({ enabled: true, on_failure: 'stop', max_attempts: 3, attempts: 0 })
})

const run = (outcome: string, slot = '2026-10-01') => sql`
  INSERT INTO automation_runs (workspace_id, automation_id, slot, outcome, detail)
  VALUES (${WS}, ${automationId}, ${slot}, ${outcome}, 'x')`

describe('automation_runs', () => {
  it('allows ONE success per (arrangement, day), however many arrive at once', async () => {
    const settled = await Promise.allSettled([1, 2, 3, 4, 5].map(() => run('ran')))
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1)
    const failed = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[]
    expect(failed).toHaveLength(4)
    expect(failed.every((f) => f.reason.code === '23505')).toBe(true)
  })

  it('a failure and a skip for the same day sit beside the success, and another day is free', async () => {
    await run('failed')
    await run('failed')
    await run('skipped')
    await run('ran')
    await run('ran', '2026-11-01')
    expect(await sql`SELECT 1 FROM automation_runs`).toHaveLength(5)
  })

  it('refuses an outcome and a failure policy outside their closed sets', async () => {
    await expect(run('done')).rejects.toThrow()
    await expect(
      sql`UPDATE automations SET on_failure = 'retry-forever' WHERE id = ${automationId}`,
    ).rejects.toThrow()
    await expect(
      sql`UPDATE automations SET name = '   ' WHERE id = ${automationId}`,
    ).rejects.toThrow()
  })

  it('removing an arrangement row takes its history with it (and archiving does not)', async () => {
    await run('ran')
    await sql`UPDATE automations SET archived_at = now() WHERE id = ${automationId}`
    expect(await sql`SELECT 1 FROM automation_runs`).toHaveLength(1)
    await sql`DELETE FROM automations WHERE id = ${automationId}`
    expect(await sql`SELECT 1 FROM automation_runs`).toHaveLength(0)
  })
})

describe('the schema as a client sees it', () => {
  it.each(['anon', 'authenticated'])('%s can read neither table', async (role) => {
    await run('ran')
    for (const table of ['automations', 'automation_runs']) {
      await expect(
        sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE ${role}`)
          return tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('docs/VERIFY-automation-01.sql runs and every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-automation-01.sql'))
    expect(rows.length).toBe(12)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check)).toEqual([])
  })
})
