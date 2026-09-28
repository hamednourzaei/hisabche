// ============================================
// Developer platform 04 — docs/developer-platform-04-portal-migration.sql,
// run unchanged (twice) in a real Postgres, then its VERIFY query. Proves the
// token shape is enforced, tokens are unique, members read their workspace's
// links only, and nobody writes one directly.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev4-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev4`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m04 = readFileSync(join(DOCS, 'developer-platform-04-portal-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-04.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const OWNER = '11111111-1111-1111-1111-111111111111'
const OUTSIDER = '99999999-9999-9999-9999-999999999999'
const CUSTOMER = 'cccccccc-0000-0000-0000-000000000001'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev4')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL, user_id uuid NOT NULL, role text,
      has_access boolean DEFAULT true, suspended_at timestamptz
    );
    GRANT SELECT ON public.workspace_members TO authenticated;
  `)
  await setup.unsafe(m04)
  await setup.unsafe(m04)
  await setup`INSERT INTO workspaces VALUES (${WS})`
  await setup`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${WS}, ${OWNER}, 'seller')`
  await setup.end()
  db = postgres(url, { max: 3, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

const link = (token: string) =>
  db`INSERT INTO customer_portal_links (workspace_id, customer_id, token, created_by)
     VALUES (${WS}, ${CUSTOMER}, ${token}, ${OWNER})`

const as = async <T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
  (await db.begin(async (tx) => {
    await tx.unsafe('SET LOCAL ROLE authenticated')
    await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${userId}'`)
    return fn(tx)
  })) as T

describe('portal links', () => {
  it('ran twice, and every VERIFY row reads ok', async () => {
    const rows = await db.unsafe(verify)
    expect(rows.length).toBe(5)
    for (const row of rows)
      expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
  })

  it('a token must be 256-bit hex, and unique', async () => {
    await expect(link('short')).rejects.toThrow(/check/)
    await link('a'.repeat(64))
    await expect(link('a'.repeat(64))).rejects.toThrow(/unique|duplicate/)
  })

  it('members read their workspace’s links; outsiders nothing; nobody writes directly', async () => {
    await link('b'.repeat(64))
    expect(
      (await as(OWNER, (tx) => tx`SELECT id FROM customer_portal_links`)).length,
    ).toBeGreaterThan(0)
    expect((await as(OUTSIDER, (tx) => tx`SELECT id FROM customer_portal_links`)).length).toBe(0)
    await expect(
      as(OWNER, (tx) => tx`UPDATE customer_portal_links SET revoked_at = NULL`),
    ).rejects.toThrow(/permission denied/)
  })
})
