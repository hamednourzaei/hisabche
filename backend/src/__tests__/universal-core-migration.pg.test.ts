// ============================================
// Universal Core Migration PG Test
// Runs docs/universal-core-migration.sql TWICE on real Postgres.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-ucore-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/ucore`
let sql: postgres.Sql

const migrationSql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'universal-core-migration.sql'),
  'utf8',
)
const verifySql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'VERIFY-universal-core.sql'),
  'utf8',
)

const WS_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('ucore')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  // Prerequisite setup: roles, auth schema, workspaces
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT '${USER_ID}'::uuid
    $$;

    CREATE TABLE IF NOT EXISTS public.workspaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    INSERT INTO public.workspaces (id, name) VALUES ('${WS_ID}', 'Universal Core Test WS')
    ON CONFLICT DO NOTHING;
  `)
  await setup.end()

  sql = postgres(url, { max: 5, onnotice: () => {} })
})

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // the server may already be down; teardown must not fail the run
  }
})

describe('docs/universal-core-migration.sql', () => {
  it('applies the migration cleanly the first time', async () => {
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('is idempotent: applies a second time without error', async () => {
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('passes VERIFY-universal-core.sql assertions', async () => {
    const result = await sql.unsafe(verifySql)
    expect(result).toBeDefined()
  })
})
