// ============================================
// Developer platform 06 — docs/developer-platform-06-sandbox-migration.sql,
// run unchanged (twice) in a real Postgres, then its VERIFY query.
//
// What only the database can prove: that a sandbox and its owner membership
// are written together or not at all; one per (business, person) even when
// two requests race; that a sandbox never becomes real books (nor the
// reverse); that a sandbox cannot have one; and that no client can create one.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev6-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev6`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m06 = readFileSync(join(DOCS, 'developer-platform-06-sandbox-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-06.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const OWNER = '11111111-1111-1111-1111-111111111111'
const MANAGER = '22222222-2222-2222-2222-222222222222'
const OUTSIDER = '99999999-9999-9999-9999-999999999999'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev6')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  // The base schema's shape of the two tables (docs/SETUP-COMPLETE.sql).
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE TABLE public.workspaces (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL, slug text NOT NULL, description text, logo_url text,
      owner_id uuid NOT NULL, is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), stamp_url text
    );
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      user_id uuid NOT NULL, role text NOT NULL,
      has_access boolean DEFAULT true, suspended_at timestamptz
    );
  `)
  await setup.unsafe(m06)
  await setup.unsafe(m06)
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await db`DELETE FROM workspace_members`
  await db`UPDATE workspaces SET sandbox_of = NULL`
  await db`DELETE FROM workspaces`
  await db`INSERT INTO workspaces (id, name, slug, owner_id) VALUES (${WS}, 'Shop', 'shop', ${OWNER})`
  await db`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${WS}, ${OWNER}, 'owner'), (${WS}, ${MANAGER}, 'manager')`
})

const create = (parent: string, user: string) =>
  db`SELECT * FROM create_sandbox_workspace(${parent}, ${user})`

describe('sandbox workspaces', () => {
  it('ran twice, and every VERIFY row reads ok (before and after a sandbox exists)', async () => {
    for (const round of [0, 1]) {
      if (round === 1) await create(WS, OWNER)
      const rows = await db.unsafe(verify)
      expect(rows.length).toBe(6)
      for (const row of rows)
        expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
    }
  })

  it('creates the sandbox and its owner membership together, then returns the same one', async () => {
    const [first] = await create(WS, OWNER)
    expect(first).toMatchObject({ name: 'Shop (sandbox)', created: true })
    const [ws] =
      await db`SELECT is_sandbox, sandbox_of, owner_id FROM workspaces WHERE id = ${first!.id}`
    expect(ws).toEqual({ is_sandbox: true, sandbox_of: WS, owner_id: OWNER })
    const members =
      await db`SELECT user_id, role FROM workspace_members WHERE workspace_id = ${first!.id}`
    expect(members).toEqual([{ user_id: OWNER, role: 'owner' }])

    const [again] = await create(WS, OWNER)
    expect(again).toMatchObject({ id: first!.id, created: false })
  })

  it('one per business and person — even when two requests race; each manager gets their own', async () => {
    const [a, b] = await Promise.all([create(WS, OWNER), create(WS, OWNER)])
    expect(a![0]!.id).toBe(b![0]!.id)
    expect([a![0]!.created, b![0]!.created].sort()).toEqual([false, true])
    const [mine] = await create(WS, MANAGER)
    expect(mine!.id).not.toBe(a![0]!.id)
    expect(
      (await db`SELECT count(*)::int AS n FROM workspaces WHERE sandbox_of = ${WS}`)[0]!.n,
    ).toBe(2)
  })

  it('refuses: a sandbox of a sandbox, an outsider, an unknown business', async () => {
    const [sandbox] = await create(WS, OWNER)
    await expect(create(sandbox!.id, OWNER)).rejects.toThrow(/SANDBOX_OF_SANDBOX/)
    await expect(create(WS, OUTSIDER)).rejects.toThrow(/SANDBOX_NOT_MEMBER/)
    await expect(create('00000000-0000-0000-0000-000000000000', OWNER)).rejects.toThrow(
      /SANDBOX_PARENT_NOT_FOUND/,
    )
    // Nothing half-written by the refusals.
    expect((await db`SELECT count(*)::int AS n FROM workspaces`)[0]!.n).toBe(2)
  })

  it('a workspace never changes sides — and a deleted business leaves its sandbox a sandbox', async () => {
    const [sandbox] = await create(WS, OWNER)
    await expect(
      db`UPDATE workspaces SET is_sandbox = false WHERE id = ${sandbox!.id}`,
    ).rejects.toThrow(/SANDBOX_FLAG_IS_PERMANENT/)
    await expect(db`UPDATE workspaces SET is_sandbox = true WHERE id = ${WS}`).rejects.toThrow(
      /SANDBOX_FLAG_IS_PERMANENT/,
    )
    await expect(
      db`UPDATE workspaces SET sandbox_of = ${sandbox!.id} WHERE id = ${WS}`,
    ).rejects.toThrow(/check/)
    await db`DELETE FROM workspace_members WHERE workspace_id = ${WS}`
    await db`DELETE FROM workspaces WHERE id = ${WS}`
    const [left] = await db`SELECT is_sandbox, sandbox_of FROM workspaces WHERE id = ${sandbox!.id}`
    expect(left).toEqual({ is_sandbox: true, sandbox_of: null })
  })

  it('no client can create one', async () => {
    await expect(
      db.begin(async (tx) => {
        await tx.unsafe('SET LOCAL ROLE authenticated')
        return tx`SELECT * FROM create_sandbox_workspace(${WS}, ${OWNER})`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
