// ============================================
// Content intelligence — docs/content-intelligence-01…05 run unchanged, in
// order and TWICE, in a real Postgres on top of docs/blog-migration.sql, then
// docs/VERIFY-content-intelligence.sql on the result.
//
// ⚠️ WHY THIS EXISTS. These five scripts were only ever read by source
// assertions (content-intelligence-schema.test.ts). A source assertion cannot
// see a syntax error: script 01 carried three comment lines without their `--`
// inside a CREATE TABLE, every test was green, and the first person to learn
// about it was the owner pasting the script into the SQL editor.
// A migration is proven by running it — nothing else.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 58000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-ci-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/ci`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const SCRIPTS = [1, 2, 3, 4, 5].map((n) => `content-intelligence-0${n}-migration.sql`)

/** Each script, by name, with the error it raised (null = ran clean). */
const outcome = new Map<string, string | null>()

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('ci')
  sql = postgres(url, { max: 1, onnotice: () => {} })
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
      file_size_limit bigint, allowed_mime_types text[]
    );
  `)
  await sql.unsafe(read('blog-migration.sql'))

  // In order, and each one twice — «idempotent» is a claim until it is run twice.
  for (const name of SCRIPTS) {
    try {
      await sql.unsafe(read(name))
      await sql.unsafe(read(name))
      outcome.set(name, null)
    } catch (error) {
      const e = error as { message?: string; position?: string; where?: string }
      outcome.set(name, `${e.message ?? error} @${e.position ?? '?'} ${e.where ?? ''}`)
    }
  }
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('content-intelligence migrations run as written', () => {
  it.each(SCRIPTS)('%s runs twice without an error', (name) => {
    expect(outcome.get(name)).toBeNull()
  })

  it('the verification script runs on the result', async () => {
    await expect(sql.unsafe(read('VERIFY-content-intelligence.sql'))).resolves.toBeDefined()
  })

  it('every new table is RLS-on with no grant to a browser role', async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname IN (
          'blog_content_briefs', 'blog_research_runs', 'blog_sources', 'blog_article_sources',
          'blog_article_versions', 'blog_quality_reports', 'blog_internal_links',
          'blog_prompt_settings'
        )`
    expect(rows.length).toBeGreaterThanOrEqual(5)
    for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true)

    const grants = await sql`
      SELECT table_name, grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
        AND table_name LIKE 'blog\\_%' AND table_name IN (
          'blog_content_briefs', 'blog_research_runs', 'blog_sources', 'blog_article_sources',
          'blog_article_versions', 'blog_quality_reports', 'blog_internal_links',
          'blog_prompt_settings'
        )`
    expect(grants).toEqual([])
  })
})
