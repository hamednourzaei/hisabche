// ============================================
// docs/custom-fields-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-custom-fields-01.sql — plus the rules only the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 60000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-cf-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/cf`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const ENTITY = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('cf')
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
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('custom-fields-01-migration.sql'))
  await setup.unsafe(read('custom-fields-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE custom_field_definitions, custom_field_values`
})

const define = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO custom_field_definitions ${sql({
    workspace_id: WS,
    created_by: USER,
    entity_type: 'customer',
    key: 'region',
    label: 'منطقه',
    field_type: 'text',
    ...fields,
  })}`

describe('custom-fields-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-custom-fields-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(11)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a field cannot be put on an invoice, a payment or the ledger', async () => {
    for (const entity of ['invoice', 'payment', 'journal_entry', 'account']) {
      await expect(define({ entity_type: entity })).rejects.toThrow(/entity_type/)
    }
    await expect(
      sql`INSERT INTO custom_field_values (workspace_id, entity_type, entity_id, updated_by)
          VALUES (${WS}, 'invoice', ${ENTITY}, ${USER})`,
    ).rejects.toThrow(/entity_type/)
  })

  it('a key is a plain lower-case name, and is unique per entity even after the field is retired', async () => {
    await expect(define({ key: 'Region' })).rejects.toThrow(/key/)
    await expect(define({ key: '1st' })).rejects.toThrow(/key/)
    await expect(define({ key: 'a b' })).rejects.toThrow(/key/)
    await define()
    await sql`UPDATE custom_field_definitions SET is_active = false`
    await expect(define({ label: 'معنای دیگر' })).rejects.toThrow('custom_field_definitions_key')
    // The same key on another entity is another field.
    await expect(define({ entity_type: 'product' })).resolves.toBeDefined()
  })

  it('a choice needs its choices and a formula its formula — NULL does not slip past', async () => {
    await expect(define({ key: 'c1', field_type: 'choice' })).rejects.toThrow(
      'custom_field_choice_has_choices',
    )
    await expect(
      sql`INSERT INTO custom_field_definitions (workspace_id, created_by, entity_type, key, label, field_type, choices)
          VALUES (${WS}, ${USER}, 'customer', 'c2', 'x', 'choice', '{}')`,
    ).rejects.toThrow('custom_field_choice_has_choices')
    await expect(define({ key: 'f1', field_type: 'formula' })).rejects.toThrow(
      'custom_field_formula_has_formula',
    )
    await expect(
      define({ key: 'f2', field_type: 'formula', formula: 'a + b', is_required: true }),
    ).rejects.toThrow('custom_field_formula_not_required')
    await expect(
      define({ key: 'f3', field_type: 'formula', formula: 'a + b' }),
    ).resolves.toBeDefined()
  })

  it('one row of values per record; the values are a JSON object', async () => {
    const put = (values: string) => sql`
      INSERT INTO custom_field_values (workspace_id, entity_type, entity_id, field_values, updated_by)
      VALUES (${WS}, 'customer', ${ENTITY}, ${values}::text::jsonb, ${USER})`
    await put('{"region":"کابل"}')
    await expect(put('{"region":"هرات"}')).rejects.toThrow(/custom_field_values_pkey/)
    await sql`TRUNCATE custom_field_values`
    await expect(put('[1,2]')).rejects.toThrow(/field_values/)
  })

  it('a browser role can read neither table', async () => {
    for (const table of ['custom_field_definitions', 'custom_field_values']) {
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`
          await tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })
})
