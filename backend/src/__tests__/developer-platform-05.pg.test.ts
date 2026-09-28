// ============================================
// Developer platform 05 — docs/developer-platform-05-oauth-migration.sql,
// run unchanged (twice) after 01 in a real Postgres, then its VERIFY query.
//
// What only the database can prove: that a code is redeemed ONCE even when
// two token requests race, that an expired code or a different redirect_uri
// or app redeems nothing, that a new app is private, and that no client can
// read a code or write an app.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev5-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev5`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m01 = readFileSync(join(DOCS, 'developer-platform-migration.sql'), 'utf8')
const m05 = readFileSync(join(DOCS, 'developer-platform-05-oauth-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-05.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const OWNER = '11111111-1111-1111-1111-111111111111'
const OUTSIDER = '99999999-9999-9999-9999-999999999999'
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
const REDIRECT = 'https://app.example/callback'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev5')
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
  await expect(setup.unsafe(m05)).rejects.toThrow(/developer-platform-migration\.sql first/)
  await setup.unsafe('ROLLBACK')
  await setup.unsafe(m01)
  await setup.unsafe(m05)
  await setup.unsafe(m05)
  await setup`INSERT INTO workspaces VALUES (${WS})`
  await setup`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${WS}, ${OWNER}, 'owner')`
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

let app: string
beforeEach(async () => {
  await db`DELETE FROM oauth_apps`
  const [row] = await db`
    INSERT INTO oauth_apps (owner_workspace_id, created_by, name, redirect_uris, requested_scopes, client_id, client_secret_hash)
    VALUES (${WS}, ${OWNER}, 'Shop sync', ${[REDIRECT]}, ${['read:products']}, ${'hk_app_' + 'a'.repeat(32)}, ${'b'.repeat(64)})
    RETURNING id, status`
  app = row!.id as string
  expect(row!.status).toBe('private')
})

async function code(hash: string, expiresIn = '10 minutes') {
  await db`
    INSERT INTO oauth_authorization_codes (code_hash, app_id, workspace_id, user_id, scopes, redirect_uri, code_challenge, expires_at)
    VALUES (${hash}, ${app}, ${WS}, ${OWNER}, ${['read:products']}, ${REDIRECT}, ${CHALLENGE}, now() + ${expiresIn}::interval)`
}
const redeem = (hash: string, appId = app, redirect = REDIRECT) =>
  db`SELECT * FROM redeem_oauth_code(${hash}, ${appId}, ${redirect})`

describe('oauth', () => {
  it('ran twice after 01, and every VERIFY row reads ok', async () => {
    const rows = await db.unsafe(verify)
    expect(rows.length).toBe(7)
    for (const row of rows)
      expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
  })

  it('a code is redeemed once — even when two token requests race', async () => {
    await code('1'.repeat(64))
    const [a, b] = await Promise.all([redeem('1'.repeat(64)), redeem('1'.repeat(64))])
    expect(a.length + b.length).toBe(1)
    expect([...a, ...b][0]).toMatchObject({
      workspace_id: WS,
      user_id: OWNER,
      code_challenge: CHALLENGE,
    })
    expect((await redeem('1'.repeat(64))).length).toBe(0)
  })

  it('an expired code, another redirect_uri or another app redeems nothing', async () => {
    await code('2'.repeat(64), '-1 minute')
    expect((await redeem('2'.repeat(64))).length).toBe(0)
    await code('3'.repeat(64))
    expect((await redeem('3'.repeat(64), app, 'https://evil.example/cb')).length).toBe(0)
    expect((await redeem('3'.repeat(64), '00000000-0000-0000-0000-000000000000')).length).toBe(0)
    // …and the right request still works: the failed attempts did not burn it.
    expect((await redeem('3'.repeat(64))).length).toBe(1)
  })

  it('shapes are enforced: client ids, secret hashes, https homepages', async () => {
    await expect(
      db`INSERT INTO oauth_apps (owner_workspace_id, created_by, name, redirect_uris, requested_scopes, client_id, client_secret_hash)
         VALUES (${WS}, ${OWNER}, 'x', ${[REDIRECT]}, ${['read:products']}, 'guessable', ${'b'.repeat(64)})`,
    ).rejects.toThrow(/check/)
    await expect(
      db`UPDATE oauth_apps SET homepage_url = 'http://insecure.example' WHERE id = ${app}`,
    ).rejects.toThrow(/check/)
  })

  it('publishers read their apps; outsiders read none; nobody reads a code or writes an app', async () => {
    const as = async <T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
      (await db.begin(async (tx) => {
        await tx.unsafe('SET LOCAL ROLE authenticated')
        await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${userId}'`)
        return fn(tx)
      })) as T
    expect((await as(OWNER, (tx) => tx`SELECT id FROM oauth_apps`)).length).toBe(1)
    expect((await as(OUTSIDER, (tx) => tx`SELECT id FROM oauth_apps`)).length).toBe(0)
    await expect(
      as(OWNER, (tx) => tx`SELECT code_hash FROM oauth_authorization_codes`),
    ).rejects.toThrow(/permission denied/)
    await expect(as(OWNER, (tx) => tx`UPDATE oauth_apps SET status = 'published'`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('uninstalling an app’s publisher record removes its tokens with it', async () => {
    await db`
      INSERT INTO api_keys (workspace_id, created_by, name, prefix, key_hash, scopes, app_id)
      VALUES (${WS}, ${OWNER}, 'Shop sync', 'hk_live_x', ${'c'.repeat(64)}, ${['read:products']}, ${app})`
    await db`DELETE FROM oauth_apps WHERE id = ${app}`
    expect(
      (await db`SELECT count(*)::int AS n FROM api_keys WHERE key_hash = ${'c'.repeat(64)}`)[0]!.n,
    ).toBe(0)
  })
})
