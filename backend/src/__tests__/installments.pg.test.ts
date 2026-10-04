// ============================================
// docs/installments-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-installments-01.sql — plus the rules only the database can
// hold: the parts add up to what the invoice still owes, the plan is replaced
// as one unit, and another workspace's invoice cannot be planned.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 54000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-inst-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/inst`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const INV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const THEIRS = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('inst')
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
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    -- The two tables the migration builds on, with the columns it reads.
    CREATE TABLE invoices (
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, type text NOT NULL, total numeric NOT NULL
    );
    CREATE TABLE payment_allocations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL, amount numeric NOT NULL
    );`)
  await setup.unsafe(read('installments-01-migration.sql'))
  await setup.unsafe(read('installments-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE invoice_installments, payment_allocations, invoices CASCADE`
  await sql`INSERT INTO invoices (id, workspace_id, type, total) VALUES
    (${INV}, ${WS}, 'sale', 1000.00), (${THEIRS}, ${OTHER}, 'sale', 1000.00)`
})

const lines = (...amounts: number[]) =>
  JSON.stringify(
    amounts.map((amount_minor, index) => ({
      seq: index + 1,
      due_date: new Date(Date.UTC(2026, 9 + index, 1)).toISOString().slice(0, 10),
      amount_minor,
    })),
  )
const save = (invoice: string, body: string, workspace = WS) =>
  sql`SELECT installments_save(${workspace}, ${USER}, ${invoice}, ${body}::text::jsonb) AS n`

describe('installments-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-installments-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(8)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('saves a plan whose parts add up to what is owed', async () => {
    const [row] = await save(INV, lines(33_334, 33_333, 33_333))
    expect(row!.n).toBe(3)
    const [sum] =
      await sql`SELECT SUM(amount_minor)::int AS s FROM invoice_installments WHERE invoice_id = ${INV}`
    expect(sum!.s).toBe(100_000)
  })

  it('what is owed is the total LESS what was already paid', async () => {
    await sql`INSERT INTO payment_allocations (invoice_id, amount) VALUES (${INV}, 400.00)`
    await expect(save(INV, lines(50_000, 50_000))).rejects.toThrow('INSTALLMENT_SUM_MISMATCH')
    await expect(save(INV, lines(30_000, 30_000))).resolves.toBeDefined()
  })

  it('refuses a plan that does not foot — and leaves the old plan in place', async () => {
    await save(INV, lines(50_000, 50_000))
    await expect(save(INV, lines(50_000, 49_999))).rejects.toThrow('INSTALLMENT_SUM_MISMATCH')
    const kept =
      await sql`SELECT amount_minor::int AS a FROM invoice_installments WHERE invoice_id = ${INV} ORDER BY seq`
    expect(kept.map((row) => row.a)).toEqual([50_000, 50_000])
  })

  it('a new plan REPLACES the old one; an empty one removes it', async () => {
    await save(INV, lines(50_000, 50_000))
    await save(INV, lines(25_000, 25_000, 25_000, 25_000))
    const [count] =
      await sql`SELECT COUNT(*)::int AS c FROM invoice_installments WHERE invoice_id = ${INV}`
    expect(count!.c).toBe(4)
    const [cleared] = await save(INV, '[]')
    expect(cleared!.n).toBe(0)
    const [after] =
      await sql`SELECT COUNT(*)::int AS c FROM invoice_installments WHERE invoice_id = ${INV}`
    expect(after!.c).toBe(0)
  })

  it('a single payment is not a plan, and a fully paid invoice has nothing to plan', async () => {
    await expect(save(INV, lines(100_000))).rejects.toThrow('INSTALLMENT_COUNT_INVALID')
    await sql`INSERT INTO payment_allocations (invoice_id, amount) VALUES (${INV}, 1000.00)`
    await expect(save(INV, lines(1, 1))).rejects.toThrow('INSTALLMENT_NOTHING_OWED')
  })

  it('another workspace’s invoice is «not found», and nothing is written', async () => {
    await expect(save(THEIRS, lines(50_000, 50_000))).rejects.toThrow(
      'INSTALLMENT_INVOICE_NOT_FOUND',
    )
    const [count] = await sql`SELECT COUNT(*)::int AS c FROM invoice_installments`
    expect(count!.c).toBe(0)
  })

  it('two plans saved at once leave exactly one whole plan', async () => {
    await Promise.allSettled([
      save(INV, lines(50_000, 50_000)),
      save(INV, lines(25_000, 25_000, 25_000, 25_000)),
    ])
    const rows =
      await sql`SELECT seq, amount_minor::int AS a FROM invoice_installments WHERE invoice_id = ${INV} ORDER BY seq`
    expect([2, 4]).toContain(rows.length)
    expect(rows.reduce((sum, row) => sum + row.a, 0)).toBe(100_000)
  })

  it('a browser role can neither read the table nor call the function', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM invoice_installments`
      }),
    ).rejects.toThrow(/permission denied/)
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE anon`
        await tx`SELECT installments_save(${WS}, ${USER}, ${INV}, '[]'::jsonb)`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
