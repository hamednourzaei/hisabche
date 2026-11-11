// ============================================
// backend/src/__tests__/quality-events-01.pg.test.ts
//
// V60 Slice 11 — Proves docs/quality-events-01-migration.sql against real Postgres:
//   - runs twice idempotently with VERIFY checks
//   - append-only trigger refuses UPDATE and DELETE on `quality_events`
//   - rejects invalid `source_type` values via CHECK constraint
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const pg = new EmbeddedPostgres({
  databaseDir: pgTempDir('hisabche-pg-quality-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/qualitydb`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '22222222-2222-4222-8222-222222222222'
const ACTOR = '33333333-3333-4333-8333-333333333333'
const SRC = '44444444-4444-4444-8444-444444444444'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('qualitydb')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.products (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.warehouses (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.warranties (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.workspace_members (
      workspace_id uuid, user_id uuid, has_access boolean, suspended_at timestamptz
    );
    INSERT INTO public.workspaces (id) VALUES ('${WS}') ON CONFLICT DO NOTHING;
  `)
  await setup.unsafe(read('quality-events-01-migration.sql'))
  await setup.unsafe(read('quality-events-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2 })
}, 90_000)

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await pg?.stop()
})

describe('quality-events-01-migration.sql on Postgres', () => {
  it('passes VERIFY checks after idempotent double run', async () => {
    const [row] = await sql.unsafe(read('VERIFY-quality-events-01.sql'))
    expect(row).toBeDefined()
    expect(Number(row!.table_count)).toBe(2)
    expect(Number(row!.immutable_trigger_count)).toBe(1)
    expect(Number(row!.rls_enabled_count)).toBe(2)
  })

  it('refuses UPDATE and DELETE on quality_events (append-only)', async () => {
    const [inserted] = await sql`
      INSERT INTO public.quality_events (workspace_id, source_type, source_id, event_kind, actor_id)
      VALUES (${WS}, 'receipt', ${SRC}, 'fail', ${ACTOR})
      RETURNING id
    `
    expect(inserted).toBeDefined()
    await expect(
      sql`UPDATE public.quality_events SET event_kind = 'pass' WHERE id = ${inserted!.id}`,
    ).rejects.toThrow(/QUALITY_EVENT_IMMUTABLE/)
    await expect(sql`DELETE FROM public.quality_events WHERE id = ${inserted!.id}`).rejects.toThrow(
      /QUALITY_EVENT_IMMUTABLE/,
    )
  })

  it('rejects unsupported source_type values via CHECK constraint', async () => {
    await expect(
      sql`
        INSERT INTO public.quality_events (workspace_id, source_type, source_id, event_kind, actor_id)
        VALUES (${WS}, 'unknown_kind', ${SRC}, 'check', ${ACTOR})
      `,
    ).rejects.toThrow()
  })
})
