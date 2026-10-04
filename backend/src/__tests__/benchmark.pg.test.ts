// ============================================
// docs/benchmark-01-migration.sql run unchanged (twice) in a real Postgres with
// Supabase's default privileges, then its VERIFY — plus what the function
// counts: sales only, not cancelled, inside the window, never a sandbox, and
// never for a browser role.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 55100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-bm-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/bm`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SANDBOX = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('bm')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    -- The two tables the function reads, with the columns it reads.
    CREATE TABLE workspaces (id uuid PRIMARY KEY, name text, is_sandbox boolean NOT NULL DEFAULT false);
    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      type text NOT NULL,
      status text,
      date timestamptz NOT NULL
    );`)
  await setup.unsafe(read('benchmark-01-migration.sql'))
  await setup.unsafe(read('benchmark-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const invoice = (workspace: string, daysAgo: number, fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO invoices ${sql({
    workspace_id: workspace,
    type: 'sale',
    status: 'pending',
    date: new Date(Date.now() - daysAgo * 86_400_000),
    ...fields,
  })}`

beforeEach(async () => {
  await sql`TRUNCATE invoices, workspaces`
  await sql`INSERT INTO workspaces (id, name, is_sandbox) VALUES
    (${A}, 'a', false), (${B}, 'b', false), (${SANDBOX}, 'sandbox', true)`
})

const counts = async (days: number) => {
  const rows =
    await sql`SELECT workspace_id, sale_count::int AS n FROM benchmark_sale_counts(${days})`
  return Object.fromEntries(rows.map((row) => [row.workspace_id, row.n]))
}

describe('benchmark-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-benchmark-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(5)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('counts each business’s sales inside the window — and only those', async () => {
    await invoice(A, 1)
    await invoice(A, 10)
    await invoice(A, 29)
    await invoice(A, 45) // outside 30 days
    await invoice(A, 2, { type: 'purchase' })
    await invoice(A, 2, { status: 'cancelled' })
    await invoice(A, -3) // dated in the future
    await invoice(B, 5)
    expect(await counts(30)).toEqual({ [A]: 3, [B]: 1 })
    expect(await counts(60)).toEqual({ [A]: 4, [B]: 1 })
  })

  it('a sandbox business is never counted; a business with no sales is absent, not zero', async () => {
    await invoice(SANDBOX, 1)
    await invoice(SANDBOX, 2)
    await invoice(A, 1)
    expect(await counts(30)).toEqual({ [A]: 1 })
  })

  it('a sale with no status is still a sale', async () => {
    await invoice(A, 1, { status: null })
    expect(await counts(30)).toEqual({ [A]: 1 })
  })

  it('a nonsense window is clamped, not obeyed', async () => {
    await invoice(A, 400)
    await invoice(A, 0.2)
    expect(await counts(100_000)).toEqual({ [A]: 1 })
    expect(await counts(-5)).toEqual({ [A]: 1 })
  })

  it('a browser role cannot run it; the backend role can', async () => {
    for (const role of ['anon', 'authenticated']) {
      await expect(
        sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE ${role}`)
          await tx`SELECT * FROM benchmark_sale_counts(30)`
        }),
      ).rejects.toThrow(/permission denied/)
    }
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`
        return tx`SELECT * FROM benchmark_sale_counts(30)`
      }),
    ).resolves.toBeDefined()
  })
})
