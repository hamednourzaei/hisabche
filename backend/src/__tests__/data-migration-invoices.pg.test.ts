// ============================================
// docs/data-migration-invoices-01-migration.sql, run for real — twice.
//
// A migration is proven by running it, not by reading it. This starts a real
// Postgres, builds the two tables as the import centre's own migration leaves
// them, runs the new file twice, and then asks the database the only question
// that matters: does it now accept an invoice job, and still refuse nonsense?
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-miginv-'))
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

// The two tables as the import centre leaves them: only the columns the
// constraints touch, and the constraints exactly as that migration writes them.
const BEFORE = `
  CREATE TABLE migration_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL,
    entity text NOT NULL
  );
  ALTER TABLE migration_jobs ADD CONSTRAINT migration_jobs_entity_check
    CHECK (entity IN ('customer', 'product'));

  CREATE TABLE migration_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL,
    entity text NOT NULL
  );
  ALTER TABLE migration_profiles ADD CONSTRAINT migration_profiles_entity_check
    CHECK (entity IN ('customer', 'product'));

  INSERT INTO migration_jobs (workspace_id, entity)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'customer');
`

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
let sql: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  await sql.unsafe(BEFORE)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const refused = async (statement: string): Promise<string | null> => {
  try {
    await sql.unsafe(statement)
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

describe('data-migration-invoices-01', () => {
  it('before it runs, the database refuses an invoice job', async () => {
    expect(
      await refused(
        `INSERT INTO migration_jobs (workspace_id, entity) VALUES ('${WS}', 'invoice')`,
      ),
    ).toBe('23514')
  })

  it('runs, and runs again, without an error', async () => {
    const migration = read('data-migration-invoices-01-migration.sql')
    await sql.unsafe(migration)
    await sql.unsafe(migration)
  })

  it('after it, an invoice job and an invoice profile are accepted', async () => {
    expect(
      await refused(
        `INSERT INTO migration_jobs (workspace_id, entity) VALUES ('${WS}', 'invoice')`,
      ),
    ).toBeNull()
    expect(
      await refused(
        `INSERT INTO migration_profiles (workspace_id, entity) VALUES ('${WS}', 'invoice')`,
      ),
    ).toBeNull()
  })

  it('⚠️ a kind that does not exist is still refused, and old rows are untouched', async () => {
    expect(
      await refused(
        `INSERT INTO migration_jobs (workspace_id, entity) VALUES ('${WS}', 'payment')`,
      ),
    ).toBe('23514')

    const rows =
      await sql`SELECT entity, count(*)::int AS n FROM migration_jobs GROUP BY entity ORDER BY entity`
    expect(rows.map((row) => [row.entity, row.n])).toEqual([
      ['customer', 1],
      ['invoice', 1],
    ])
  })

  it('the VERIFY query says ok', async () => {
    const [row] = await sql.unsafe(read('data-migration-invoices-01-VERIFY.sql'))
    expect(row).toMatchObject({
      jobs_allows_invoice: true,
      profiles_allows_invoice: true,
      ok: true,
    })
  })
})
