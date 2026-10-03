// ============================================
// Developer platform 08 — docs/developer-platform-08-migration.sql, run
// unchanged (twice) after 01, 02, 05, 06 and 07 in a real Postgres.
//
// What only the database proves:
//   - an install through the wrapper leaves an EXPIRING access token and one
//     refresh token, in one transaction;
//   - a rotation replaces the access token IN THE SAME api_keys row (the
//     installation and its endpoint are untouched) and the old refresh token
//     cannot be used again;
//   - REUSE of a refresh token revokes the whole family and the access token,
//     ends the installation — and that revocation is committed;
//   - another app's client cannot rotate or revoke this app's token;
//   - a refresh token of an uninstalled app is refused;
//   - a sandbox reset retires the old sandbox (keys revoked, no members, link
//     cut) and returns a new empty one — and refuses a real business;
//   - clients can execute none of it; VERIFY is all true.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 56000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev8-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev8`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const sql = (file: string) => readFileSync(join(DOCS, file), 'utf8')
const m08 = sql('developer-platform-08-migration.sql')
const verify = sql('VERIFY-developer-platform-08.sql')

const PUB = 'aaaaaaaa-0000-0000-0000-000000000001'
const SHOP = 'bbbbbbbb-0000-0000-0000-000000000002'
const DEV = '11111111-1111-1111-1111-111111111111'
const OWNER = '22222222-2222-2222-2222-222222222222'
const STRANGER = '44444444-4444-4444-4444-444444444444'

const hash = (n: number) => n.toString(16).padStart(64, '0')
let app: string
let otherApp: string

const HOUR = 3600
const MONTH = 30 * 24 * 3600

const install = (keyHash: string, refreshHash: string) =>
  db`SELECT * FROM install_oauth_app_with_refresh(${app}, ${SHOP}, ${OWNER}, NULL, 'Shop sync', 'hk_live_x',
       ${keyHash}, ${['read:products']}, NULL, ${[] as string[]}, ${refreshHash}, ${HOUR}, ${MONTH})`
const rotate = (client: string, refresh: string, nextRefresh: string, nextKey: string) =>
  db<{ workspace_id: string; old_key_hash: string | null; reused: boolean }[]>`
    SELECT * FROM rotate_oauth_refresh_token(${client}, ${refresh}, ${nextRefresh}, 'hk_live_y',
      ${nextKey}, ${['read:products']}, ${HOUR}, ${MONTH})`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev8')
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
    CREATE TABLE public.workspaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL DEFAULT 'Shop',
      slug text NOT NULL DEFAULT 'shop', owner_id uuid
    );
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL, user_id uuid NOT NULL, role text,
      has_access boolean DEFAULT true, suspended_at timestamptz
    );
    CREATE TABLE public.products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, quantity numeric(18,4) DEFAULT 0,
      min_stock_level integer DEFAULT 0, is_active boolean DEFAULT true
    );
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
      file_size_limit bigint, allowed_mime_types text[]);
  `)
  for (const file of [
    'developer-platform-migration.sql',
    'developer-platform-02-migration.sql',
    'developer-platform-05-oauth-migration.sql',
    'developer-platform-06-sandbox-migration.sql',
    'developer-platform-07-marketplace-migration.sql',
  ]) {
    await setup.unsafe(sql(file))
  }
  await setup.unsafe(m08)
  await setup.unsafe(m08)
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await db`DELETE FROM oauth_refresh_tokens`
  await db`DELETE FROM app_installations`
  await db`DELETE FROM webhook_endpoints`
  await db`DELETE FROM api_keys`
  await db`UPDATE oauth_apps SET published_version_id = NULL`
  await db`DELETE FROM oauth_apps`
  await db`DELETE FROM workspace_members`
  await db`DELETE FROM workspaces`
  await db`INSERT INTO workspaces (id, name, slug, owner_id) VALUES
    (${PUB}, 'Publisher', 'publisher', ${DEV}), (${SHOP}, 'Shop', 'shop', ${OWNER})`
  await db`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${SHOP}, ${OWNER}, 'owner')`
  const make = async (slug: string, client: string) => {
    const [row] = await db`
      INSERT INTO oauth_apps (owner_workspace_id, created_by, name, redirect_uris, requested_scopes, client_id,
                              client_secret_hash, slug, tagline, category)
      VALUES (${PUB}, ${DEV}, ${slug}, ${['https://app.example/cb']}, ${['read:products']},
              ${client}, ${'b'.repeat(64)}, ${slug}, 'Sync your shop', 'ecommerce')
      RETURNING id`
    return row!.id as string
  }
  app = await make('shop-sync', 'hk_app_' + 'a'.repeat(32))
  otherApp = await make('other-app', 'hk_app_' + 'c'.repeat(32))
})

describe('install', () => {
  it('leaves an expiring access token and exactly one refresh token', async () => {
    const [inst] = await install(hash(1), hash(101))
    const [key] = await db<{ expires_at: Date | null; revoked_at: Date | null }[]>`
      SELECT expires_at, revoked_at FROM api_keys WHERE id = ${inst!.key_id}`
    expect(key!.expires_at).not.toBeNull()
    expect(key!.expires_at!.getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000)
    expect(key!.expires_at!.getTime()).toBeLessThan(Date.now() + 70 * 60 * 1000)
    const tokens =
      await db`SELECT 1 FROM oauth_refresh_tokens WHERE installation_id = ${inst!.installation_id}`
    expect(tokens).toHaveLength(1)
  })

  it('a refresh lifetime not longer than the access lifetime is refused', async () => {
    await expect(
      db`SELECT * FROM install_oauth_app_with_refresh(${app}, ${SHOP}, ${OWNER}, NULL, 'x', 'hk_live_x',
           ${hash(1)}, ${['read:products']}, NULL, ${[] as string[]}, ${hash(101)}, 3600, 3600)`,
    ).rejects.toThrow(/OAUTH_TOKEN_LIFETIME_INVALID/)
    expect(await db`SELECT 1 FROM app_installations`).toHaveLength(0)
  })
})

describe('rotation', () => {
  it('swaps the access token in the SAME key row; the installation is untouched', async () => {
    const [inst] = await install(hash(1), hash(101))
    const [out] = await rotate(app, hash(101), hash(102), hash(2))
    expect(out).toMatchObject({ workspace_id: SHOP, old_key_hash: hash(1), reused: false })

    const keys = await db<{ id: string; key_hash: string; revoked_at: Date | null }[]>`
      SELECT id, key_hash, revoked_at FROM api_keys`
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatchObject({ id: inst!.key_id, key_hash: hash(2), revoked_at: null })
    const [still] = await db<{ status: string }[]>`
      SELECT status FROM app_installations WHERE id = ${inst!.installation_id}`
    expect(still!.status).toBe('active')
  })

  it('the new refresh token works, in the same family', async () => {
    await install(hash(1), hash(101))
    await rotate(app, hash(101), hash(102), hash(2))
    const [out] = await rotate(app, hash(102), hash(103), hash(3))
    expect(out!.reused).toBe(false)
    const families = await db`SELECT DISTINCT family_id FROM oauth_refresh_tokens`
    expect(families).toHaveLength(1)
  })

  it('REUSE revokes the family and the access token, ends the installation — and stays so', async () => {
    const [inst] = await install(hash(1), hash(101))
    await rotate(app, hash(101), hash(102), hash(2))
    // The thief (or the app, replaying) presents the first token again.
    const [out] = await rotate(app, hash(101), hash(999), hash(9))
    expect(out).toMatchObject({ reused: true, old_key_hash: hash(2) })

    const live = await db`SELECT 1 FROM oauth_refresh_tokens WHERE revoked_at IS NULL`
    expect(live).toHaveLength(0)
    const [key] = await db<{ revoked_at: Date | null; key_hash: string }[]>`
      SELECT revoked_at, key_hash FROM api_keys WHERE id = ${inst!.key_id}`
    expect(key!.revoked_at).not.toBeNull()
    expect(key!.key_hash).toBe(hash(2)) // the thief's new hash was never written
    const [ended] = await db<{ status: string }[]>`
      SELECT status FROM app_installations WHERE id = ${inst!.installation_id}`
    expect(ended!.status).toBe('uninstalled')
    // And the legitimate latest token is dead too.
    await expect(rotate(app, hash(102), hash(104), hash(4))).rejects.toThrow(
      /OAUTH_REFRESH_INVALID/,
    )
  })

  it("another app's client cannot rotate this token", async () => {
    await install(hash(1), hash(101))
    await expect(rotate(otherApp, hash(101), hash(102), hash(2))).rejects.toThrow(
      /OAUTH_REFRESH_INVALID/,
    )
    const [key] = await db<{ key_hash: string }[]>`SELECT key_hash FROM api_keys`
    expect(key!.key_hash).toBe(hash(1))
  })

  it('an unknown or expired token is refused', async () => {
    await install(hash(1), hash(101))
    await expect(rotate(app, hash(555), hash(102), hash(2))).rejects.toThrow(
      /OAUTH_REFRESH_INVALID/,
    )
    await db`UPDATE oauth_refresh_tokens SET expires_at = now() - interval '1 second'`
    await expect(rotate(app, hash(101), hash(102), hash(2))).rejects.toThrow(
      /OAUTH_REFRESH_INVALID/,
    )
  })

  it('after an uninstall (the key revoked) the refresh token is dead', async () => {
    const [inst] = await install(hash(1), hash(101))
    await db`UPDATE api_keys SET revoked_at = now() WHERE id = ${inst!.key_id}`
    await expect(rotate(app, hash(101), hash(102), hash(2))).rejects.toThrow(
      /OAUTH_REFRESH_INVALID/,
    )
  })
})

describe('revocation', () => {
  it('ends the family, the access token and the installation', async () => {
    const [inst] = await install(hash(1), hash(101))
    const [out] = await db<
      { h: string | null }[]
    >`SELECT revoke_oauth_refresh_token(${app}, ${hash(101)}) AS h`
    expect(out!.h).toBe(hash(1))
    const [ended] = await db<{ status: string }[]>`
      SELECT status FROM app_installations WHERE id = ${inst!.installation_id}`
    expect(ended!.status).toBe('uninstalled')
    await expect(rotate(app, hash(101), hash(102), hash(2))).rejects.toThrow(
      /OAUTH_REFRESH_INVALID/,
    )
  })

  it("an unknown token, or another app's client, changes nothing", async () => {
    await install(hash(1), hash(101))
    const [a] = await db<
      { h: string | null }[]
    >`SELECT revoke_oauth_refresh_token(${app}, ${hash(555)}) AS h`
    const [b] = await db<
      { h: string | null }[]
    >`SELECT revoke_oauth_refresh_token(${otherApp}, ${hash(101)}) AS h`
    expect([a!.h, b!.h]).toEqual([null, null])
    expect(await db`SELECT 1 FROM api_keys WHERE revoked_at IS NULL`).toHaveLength(1)
  })
})

describe('sandbox reset', () => {
  const sandbox = async () => {
    const [row] = await db<
      { id: string }[]
    >`SELECT id FROM create_sandbox_workspace(${SHOP}, ${OWNER})`
    return row!.id
  }

  it('retires the old sandbox and returns a new empty one for the same business', async () => {
    const old = await sandbox()
    await db`INSERT INTO api_keys (workspace_id, created_by, name, prefix, key_hash, scopes)
             VALUES (${old}, ${OWNER}, 'test', 'hk_live_s', ${hash(7)}, ${['read:products']})`
    await db`INSERT INTO products (workspace_id) VALUES (${old})`

    const [fresh] = await db<{ id: string; name: string }[]>`
      SELECT * FROM reset_sandbox_workspace(${old}, ${OWNER})`
    expect(fresh!.id).not.toBe(old)

    const [retired] = await db<{ is_sandbox: boolean; sandbox_of: string | null; name: string }[]>`
      SELECT is_sandbox, sandbox_of, name FROM workspaces WHERE id = ${old}`
    expect(retired).toMatchObject({ is_sandbox: true, sandbox_of: null })
    expect(retired!.name).toContain('(retired ')
    expect(await db`SELECT 1 FROM workspace_members WHERE workspace_id = ${old}`).toHaveLength(0)
    expect(
      await db`SELECT 1 FROM api_keys WHERE workspace_id = ${old} AND revoked_at IS NULL`,
    ).toHaveLength(0)
    // Nothing was deleted: the old data is still there, only unreachable.
    expect(await db`SELECT 1 FROM products WHERE workspace_id = ${old}`).toHaveLength(1)

    const [made] = await db<{ is_sandbox: boolean; sandbox_of: string; owner_id: string }[]>`
      SELECT is_sandbox, sandbox_of, owner_id FROM workspaces WHERE id = ${fresh!.id}`
    expect(made).toMatchObject({ is_sandbox: true, sandbox_of: SHOP, owner_id: OWNER })
    expect(
      await db`SELECT 1 FROM workspace_members WHERE workspace_id = ${fresh!.id}`,
    ).toHaveLength(1)
    expect(await db`SELECT 1 FROM products WHERE workspace_id = ${fresh!.id}`).toHaveLength(0)
    // The business still has exactly one sandbox for this person.
    const [again] = await db<{ id: string; created: boolean }[]>`
      SELECT id, created FROM create_sandbox_workspace(${SHOP}, ${OWNER})`
    expect(again).toMatchObject({ id: fresh!.id, created: false })
  })

  it('REFUSES a real business — the one rule that makes a reset safe', async () => {
    await expect(db`SELECT * FROM reset_sandbox_workspace(${SHOP}, ${OWNER})`).rejects.toThrow(
      /SANDBOX_RESET_NOT_A_SANDBOX/,
    )
    expect(await db`SELECT 1 FROM workspace_members WHERE workspace_id = ${SHOP}`).toHaveLength(1)
  })

  it("refuses someone else's sandbox, and a retired one", async () => {
    const old = await sandbox()
    await expect(db`SELECT * FROM reset_sandbox_workspace(${old}, ${STRANGER})`).rejects.toThrow(
      /SANDBOX_NOT_MEMBER/,
    )
    await db`SELECT * FROM reset_sandbox_workspace(${old}, ${OWNER})`
    await expect(db`SELECT * FROM reset_sandbox_workspace(${old}, ${OWNER})`).rejects.toThrow(
      /SANDBOX_RESET_NOT_A_SANDBOX/,
    )
  })
})

describe('access and verification', () => {
  it('VERIFY is all true', async () => {
    await install(hash(1), hash(101))
    const rows = await db.unsafe<{ check: string; ok: boolean }[]>(verify)
    expect(rows.filter((r) => !r.ok).map((r) => r.check)).toEqual([])
    expect(rows.length).toBeGreaterThan(14)
  })
})
