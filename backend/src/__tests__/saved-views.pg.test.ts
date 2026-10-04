// ============================================
// docs/saved-views-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-saved-views-01.sql — plus the two rules only the database
// can hold: one name per person per table, and no read for a browser role.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 53000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-views-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/views`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ALI = '11111111-1111-4111-8111-111111111111'
const SARA = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('views')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`)
  await setup.unsafe(read('saved-views-01-migration.sql'))
  await setup.unsafe(read('saved-views-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 6, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE saved_views`
})

const save = (name: string, by = ALI, table = 'invoices') => sql`
  INSERT INTO saved_views (workspace_id, table_id, name, created_by)
  VALUES (${WS}, ${table}, ${name}, ${by})`

describe('saved_views', () => {
  it('one name per person per table — whatever the case or the padding, however many arrive', async () => {
    const settled = await Promise.allSettled([
      save('بدهکاران'),
      save('بدهکاران'),
      save('  بدهکاران  '),
    ])
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1)
    await save('Unpaid')
    await expect(save('unpaid')).rejects.toThrow()
  })

  it('the same name is free for another person, and on another table', async () => {
    await save('بدهکاران')
    await save('بدهکاران', SARA)
    await save('بدهکاران', ALI, 'customers')
    expect(await sql`SELECT 1 FROM saved_views`).toHaveLength(3)
  })

  it('refuses an empty name and a table id that is not a plain identifier', async () => {
    await expect(save('   ')).rejects.toThrow()
    await expect(save('x', ALI, 'invoices; drop table')).rejects.toThrow()
    await expect(save('x', ALI, '')).rejects.toThrow()
  })

  it('is private by default', async () => {
    await save('mine')
    const [row] = await sql`SELECT shared, state FROM saved_views`
    expect(row).toMatchObject({ shared: false, state: {} })
  })

  it.each(['anon', 'authenticated'])('%s cannot read it', async (role) => {
    await save('mine')
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE ${role}`)
        return tx.unsafe('SELECT * FROM saved_views')
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('docs/VERIFY-saved-views-01.sql runs and every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-saved-views-01.sql'))
    expect(rows.length).toBe(5)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check)).toEqual([])
  })
})
