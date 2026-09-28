// ============================================
// Developer platform 07 — docs/developer-platform-07-marketplace-migration.sql,
// run unchanged (twice) after 01, 02 and 05 in a real Postgres, then its
// VERIFY query.
//
// What only the database can prove: a version is an exact snapshot of the
// draft and only a newer one is accepted; http://localhost never reaches
// everyone; install / reinstall / update / uninstall move the key, the
// installation and the webhook endpoint TOGETHER; revoking the key from any
// path is an uninstall; a verified badge does not survive a name change; and
// the numbers are exact.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev7-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev7`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m01 = readFileSync(join(DOCS, 'developer-platform-migration.sql'), 'utf8')
const m02 = readFileSync(join(DOCS, 'developer-platform-02-migration.sql'), 'utf8')
const m05 = readFileSync(join(DOCS, 'developer-platform-05-oauth-migration.sql'), 'utf8')
const m07 = readFileSync(join(DOCS, 'developer-platform-07-marketplace-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-07.sql'), 'utf8')

const PUB = 'aaaaaaaa-0000-0000-0000-000000000001'
const SHOP = 'bbbbbbbb-0000-0000-0000-000000000002'
const DEV = '11111111-1111-1111-1111-111111111111'
const OWNER = '22222222-2222-2222-2222-222222222222'
const ADMIN = '33333333-3333-3333-3333-333333333333'
const SECRET = 's'.repeat(40)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev7')
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
    CREATE TABLE public.products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, quantity numeric(18,4) DEFAULT 0,
      min_stock_level integer DEFAULT 0, is_active boolean DEFAULT true
    );
  `)
  await setup.unsafe(m01)
  await setup.unsafe(m02)
  await setup.unsafe(m05)
  await setup.unsafe(m07)
  await setup.unsafe(m07)
  await setup`INSERT INTO workspaces VALUES (${PUB}), (${SHOP})`
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

let app: string
let keyN = 0
beforeEach(async () => {
  await db`DELETE FROM app_installations`
  await db`DELETE FROM api_request_logs`
  await db`DELETE FROM webhook_endpoints`
  await db`DELETE FROM api_keys`
  await db`UPDATE oauth_apps SET published_version_id = NULL`
  await db`DELETE FROM oauth_apps`
  await db`DELETE FROM app_publishers`
  const [row] = await db`
    INSERT INTO oauth_apps (owner_workspace_id, created_by, name, redirect_uris, requested_scopes, client_id,
                            client_secret_hash, slug, tagline, category, webhook_url, webhook_events)
    VALUES (${PUB}, ${DEV}, 'Shop sync', ${['https://app.example/cb']}, ${['read:products', 'read:invoices']},
            ${'hk_app_' + 'a'.repeat(32)}, ${'b'.repeat(64)}, 'shop-sync', 'Sync your shop', 'ecommerce',
            'https://app.example/hooks', ${['product.created']})
    RETURNING id`
  app = row!.id as string
  await db`SELECT rotate_app_webhook_secret(${app}, ${SECRET})`
})

const submit = (version: string) =>
  db`SELECT submit_app_version(${app}, ${DEV}, ${version}, 'Changes') AS id`
const publish = (id: string) => db`SELECT publish_app_version(${id}, ${ADMIN}, 'ok')`
const install = (
  version: string | null,
  scopes = ['read:products'],
  events = ['product.created'],
) =>
  db`SELECT * FROM install_oauth_app(${app}, ${SHOP}, ${OWNER}, ${version}, 'Shop sync', 'hk_live_x',
       ${(++keyN).toString(16).padStart(64, '0')}, ${scopes}, 'https://app.example/hooks', ${events})`

describe('marketplace', () => {
  it('ran twice after 01, 02 and 05, and every VERIFY row reads ok', async () => {
    const rows = await db.unsafe(verify)
    expect(rows.length).toBe(8)
    for (const row of rows)
      expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
  })

  it('a version is a snapshot of the draft; incomplete listings, a second review and older numbers are refused', async () => {
    await db`UPDATE oauth_apps SET tagline = '' WHERE id = ${app}`
    await expect(submit('1.0.0')).rejects.toThrow(/LISTING_INCOMPLETE/)
    await db`UPDATE oauth_apps SET tagline = 'Sync your shop' WHERE id = ${app}`

    const [{ id }] = (await submit('1.0.0')) as unknown as [{ id: string }]
    const [v] = await db`SELECT * FROM app_versions WHERE id = ${id}`
    expect(v).toMatchObject({
      version: '1.0.0',
      status: 'in_review',
      requested_scopes: ['read:products', 'read:invoices'],
      webhook_url: 'https://app.example/hooks',
      api_version: 'v1',
    })
    expect((await db`SELECT status FROM oauth_apps WHERE id = ${app}`)[0]!.status).toBe('in_review')
    await expect(submit('1.1.0')).rejects.toThrow(/VERSION_IN_REVIEW/)
    await publish(id)
    await expect(submit('1.0.0')).rejects.toThrow(/VERSION_NOT_NEWER/)
    await expect(submit('0.9.9')).rejects.toThrow(/VERSION_NOT_NEWER/)
    // 1.10.0 > 1.9.0: compared as numbers, not as text.
    const [{ id: v19 }] = (await submit('1.9.0')) as unknown as [{ id: string }]
    await publish(v19)
    expect((await submit('1.10.0')).length).toBe(1)
  })

  it('publishing supersedes the previous version; localhost never reaches everyone; rejection keeps a live app live', async () => {
    await db`UPDATE oauth_apps SET redirect_uris = ${['http://localhost:3000/cb']} WHERE id = ${app}`
    const [{ id: local }] = (await submit('1.0.0')) as unknown as [{ id: string }]
    await expect(publish(local)).rejects.toThrow(/VERSION_HAS_LOCALHOST/)
    await db`SELECT reject_app_version(${local}, ${ADMIN}, 'localhost')`
    expect((await db`SELECT status FROM oauth_apps WHERE id = ${app}`)[0]!.status).toBe('rejected')

    await db`UPDATE oauth_apps SET redirect_uris = ${['https://app.example/cb']} WHERE id = ${app}`
    const [{ id: first }] = (await submit('1.0.1')) as unknown as [{ id: string }]
    await publish(first)
    const [{ id: second }] = (await submit('1.1.0')) as unknown as [{ id: string }]
    await db`SELECT reject_app_version(${second}, ${ADMIN}, 'no')`
    const [a] = await db`SELECT status, published_version_id FROM oauth_apps WHERE id = ${app}`
    expect(a).toEqual({ status: 'published', published_version_id: first })

    const [{ id: third }] = (await submit('1.2.0')) as unknown as [{ id: string }]
    await publish(third)
    const statuses =
      await db`SELECT version, status FROM app_versions WHERE app_id = ${app} ORDER BY version`
    expect(statuses.map((r) => `${r.version}:${r.status}`)).toEqual([
      '1.0.0:rejected',
      '1.0.1:superseded',
      '1.1.0:rejected',
      '1.2.0:published',
    ])
  })

  it('install writes key, installation and a signed endpoint together; reinstall replaces the old one', async () => {
    const [first] = await install(null)
    const [inst] = await db`SELECT * FROM app_installations WHERE id = ${first!.installation_id}`
    expect(inst).toMatchObject({ status: 'active', key_id: first!.key_id })
    const [secret] =
      await db`SELECT secret FROM webhook_endpoint_secrets WHERE endpoint_id = ${inst!.endpoint_id}`
    expect(secret!.secret).toBe(SECRET)
    const [endpoint] =
      await db`SELECT workspace_id, events, description FROM webhook_endpoints WHERE id = ${inst!.endpoint_id}`
    expect(endpoint).toEqual({
      workspace_id: SHOP,
      events: ['product.created'],
      description: 'App: Shop sync',
    })

    const [second] = await install(null)
    const rows = await db`SELECT id, status FROM app_installations ORDER BY installed_at, status`
    expect(rows.map((r) => r.status).sort()).toEqual(['active', 'replaced'])
    const [oldKey] = await db`SELECT revoked_at FROM api_keys WHERE id = ${first!.key_id}`
    expect(oldKey!.revoked_at).not.toBeNull()
    expect((await db`SELECT count(*)::int AS n FROM webhook_endpoints`)[0]!.n).toBe(1)
    expect(second!.key_id).not.toBe(first!.key_id)
  })

  it('revoking the key from ANY path uninstalls: installation ended, endpoint gone', async () => {
    const [first] = await install(null)
    await db`UPDATE api_keys SET revoked_at = now(), revoked_by = ${OWNER} WHERE id = ${first!.key_id}`
    const [inst] =
      await db`SELECT status, ended_by, endpoint_id FROM app_installations WHERE id = ${first!.installation_id}`
    expect(inst).toEqual({ status: 'uninstalled', ended_by: OWNER, endpoint_id: null })
    expect((await db`SELECT count(*)::int AS n FROM webhook_endpoints`)[0]!.n).toBe(0)
  })

  it('update moves scopes and the endpoint together; a new app secret reaches every endpoint', async () => {
    const [first] = await install(null, ['read:products'], [])
    expect((await db`SELECT endpoint_id FROM app_installations`)[0]!.endpoint_id).toBeNull()
    await db`SELECT update_app_installation(${first!.installation_id}, ${OWNER}, NULL,
               ${['read:products', 'read:invoices']}, 'https://app.example/hooks', ${['invoice.created']})`
    expect((await db`SELECT scopes FROM api_keys WHERE id = ${first!.key_id}`)[0]!.scopes).toEqual([
      'read:products',
      'read:invoices',
    ])
    const [inst] =
      await db`SELECT endpoint_id FROM app_installations WHERE id = ${first!.installation_id}`
    expect(inst!.endpoint_id).not.toBeNull()

    await db`SELECT rotate_app_webhook_secret(${app}, ${'n'.repeat(40)})`
    const [secret] =
      await db`SELECT secret FROM webhook_endpoint_secrets WHERE endpoint_id = ${inst!.endpoint_id}`
    expect(secret!.secret).toBe('n'.repeat(40))

    await db`SELECT update_app_installation(${first!.installation_id}, ${OWNER}, NULL, ${['read:products']}, NULL, ${[]})`
    expect((await db`SELECT count(*)::int AS n FROM webhook_endpoints`)[0]!.n).toBe(0)
    await expect(
      db`SELECT update_app_installation(${first!.installation_id}, ${OWNER}, NULL, ${[]}, NULL, ${[]})`,
    ).rejects.toThrow(/NO_SCOPE_GRANTED/)
  })

  it('a verified badge does not survive a name change — unless the admin sets it in the same statement', async () => {
    await db`INSERT INTO app_publishers (workspace_id, display_name) VALUES (${PUB}, 'Acme')`
    await db`UPDATE app_publishers SET verified_at = now(), verified_by = ${ADMIN} WHERE workspace_id = ${PUB}`
    await db`UPDATE app_publishers SET bio = 'We build things' WHERE workspace_id = ${PUB}`
    expect((await db`SELECT verified_at FROM app_publishers`)[0]!.verified_at).not.toBeNull()
    await db`UPDATE app_publishers SET display_name = 'Acme Bank' WHERE workspace_id = ${PUB}`
    expect((await db`SELECT verified_at, verified_by FROM app_publishers`)[0]).toEqual({
      verified_at: null,
      verified_by: null,
    })
  })

  it('the numbers are exact: requests, errors, installs, and ratings without hidden reviews', async () => {
    const [first] = await install(null)
    for (const status of [200, 200, 404, 500]) {
      await db`INSERT INTO api_request_logs (workspace_id, key_id, method, route, status, duration_ms)
               VALUES (${SHOP}, ${first!.key_id}, 'GET', '/api/products', ${status}, 10)`
    }
    const usage = await db`SELECT * FROM oauth_app_usage(${app}, 7)`
    expect(usage.length).toBe(1)
    expect(usage[0]).toMatchObject({
      requests: '4',
      client_errors: '1',
      server_errors: '1',
      avg_ms: 10,
    })
    const [stats] = await db`SELECT * FROM oauth_app_stats(${app}, 30)`
    expect(stats).toMatchObject({
      active_installs: '1',
      installs_in_period: '1',
      requests_24h: '4',
      server_errors_24h: '1',
    })

    await db`INSERT INTO app_reviews (app_id, workspace_id, user_id, rating) VALUES (${app}, ${SHOP}, ${OWNER}, 4)`
    await db`INSERT INTO app_reviews (app_id, workspace_id, user_id, rating, hidden_at) VALUES (${app}, ${PUB}, ${DEV}, 1, now())`
    const [listing] = await db`SELECT * FROM oauth_app_listing_stats(${[app]})`
    expect(listing).toMatchObject({
      reviews: '1',
      average: '4.00',
      stars: ['0', '0', '0', '1', '0'],
      active_installs: '1',
    })
  })

  it('money is minor units, and a paid listing must say all of its price', async () => {
    await expect(
      db`UPDATE oauth_apps SET pricing_model = 'paid' WHERE id = ${app}`,
    ).rejects.toThrow(/check/)
    await db`UPDATE oauth_apps SET pricing_model = 'paid', price_minor = 50000, price_currency = 'AFN',
             price_interval = 'month' WHERE id = ${app}`
    await expect(db`UPDATE oauth_apps SET price_minor = 0 WHERE id = ${app}`).rejects.toThrow(
      /check/,
    )
  })

  it('no client can call the functions or read the secrets', async () => {
    const asClient = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
      db.begin(async (tx) => {
        await tx.unsafe('SET LOCAL ROLE authenticated')
        await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${OWNER}'`)
        return fn(tx)
      })
    await expect(
      asClient((tx) => tx`SELECT submit_app_version(${app}, ${DEV}, '9.9.9', 'x')`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asClient((tx) => tx`SELECT secret FROM oauth_app_webhook_secrets`),
    ).rejects.toThrow(/permission denied/)
  })
})
