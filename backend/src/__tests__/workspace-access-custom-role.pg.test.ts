// ============================================
// docs/workspace-access-rpc-02-custom-role-migration.sql run unchanged (twice)
// in a real Postgres, on top of the first RPC migration, then its VERIFY.
//
// What only a real database proves: the function still compiles and answers as
// before for everybody without a custom role; it returns the role's grants for
// somebody who holds one; ONLY a role owned by the chosen workspace counts
// (never a shared template, never another business's role); the newest
// assignment wins; and a database with no RBAC tables answers `null`, not an
// error.
//
// …and what the backend does with that answer: a custom role REPLACES the base
// role's set — the bug it ends is a role that changed nothing.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { customRoleAccess, capabilitiesOf } from '../services/authorization/authorization.domain'
import { resolveEffectiveAccess } from '../services/authorization/workspace-access.service'

const PORT = 58900 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-access2-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/access2`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const first = readFileSync(join(DOCS, 'workspace-access-rpc-migration.sql'), 'utf8')
const second = readFileSync(join(DOCS, 'workspace-access-rpc-02-custom-role-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-workspace-access-rpc-02.sql'), 'utf8')

const KEEPER = '11111111-1111-4111-8111-111111111111'
const PLAIN = '22222222-2222-4222-8222-222222222222'
const TEMPLATED = '33333333-3333-4333-8333-333333333333'
const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const ROLE_KEEPER = 'c0000000-0000-4000-8000-000000000001' // made by WS_A
const ROLE_OLDER = 'c0000000-0000-4000-8000-000000000002' // made by WS_A, assigned earlier
const ROLE_OF_B = 'c0000000-0000-4000-8000-000000000003' // made by WS_B
const ROLE_TEMPLATE = 'c0000000-0000-4000-8000-000000000004' // shared, workspace_id NULL

type Access = {
  workspace_id: string | null
  custom_role?: { id: string; capabilities: string[] } | null
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
  await pg.createDatabase('access2')
  sql = postgres(url, { max: 2, onnotice: () => {} })
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    CREATE TABLE public.workspace_members (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      workspace_id uuid, user_id uuid NOT NULL, role text,
      has_access boolean DEFAULT true, suspended_at timestamptz,
      joined_at timestamptz DEFAULT now()
    );
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('${WS_A}', '${KEEPER}', 'seller'),
      ('${WS_A}', '${PLAIN}', 'seller'),
      ('${WS_A}', '${TEMPLATED}', 'seller'),
      ('${WS_B}', '${KEEPER}', 'seller');
  `)
  await sql.unsafe(first)
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('before the RBAC tables exist', () => {
  it('runs twice and answers «no custom role», not an error', async () => {
    await sql.unsafe(second)
    await sql.unsafe(second)
    const r = await access(KEEPER, WS_A)
    expect(r.workspace_id).toBe(WS_A)
    // Present and null: the backend can tell «none» from «did not look».
    expect(r).toHaveProperty('custom_role', null)
  })
})

describe('with roles', () => {
  beforeAll(async () => {
    await sql.unsafe(`
      CREATE TABLE public.roles (
        id uuid PRIMARY KEY, code text, name text, is_system boolean DEFAULT false, workspace_id uuid
      );
      CREATE TABLE public.permissions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, code text UNIQUE);
      CREATE TABLE public.role_permissions (role_id uuid NOT NULL, permission_id uuid NOT NULL);
      CREATE TABLE public.user_roles (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL, role_id uuid NOT NULL, workspace_id uuid,
        created_at timestamp DEFAULT now()
      );
      INSERT INTO roles (id, code, name, is_system, workspace_id) VALUES
        ('${ROLE_KEEPER}', 'custom_keeper', 'انباردار', false, '${WS_A}'),
        ('${ROLE_OLDER}', 'custom_older', 'قدیمی', false, '${WS_A}'),
        ('${ROLE_OF_B}', 'custom_b', 'نقش کسب‌وکار دیگر', false, '${WS_B}'),
        ('${ROLE_TEMPLATE}', 'accountant', 'حسابدار', true, NULL);
      INSERT INTO permissions (code) VALUES
        ('inventory.read'), ('product.read'), ('product.write'), ('ledger.read'), ('invoice.read');
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT '${ROLE_KEEPER}', id FROM permissions WHERE code IN ('inventory.read', 'product.read', 'product.write');
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT '${ROLE_OLDER}', id FROM permissions WHERE code = 'invoice.read';
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT '${ROLE_TEMPLATE}', id FROM permissions WHERE code = 'ledger.read';
      INSERT INTO role_permissions (role_id, permission_id)
        SELECT '${ROLE_OF_B}', id FROM permissions WHERE code = 'ledger.read';
      INSERT INTO user_roles (user_id, role_id, workspace_id, created_at) VALUES
        ('${KEEPER}', '${ROLE_OLDER}', '${WS_A}', now() - interval '3 days'),
        ('${KEEPER}', '${ROLE_KEEPER}', '${WS_A}', now()),
        -- a shared template assigned to a person: grants nothing here
        ('${TEMPLATED}', '${ROLE_TEMPLATE}', '${WS_A}', now()),
        -- another business's role, named in THIS workspace's row: never counts
        ('${PLAIN}', '${ROLE_OF_B}', '${WS_A}', now());
    `)
    // Again, now that the tables exist: still re-runnable.
    await sql.unsafe(second)
  })

  it('returns the grants of the role the person holds — the newest assignment', async () => {
    const r = await access(KEEPER, WS_A)
    expect(r.custom_role?.id).toBe(ROLE_KEEPER)
    expect([...(r.custom_role?.capabilities ?? [])].sort()).toEqual([
      'inventory.read',
      'product.read',
      'product.write',
    ])
  })

  it('a role belongs to ONE business: in another workspace the same person has none', async () => {
    expect((await access(KEEPER, WS_B)).custom_role).toBeNull()
  })

  it('a shared template, and another business’s role, never count', async () => {
    expect((await access(TEMPLATED, WS_A)).custom_role).toBeNull()
    expect((await access(PLAIN, WS_A)).custom_role).toBeNull()
  })

  it('VERIFY answers ok, and no client role can call the function', async () => {
    const [row] = await sql.unsafe(verify)
    expect(row).toMatchObject({
      returns_custom_role: true,
      only_own_workspace_roles: true,
      clients_cannot_call: true,
      backend_can_call: true,
      ok: true,
    })
    expect(Number(row!.people_holding_one)).toBe(2)
  })
})

describe('what the backend makes of it', () => {
  const sellerDefaults = capabilitiesOf('seller')

  it('⚠️ a custom role REPLACES the base role — it used to change nothing', () => {
    const access = resolveEffectiveAccess({
      role: 'seller',
      overrides: [],
      blocks: [],
      customRole: ['inventory.read', 'product.read', 'product.write'],
    })
    // What the role grants…
    expect(access.capabilities.has('product.write')).toBe(true)
    // …and NOT what a seller would otherwise hold.
    expect(sellerDefaults).toContain('invoice.create')
    expect(access.capabilities.has('invoice.create')).toBe(false)
    expect(access.hiddenModules).toContain('invoices')
    expect(access.hiddenModules).not.toContain('inventory')
  })

  it('the owner is never narrowed by a role, and nobody without one changes', () => {
    const owner = resolveEffectiveAccess({
      role: 'owner',
      overrides: [],
      blocks: [],
      customRole: [],
    })
    expect(owner.capabilities.has('ledger.lock_period')).toBe(true)
    expect(owner.hiddenModules).toEqual([])

    const plain = resolveEffectiveAccess({
      role: 'seller',
      overrides: [],
      blocks: [],
      customRole: null,
    })
    expect([...plain.capabilities].sort()).toEqual([...sellerDefaults].sort())
  })

  it('an EMPTY role is the floor only — not «no role», which would be the seller defaults', () => {
    const empty = resolveEffectiveAccess({
      role: 'seller',
      overrides: [],
      blocks: [],
      customRole: [],
    })
    expect([...empty.capabilities]).toEqual(['report.operational.read'])
  })

  it('a module the role has keeps the reads its forms cannot work without — and stays the only page seen', () => {
    const cashier = customRoleAccess(['invoice.read', 'invoice.create'])
    // The invoice form picks a product and a customer.
    expect(cashier.capabilities.has('product.read')).toBe(true)
    expect(cashier.capabilities.has('customer.read')).toBe(true)
    // Reading a list for a form is not seeing the page.
    expect(cashier.hiddenModules).toContain('inventory')
    expect(cashier.hiddenModules).toContain('parties')
    // …and never a write.
    expect(cashier.capabilities.has('product.write')).toBe(false)
  })

  it('the owner’s per-person block still narrows a custom role', () => {
    const access = resolveEffectiveAccess({
      role: 'seller',
      overrides: [],
      blocks: ['inventory'],
      customRole: ['inventory.read', 'product.read', 'product.write', 'invoice.read'],
    })
    expect(access.capabilities.has('product.write')).toBe(false)
    expect(access.capabilities.has('invoice.read')).toBe(true)
  })

  it('a code the server no longer knows is dropped, not trusted', () => {
    const access = customRoleAccess(['invoice.read', 'made.up.capability'])
    expect([...access.capabilities]).not.toContain('made.up.capability')
  })
})
