// ============================================
// docs/late-fees-01-migration.sql run unchanged (twice) in a real Postgres,
// with Supabase's default privileges, then its VERIFY — plus the rules only
// the database holds: one assessment per period, and history that cannot be
// rewritten.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 52100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-lf-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/lf`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const INVOICE = '22222222-2222-4222-8222-222222222222'
const FEE_INVOICE = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('lf')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('late-fees-01-migration.sql'))
  await setup.unsafe(read('late-fees-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE late_fee_assessments, late_fee_policies`
})

const policy = (fields: Record<string, unknown>) =>
  sql`INSERT INTO late_fee_policies ${sql({ workspace_id: WS, updated_by: USER, ...fields })}`

const assessment = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO late_fee_assessments ${sql({
    workspace_id: WS,
    invoice_id: INVOICE,
    seq: 0,
    period_no: 1,
    due_date: '2026-08-01',
    days_late: 40,
    overdue_minor: 100_000,
    fee_minor: 5_000,
    currency: 'AFN',
    policy: sql.json({ basis: 'per_period' }),
    assessed_by: USER,
    ...fields,
  })} RETURNING id`

describe('late-fees-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-late-fees-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(11)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a policy is off unless it says otherwise', async () => {
    await policy({ basis: 'percentage', percent: 2 })
    const [row] = await sql`SELECT is_enabled, grace_days, max_share_percent FROM late_fee_policies`
    expect(row).toMatchObject({ is_enabled: false, grace_days: 0 })
    expect(Number(row!.max_share_percent)).toBe(100)
  })

  it('a fixed amount needs its currency; a percentage has neither', async () => {
    await expect(policy({ basis: 'per_period', amount_minor: 5_000 })).rejects.toThrow(
      'late_fee_policy_shape',
    )
    await expect(
      policy({ basis: 'percentage', percent: 2, amount_minor: 5_000, currency: 'AFN' }),
    ).rejects.toThrow('late_fee_policy_shape')
    await expect(policy({ basis: 'percentage', percent: 150 })).rejects.toThrow(/percent/)
    await expect(
      policy({ basis: 'per_period', amount_minor: 5_000, currency: 'AFN' }),
    ).resolves.toBeDefined()
  })

  it('one assessment per invoice, installment and period — the second is refused', async () => {
    await assessment()
    await expect(assessment()).rejects.toThrow('late_fee_assessments_once')
    await expect(assessment({ period_no: 2 })).resolves.toBeDefined()
    await expect(assessment({ seq: 1 })).resolves.toBeDefined()
  })

  it('two managers charging at once: exactly one row, and the loser is told why', async () => {
    const results = await Promise.allSettled([assessment(), assessment()])
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(String(failed[0]!.reason)).toContain('late_fee_assessments_once')
    const [total] = await sql`SELECT count(*)::int AS count FROM late_fee_assessments`
    expect(total!.count).toBe(1)
  })

  it('the fee invoice is filled in once; nothing else about an assessment changes', async () => {
    const [row] = await assessment()
    await expect(
      sql`UPDATE late_fee_assessments SET fee_minor = 1 WHERE id = ${row!.id}`,
    ).rejects.toThrow('LATE_FEE_ASSESSMENT_IMMUTABLE')
    await expect(
      sql`UPDATE late_fee_assessments SET fee_invoice_id = ${FEE_INVOICE}, fee_minor = 1 WHERE id = ${row!.id}`,
    ).rejects.toThrow('LATE_FEE_ASSESSMENT_IMMUTABLE')

    await sql`UPDATE late_fee_assessments SET fee_invoice_id = ${FEE_INVOICE} WHERE id = ${row!.id}`
    await expect(
      sql`UPDATE late_fee_assessments SET fee_invoice_id = ${INVOICE} WHERE id = ${row!.id}`,
    ).rejects.toThrow('LATE_FEE_ASSESSMENT_IMMUTABLE')
    await expect(sql`DELETE FROM late_fee_assessments WHERE id = ${row!.id}`).rejects.toThrow(
      'LATE_FEE_ASSESSMENT_IMMUTABLE',
    )
    const [after] =
      await sql`SELECT fee_minor::int AS fee, fee_invoice_id FROM late_fee_assessments`
    expect(after).toMatchObject({ fee: 5_000, fee_invoice_id: FEE_INVOICE })
  })

  it('a zero fee or zero days late is not an assessment', async () => {
    await expect(assessment({ fee_minor: 0 })).rejects.toThrow(/fee_minor/)
    await expect(assessment({ days_late: 0 })).rejects.toThrow(/days_late/)
  })

  it('the backend role cannot delete; a browser role sees nothing', async () => {
    for (const table of ['late_fee_policies', 'late_fee_assessments']) {
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`
          await tx.unsafe(`DELETE FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`
          await tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })
})
