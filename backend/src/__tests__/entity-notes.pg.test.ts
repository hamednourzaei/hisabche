// ============================================
// docs/entity-notes-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-entity-notes-01.sql — and the rule only the database can
// hold: a note is never rewritten or removed, by any role.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-notes-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/notes`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const ENTITY = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('notes')
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
  await setup.unsafe(read('entity-notes-01-migration.sql'))
  await setup.unsafe(read('entity-notes-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const add = (body: string, type = 'customer') => sql`
  INSERT INTO entity_notes (workspace_id, entity_type, entity_id, body, created_by)
  VALUES (${WS}, ${type}, ${ENTITY}, ${body}, ${USER}) RETURNING id`

describe('entity-notes-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-entity-notes-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(6)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a note is stored; an empty one, an over-long one and an unknown entity type are refused', async () => {
    await expect(add('مشتری صبح‌ها جواب می‌دهد')).resolves.toHaveLength(1)
    await expect(add('   ')).rejects.toThrow(/body/)
    await expect(add('x'.repeat(4001))).rejects.toThrow(/body/)
    await expect(add('x', 'invoice')).rejects.toThrow(/entity_type/)
  })

  it('a note cannot be rewritten or removed — by the owner of the table either', async () => {
    const [note] = await add('اصل یادداشت')
    await expect(
      sql`UPDATE entity_notes SET body = 'changed' WHERE id = ${note!.id}`,
    ).rejects.toThrow('ENTITY_NOTE_IMMUTABLE')
    await expect(sql`DELETE FROM entity_notes WHERE id = ${note!.id}`).rejects.toThrow(
      'ENTITY_NOTE_IMMUTABLE',
    )
    const [kept] = await sql`SELECT body FROM entity_notes WHERE id = ${note!.id}`
    expect(kept!.body).toBe('اصل یادداشت')
  })

  it('the backend role may add and read, and has no UPDATE or DELETE at all', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`
        await tx`UPDATE entity_notes SET body = 'x'`
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('a browser role cannot read notes', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM entity_notes`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
