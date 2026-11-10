// ============================================
// docs/user-state-01-migration.sql — on a real Postgres, TWICE, then VERIFY.
// Invoice drafts and the theme preference move from the device into the
// database (QA-005, QA-THEME-001; 9 Nov 2026).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-user-state-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/userstate`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const U = '11111111-1111-4111-8111-111111111111'
const W = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('userstate')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)
  // ⚠️ Twice: re-runnable, or nobody dares run it on a half-migrated database.
  await setup.unsafe(read('user-state-01-migration.sql'))
  await setup.unsafe(read('user-state-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('user-state-01', () => {
  it('VERIFY is all true', async () => {
    const rows = await sql.unsafe(read('VERIFY-user-state-01.sql'))
    expect(rows.length).toBe(7)
    expect(rows.every((row) => row.ok === true)).toBe(true)
  })

  it('keeps a draft as the builder wrote it', async () => {
    const payload = { rows: [{ id: 'r1', values: { name: 'برنج' } }], notes: 'x' }
    const [row] = await sql`
      INSERT INTO invoice_drafts (workspace_id, user_id, kind, title, payload)
      VALUES (${W}, ${U}, 'sale', 'مشتری · برنج', ${sql.json(payload)})
      RETURNING id, payload`
    expect(row?.payload).toEqual(payload)
  })

  it('refuses an unknown kind and a payload that is not an object', async () => {
    await expect(
      sql`INSERT INTO invoice_drafts (workspace_id, user_id, kind, payload)
          VALUES (${W}, ${U}, 'refund', '{}'::jsonb)`,
    ).rejects.toThrow(/invoice_drafts_shape/)
    await expect(
      sql`INSERT INTO invoice_drafts (workspace_id, user_id, kind, payload)
          VALUES (${W}, ${U}, 'sale', '[]'::jsonb)`,
    ).rejects.toThrow(/invoice_drafts_shape/)
  })

  it('one theme per person, and only the three known ones', async () => {
    await sql`INSERT INTO user_preferences (user_id, theme) VALUES (${U}, 'dark')`
    await sql`INSERT INTO user_preferences (user_id, theme) VALUES (${U}, 'light')
              ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme`
    const rows = await sql`SELECT theme FROM user_preferences WHERE user_id = ${U}`
    expect(rows.map((r) => r.theme)).toEqual(['light'])
    await expect(
      sql`INSERT INTO user_preferences (user_id, theme) VALUES (${W}, 'neon')`,
    ).rejects.toThrow(/user_preferences_theme/)
  })
})
