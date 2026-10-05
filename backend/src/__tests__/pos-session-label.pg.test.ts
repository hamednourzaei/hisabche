// ============================================
// docs/pos-session-label-01-migration.sql run unchanged (twice) in a real
// Postgres, with Supabase's default privileges, then its VERIFY — plus the one
// rule only the database holds: a name is 1–80 characters, or absent.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 52100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-till-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/till`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('till')
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
    -- The table the migration adds a column to, as SETUP-COMPLETE.sql makes it.
    CREATE TABLE pos_sessions (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id        uuid NOT NULL,
      branch_id           uuid,
      status              text NOT NULL DEFAULT 'open',
      opening_float_minor bigint NOT NULL DEFAULT 0,
      opened_at           timestamptz NOT NULL DEFAULT now(),
      opened_by           uuid NOT NULL
    );
    -- A till that existed before the migration: it must survive it untouched.
    INSERT INTO pos_sessions (workspace_id, opened_by, opening_float_minor)
    VALUES ('${WS}', '${USER}', 5000);`)
  await setup.unsafe(read('pos-session-label-01-migration.sql'))
  await setup.unsafe(read('pos-session-label-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('pos-session-label-01', () => {
  it('ran twice, and its VERIFY says ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-pos-session-label-01.sql'))
    expect(row).toMatchObject({
      label_column_exists: true,
      label_is_nullable: true,
      length_check_exists: true,
      ok: true,
    })
  })

  it('left the existing till as it was — no name, same money', async () => {
    const rows = await sql`SELECT label, opening_float_minor FROM pos_sessions`
    expect(rows).toHaveLength(1)
    expect(rows[0]!.label).toBeNull()
    expect(Number(rows[0]!.opening_float_minor)).toBe(5000)
  })

  it('takes a name, and takes it back', async () => {
    await sql`UPDATE pos_sessions SET label = 'صندوق جلوی مغازه'`
    expect((await sql`SELECT label FROM pos_sessions`)[0]!.label).toBe('صندوق جلوی مغازه')
    await sql`UPDATE pos_sessions SET label = NULL`
    expect((await sql`SELECT label FROM pos_sessions`)[0]!.label).toBeNull()
  })

  it('refuses an empty name and one longer than 80 characters', async () => {
    await expect(sql`UPDATE pos_sessions SET label = ''`).rejects.toThrow(
      /pos_sessions_label_length_check/,
    )
    await expect(sql`UPDATE pos_sessions SET label = ${'x'.repeat(81)}`).rejects.toThrow(
      /pos_sessions_label_length_check/,
    )
    // Exactly 80 is a name.
    await sql`UPDATE pos_sessions SET label = ${'x'.repeat(80)}`
    expect((await sql`SELECT char_length(label) AS n FROM pos_sessions`)[0]!.n).toBe(80)
  })
})
