// ============================================
// docs/custom-units-01-migration.sql — TWICE on a real Postgres, then its
// VERIFY, then the rules: one quote per unit per day, a positive worth, a
// name of 1–40 characters, and nothing for the browser roles.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 59800 + Math.floor(Math.random() * 150)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-custom-units-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/custom_units`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('custom_units')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)
  await setup.unsafe(read('custom-units-01-migration.sql'))
  await setup.unsafe(read('custom-units-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

const insert = (name: string, worth: number, day = '2026-10-14') =>
  sql.unsafe(
    `INSERT INTO public.custom_unit_rates (workspace_id, name, base_per_unit, rate_date)
     VALUES ($1, $2, $3, $4)`,
    [SHOP, name, worth, day],
  )

describe('custom-units-01', () => {
  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-custom-units-01.sql'))
    expect(rows.length).toBe(6)
    expect(rows.filter((row) => row.ok !== true)).toEqual([])
  })

  it('a unit is kept with its worth', async () => {
    await insert('ماشین', 500_000)
    const rows = await sql.unsafe(
      'SELECT name, base_per_unit::float AS worth FROM public.custom_unit_rates',
    )
    expect(rows).toEqual([{ name: 'ماشین', worth: 500_000 }])
  })

  it('⚠️ a second quote for the same unit on the same day is refused — the server updates instead', async () => {
    expect(await refusal(() => insert('ماشین', 600_000))).toContain('custom_unit_rates_one_per_day')
    expect(await refusal(() => insert('ماشین', 600_000, '2026-10-15'))).toBe('ALLOWED')
  })

  it('zero, a negative worth and an empty or long name are refused', async () => {
    expect(await refusal(() => insert('بسته', 0))).toContain('custom_unit_rates_positive')
    expect(await refusal(() => insert('بسته', -1))).toContain('custom_unit_rates_positive')
    expect(await refusal(() => insert('  ', 10))).toContain('custom_unit_rates_name_length')
    expect(await refusal(() => insert('x'.repeat(41), 10))).toContain(
      'custom_unit_rates_name_length',
    )
  })
})
