// ============================================
// docs/workspace-access-rpc-migration.sql run unchanged (twice) in a real
// Postgres, then docs/VERIFY-workspace-access-rpc.sql on the result.
//
// What only a real database proves: the function compiles, answers with the
// same memberships the old read returns, reads the capability / page-block
// tables only when they exist, never chooses a workspace the user is not an
// active member of, and cannot be executed by a client role.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-access-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/access`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'workspace-access-rpc-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-workspace-access-rpc.sql'), 'utf8')

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WS_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

type Access = {
  memberships: Array<{ workspace_id: string; role: string }>
  workspace_id: string | null
  overrides: Array<{ role: string; capability: string; granted: boolean }>
  blocks: string[]
}

async function access(user: string, workspace: string | null): Promise<Access> {
  const [row] = await sql<
    { r: Access }[]
  >`SELECT public.resolve_workspace_access(${user}::uuid, ${workspace}::uuid) AS r`
  return row!.r
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('access')
  sql = postgres(url, { max: 2, onnotice: () => {} })
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.workspace_members (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id uuid, user_id uuid NOT NULL, role text,
      has_access boolean DEFAULT true, suspended_at timestamptz,
      joined_at timestamptz DEFAULT now()
    );
  `)
  // Twice: the migration must be re-runnable.
  await sql.unsafe(migration)
  await sql.unsafe(migration)

  await sql.unsafe(`
    INSERT INTO workspace_members (workspace_id, user_id, role, has_access, suspended_at, joined_at) VALUES
      ('${WS_A}', '${USER}', 'owner',  true,  NULL,  now() - interval '2 days'),
      ('${WS_B}', '${USER}', 'seller', true,  NULL,  now() - interval '1 day'),
      ('${WS_C}', '${USER}', 'manager', false, NULL, now()),          -- access revoked
      ('${WS_C}', '${OTHER}', 'owner', true,  now(), now());          -- suspended
  `)
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('resolve_workspace_access — real Postgres', () => {
  it('memberships are the active, unsuspended ones, oldest first', async () => {
    const r = await access(USER, null)
    expect(r.memberships.map((m) => m.workspace_id)).toEqual([WS_A, WS_B])
    // Two memberships and none named: the function does not choose.
    expect(r.workspace_id).toBeNull()
  })

  it('a named workspace is chosen only if the user is an active member of it', async () => {
    expect((await access(USER, WS_B)).workspace_id).toBe(WS_B)
    expect((await access(USER, WS_C)).workspace_id).toBeNull() // has_access = false
    expect((await access(OTHER, WS_C)).workspace_id).toBeNull() // suspended
    expect((await access(OTHER, null)).memberships).toEqual([])
  })

  it('before the capability / page-block migrations: no rows, not an error', async () => {
    const r = await access(USER, WS_A)
    expect(r.overrides).toEqual([])
    expect(r.blocks).toEqual([])
  })

  it('reads overrides for the CHOSEN workspace and blocks for THIS user only', async () => {
    await sql.unsafe(`
      CREATE TABLE public.workspace_role_capabilities (
        workspace_id uuid NOT NULL, role text NOT NULL, capability text NOT NULL, granted boolean NOT NULL
      );
      CREATE TABLE public.workspace_member_module_blocks (
        workspace_id uuid NOT NULL, user_id uuid NOT NULL, module_key text NOT NULL
      );
      INSERT INTO workspace_role_capabilities VALUES
        ('${WS_B}', 'seller', 'ledger.read', true),
        ('${WS_A}', 'seller', 'ledger.read', false);
      INSERT INTO workspace_member_module_blocks VALUES
        ('${WS_B}', '${USER}', 'accounting'),
        ('${WS_B}', '${OTHER}', 'invoices'),
        ('${WS_A}', '${USER}', 'reports');
    `)
    const r = await access(USER, WS_B)
    expect(r.overrides).toEqual([{ role: 'seller', capability: 'ledger.read', granted: true }])
    expect(r.blocks).toEqual(['accounting'])

    // A workspace the user may not open reads nothing at all.
    const refused = await access(USER, WS_C)
    expect(refused.overrides).toEqual([])
    expect(refused.blocks).toEqual([])
  })

  it('VERIFY-workspace-access-rpc.sql: every check is ok', async () => {
    const results = await sql.unsafe(verify).simple()
    const rows = (results as unknown as Array<Array<{ check: string; ok: boolean }>>).flat()
    expect(rows.length).toBeGreaterThanOrEqual(7)
    expect(rows.filter((r) => r.ok !== true)).toEqual([])
  })
})
