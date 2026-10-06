// ============================================
// Developer platform 06b — docs/developer-platform-06b-sandbox-access-migration.sql,
// run unchanged (twice) in a real Postgres, then its VERIFY query.
//
// What only the database can prove: that the owner of a new sandbox is a member
// the server lets in EVEN WHEN the column default is missing (the live drift
// docs/FIX-403.sql was written for); that an already-broken sandbox is repaired,
// by the migration and by pressing the button again; and that nobody else's
// membership, and no suspension, is touched.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 58000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev6b-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev6b`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m06 = readFileSync(join(DOCS, 'developer-platform-06-sandbox-migration.sql'), 'utf8')
const m06b = readFileSync(join(DOCS, 'developer-platform-06b-sandbox-access-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-06b.sql'), 'utf8')
const finding = readFileSync(join(DOCS, 'FINDING-sandbox-403.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const WS2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const OWNER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const SUSPENDED = '33333333-3333-3333-3333-333333333333'

/** What the server asks before letting a person into a workspace. */
const letsIn = async (workspace: string, user: string) => {
  const rows = await db`
    SELECT 1 FROM workspace_members
     WHERE workspace_id = ${workspace} AND user_id = ${user}
       AND has_access = true AND suspended_at IS NULL`
  return rows.length === 1
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev6b')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    CREATE TABLE public.workspaces (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL, slug text NOT NULL, description text, logo_url text,
      owner_id uuid NOT NULL, is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), stamp_url text
    );
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      user_id uuid NOT NULL, role text NOT NULL,
      -- The drift: the column with NO default.
      has_access boolean, suspended_at timestamptz
    );
  `)
  await setup.unsafe(m06)
  await setup.unsafe(m06)
  await setup`INSERT INTO workspaces (id, name, slug, owner_id) VALUES (${WS}, 'Shop', 'shop', ${OWNER}), (${WS2}, 'Second', 'second', ${SUSPENDED})`
  await setup`INSERT INTO workspace_members (workspace_id, user_id, role, has_access) VALUES
    (${WS}, ${OWNER}, 'owner', true), (${WS}, ${OTHER}, 'manager', false), (${WS2}, ${SUSPENDED}, 'owner', true)`
  // Sandboxes made by the OLD function: the reported state.
  await setup`SELECT * FROM create_sandbox_workspace(${WS}, ${OWNER})`
  await setup`SELECT * FROM create_sandbox_workspace(${WS2}, ${SUSPENDED})`
  await setup`UPDATE workspace_members m SET suspended_at = now(), has_access = false
               FROM workspaces w WHERE w.id = m.workspace_id AND w.is_sandbox AND m.user_id = ${SUSPENDED}`
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

describe('before 06b — the reported state', () => {
  it('the old function made a sandbox its own owner cannot open', async () => {
    const [sandbox] = await db`SELECT id FROM workspaces WHERE sandbox_of = ${WS}`
    expect(await letsIn(sandbox!.id, OWNER)).toBe(false)
  })

  it('the FINDING query shows it', async () => {
    const rows = await db.unsafe(finding.split(';')[0] as string)
    const mine = rows.find((row) => row.real_business_id === WS)
    expect(mine).toMatchObject({ owner_has_membership_row: true, server_lets_owner_in: false })
  })
})

describe('06b', () => {
  it('runs twice', async () => {
    // The file opens its own transaction: one connection, as the SQL Editor has.
    const one = postgres(url, { max: 1, onnotice: () => {} })
    await one.unsafe(m06b)
    await one.unsafe(m06b)
    await one.end()
  })

  it('repairs the sandbox that already exists', async () => {
    const [sandbox] = await db`SELECT id FROM workspaces WHERE sandbox_of = ${WS}`
    expect(await letsIn(sandbox!.id, OWNER)).toBe(true)
  })

  it('touches nobody else: a member without access in the real business stays without', async () => {
    expect(await letsIn(WS, OTHER)).toBe(false)
    const [row] =
      await db`SELECT has_access FROM workspace_members WHERE workspace_id = ${WS} AND user_id = ${OTHER}`
    expect(row!.has_access).toBe(false)
  })

  it('has_access is repaired but a suspension stays a suspension', async () => {
    const [sandbox] = await db`SELECT id FROM workspaces WHERE sandbox_of = ${WS2}`
    const [row] =
      await db`SELECT suspended_at FROM workspace_members WHERE workspace_id = ${sandbox!.id}`
    expect(row!.suspended_at).not.toBeNull()
    expect(await letsIn(sandbox!.id, SUSPENDED)).toBe(false)
  })

  it('a NEW sandbox lets its owner in with no column default to lean on', async () => {
    await db`INSERT INTO workspaces (id, name, slug, owner_id) VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'Third', 'third', ${OTHER})`
    await db`INSERT INTO workspace_members (workspace_id, user_id, role, has_access) VALUES ('aaaaaaaa-0000-0000-0000-000000000003', ${OTHER}, 'owner', true)`
    const [made] =
      await db`SELECT * FROM create_sandbox_workspace('aaaaaaaa-0000-0000-0000-000000000003', ${OTHER})`
    expect(made!.created).toBe(true)
    expect(await letsIn(made!.id, OTHER)).toBe(true)
  })

  it('pressing the button again heals a sandbox that was broken afterwards', async () => {
    const [sandbox] = await db`SELECT id FROM workspaces WHERE sandbox_of = ${WS}`
    await db`UPDATE workspace_members SET has_access = NULL WHERE workspace_id = ${sandbox!.id}`
    const [again] = await db`SELECT * FROM create_sandbox_workspace(${WS}, ${OWNER})`
    expect(again).toMatchObject({ id: sandbox!.id, created: false })
    expect(await letsIn(sandbox!.id, OWNER)).toBe(true)
  })

  it('VERIFY answers ok, and no client can call the function', async () => {
    const [row] = await db.unsafe(verify)
    expect(row).toMatchObject({
      function_sets_has_access: true,
      clients_cannot_call: true,
      ok: true,
    })
    expect(Number(row!.sandboxes_without_owner_row)).toBe(0)
    // Counts the access flag only: a suspension is a decision, not this fault.
    expect(Number(row!.sandboxes_owner_refused)).toBe(0)
  })
})
