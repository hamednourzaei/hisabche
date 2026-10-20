// ============================================
// docs/linter-2026-10-11-migration.sql, run for real — twice.
//
// Eight trigger functions get a fixed search_path and the cms-media bucket
// loses the policy that let any client list it. Proven on a real Postgres:
// some of the functions exist and some do not (a database that has not had
// every feature migration), and a storage schema shaped like Supabase's.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-lint1011-'))
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

// Six of the eight functions (two feature migrations «not run»), and storage
// as Supabase has it: a public bucket and the broad SELECT policy.
const PRESENT = [
  'blog_article_versions_immutable',
  'ai_action_requests_move_forward_only',
  'data_snapshots_are_append_only',
  'entity_notes_are_append_only',
  'campaigns_keep_history',
  'cms_page_versions_immutable',
]

const BEFORE = `
  ${PRESENT.map(
    (name) => `
  CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    RAISE EXCEPTION 'append-only';
  END $fn$;`,
  ).join('\n')}

  CREATE TABLE public.guarded (id int PRIMARY KEY, note text);
  INSERT INTO public.guarded VALUES (1, 'kept');
  CREATE TRIGGER guarded_trg BEFORE UPDATE ON public.guarded
    FOR EACH ROW EXECUTE FUNCTION public.entity_notes_are_append_only();

  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean NOT NULL);
  CREATE TABLE storage.objects (id serial PRIMARY KEY, bucket_id text NOT NULL, name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  INSERT INTO storage.buckets VALUES ('cms-media', true);
  CREATE POLICY cms_media_bucket_public_read ON storage.objects FOR SELECT
    USING (bucket_id = 'cms-media');
  CREATE POLICY another_bucket_read ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');
`

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

describe('linter-2026-10-11', () => {
  it('before it runs, the VERIFY query says NOT ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-linter-2026-10-11.sql'))
    expect(row).toMatchObject({
      functions_found: 6,
      functions_pinned: 0,
      listing_policy_gone: false,
      ok: false,
    })
  })

  it('runs twice without error, with two of the functions absent', async () => {
    await sql.unsafe(read('linter-2026-10-11-migration.sql'))
    await sql.unsafe(read('linter-2026-10-11-migration.sql'))
  })

  it('every function that exists has a fixed search_path', async () => {
    const rows = await sql`
      SELECT proname, proconfig FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace AND proname = ANY(${PRESENT})`
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(row.proconfig, row.proname).toEqual(['search_path=public, pg_temp'])
    }
  })

  it('⚠️ the trigger still does its job — only the configuration changed', async () => {
    let message = ''
    try {
      await sql`UPDATE public.guarded SET note = 'changed' WHERE id = 1`
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('append-only')
    const [row] = await sql`SELECT note FROM public.guarded WHERE id = 1`
    expect(row?.note).toBe('kept')
  })

  it('the listing policy is gone; the bucket is still public and other policies stand', async () => {
    const policies = await sql`
      SELECT policyname FROM pg_policies WHERE schemaname = 'storage' ORDER BY policyname`
    expect(policies.map((row) => row.policyname)).toEqual(['another_bucket_read'])
    const [bucket] = await sql`SELECT public FROM storage.buckets WHERE id = 'cms-media'`
    expect(bucket?.public).toBe(true)
  })

  it('the VERIFY query says ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-linter-2026-10-11.sql'))
    expect(row).toMatchObject({
      functions_found: 6,
      functions_pinned: 6,
      listing_policy_gone: true,
      bucket_still_public: true,
      ok: true,
    })
  })
})
