// ============================================
// docs/core-divergence-migration.sql run unchanged (TWICE) in a real Postgres,
// then docs/VERIFY-core-divergence.sql — and the isolation rule only the
// database can prove: a divergence row written for one business is invisible to
// a signed-in member of another.
//
// ⚠️ WHY THIS FILE EXISTS.
//
// The previous policy read `current_setting('app.current_workspace_id')`, which
// nothing in this codebase sets. On a bare Postgres that policy still CREATES
// cleanly, so a migration test that only ran the file would have passed while
// every real read was denied. The test below inserts a row as the table owner,
// then reads as `authenticated` with a real `auth.uid()` — the membership chain
// every other table uses — and asserts both the positive and the negative.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

// ⚠️ TWO WAYS TO RUN THIS FILE, AND BOTH ARE HONEST ABOUT WHAT THEY PROVED.
//
//   1. DEFAULT — an embedded Postgres started here. Works on a machine whose
//      `%TEMP%` is writable and which permits a Postgres shared-memory segment.
//      On this machine it does not: `initdb` cannot chmod `%TEMP%`
//      («could not change permissions of directory … Permission denied») and the
//      server then dies with «could not create shared memory segment: error code
//      1314». Both are environment limits, not product defects — the PRE-EXISTING
//      pg suites fail identically.
//
//   2. `HISABCHE_PG_URL=postgres://…` — point the same tests at a REAL Postgres
//      (a scratch database; this file creates its own tables and roles). That is
//      the way to close the item: `pnpm exec vitest run …/core-divergence.pg.test.ts`
//      with the variable set, on any machine.
//
// When a real URL is supplied the embedded server is never started, so this file
// makes no assumptions about the local Postgres installation.
const EXTERNAL_URL = process.env.HISABCHE_PG_URL
const PORT = EXTERNAL_URL ? 0 : freePortSync()
const dir = EXTERNAL_URL ? '' : pgTempDir('hisabche-pg-divergence-')

const pg = EXTERNAL_URL
  ? null
  : new EmbeddedPostgres({
      databaseDir: dir,
      port: PORT,
      user: 'postgres',
      password: 'test',
      persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      createPostgresUser: process.getuid?.() === 0,
    })

const url = EXTERNAL_URL ?? `postgres://postgres:test@localhost:${PORT}/divergence`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

// Two businesses, and one person who belongs to each — the shape RLS must tell
// apart.
const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const USER_NONE = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  // Only start (and create) a server when none was supplied. Against a real
  // Postgres the DATABASE must already exist — this file does not create it,
  // because creating databases needs a role the caller may not have.
  if (pg) {
    await pg.initialise()
    await pg.start()
    await pg.createDatabase('divergence')
  }
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    -- ⚠️ As on Supabase: every new table arrives already granted to the three
    -- API roles. Without this, a migration that never revokes anon would pass
    -- here and leak there.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

    -- The membership chain the policy reads.
    CREATE TABLE IF NOT EXISTS public.workspace_members (
      workspace_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role text NOT NULL DEFAULT 'owner',
      has_access boolean NOT NULL DEFAULT true,
      suspended_at timestamptz,
      PRIMARY KEY (workspace_id, user_id)
    );

    -- Supabase exposes the request's user as auth.uid(). The policy is written
    -- against it, so the test must provide the same function.
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `)

  // ── the migration, run TWICE, unchanged ──────────────────────────────────
  await setup.unsafe(read('core-divergence-migration.sql'))
  await setup.unsafe(read('core-divergence-migration.sql'))

  await setup.unsafe(`
    INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access)
    VALUES
      ('${WS_A}', '${USER_A}', 'owner', true),
      ('${WS_B}', '${USER_B}', 'owner', true),
      -- A member who has been suspended: still a row, no access.
      ('${WS_B}', '${USER_A}', 'member', true);
    UPDATE public.workspace_members SET suspended_at = now()
      WHERE workspace_id = '${WS_B}' AND user_id = '${USER_A}';
  `)
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  // ⚠️ TEARDOWN MUST NOT HANG WHEN SETUP FAILED. If `beforeAll` threw (initdb
  // refused the directory, or Postgres died on start), `pg.stop()` waits on a
  // process that never came up and the file reports «Hook timed out in 60000ms»
  // instead of the real cause — a misleading red on top of a real one. Bounded,
  // and the first error still surfaces.
  try {
    await sql?.end({ timeout: 5 })
  } catch {
    // the connection was never made
  }
  try {
    // `pg` is null when a real database was supplied — nothing to stop.
    if (pg) {
      await Promise.race([
        pg.stop(),
        new Promise((resolve) => setTimeout(resolve, 10_000).unref?.()),
      ])
    }
  } catch {
    // the server was never started
  }
  if (dir) rmSync(dir, { recursive: true, force: true })
})

const record = (workspaceId: string, capability = 'invoice.create') =>
  sql`INSERT INTO public.core_divergence ${sql({
    workspace_id: workspaceId,
    capability,
    command: 'POST /api/invoices',
    command_payload: sql.json({ total: 100 }),
    expected_output: sql.json({ total: 100 }),
    actual_output: sql.json({ total: 99 }),
    diff_summary: 'DIVERGENCE: core 99 vs server 100',
  })} RETURNING id`

/** Count as a signed-in user, through RLS, the way the app asks. */
const countAs = (userId: string) =>
  sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`
    await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
    const rows = await tx`SELECT count(*)::int AS n FROM public.core_divergence`
    return rows[0]!.n as number
  })

describe('core-divergence migration — run twice, then proved against real RLS', () => {
  it('is idempotent: the second run changed nothing and did not error', async () => {
    const [table] = await sql`
      SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'core_divergence'`
    expect(table!.n).toBe(1)

    // Exactly one policy — a second run must not stack a duplicate.
    const policies = await sql`
      SELECT policyname FROM pg_policies WHERE tablename = 'core_divergence'`
    expect(policies.map((p) => p.policyname)).toEqual(['core_divergence_workspace_members'])
  })

  it('VERIFY file reports a membership-chain policy and no phantom setting', async () => {
    // `sql.unsafe` over a multi-statement file returns one array per statement;
    // the policy check is the array whose rows carry `uses_membership_chain`.
    const resultSets = await sql.unsafe(read('VERIFY-core-divergence.sql'))
    const policy = resultSets.find((rows) => rows[0]?.uses_membership_chain !== undefined)?.[0]
    expect(policy?.uses_membership_chain).toBe(true)
    expect(policy?.uses_phantom_setting).toBe(false)

    const grants = resultSets.find((rows) => rows[0]?.anon_privileges !== undefined)?.[0]
    expect(Number(grants?.anon_privileges)).toBe(0)
    expect(Number(grants?.authenticated_write_privileges)).toBe(0)
  })

  it('⚠️ anon cannot reach tenant evidence at all', async () => {
    const grants = await sql`
      SELECT count(*)::int AS n FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = 'core_divergence'
         AND grantee = 'anon'`
    expect(grants[0]!.n).toBe(0)

    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE anon`
        await tx`SELECT count(*) FROM public.core_divergence`
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('a member reads their own business’s rows, and only those', async () => {
    await record(WS_A)
    await record(WS_B)

    expect(await countAs(USER_A)).toBe(1)
    expect(await countAs(USER_B)).toBe(1)
  })

  it('someone who is a member of nothing reads nothing', async () => {
    expect(await countAs(USER_NONE)).toBe(0)
  })

  it('⚠️ a suspended membership grants nothing, even though the row exists', async () => {
    // USER_A is still listed in workspace B, but suspended. The membership
    // chain says `suspended_at IS NULL`, and this is the assertion that proves
    // the policy copies that clause instead of just joining the table.
    const rows = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
      return tx`SELECT workspace_id FROM public.core_divergence`
    })
    expect(rows.map((r) => r.workspace_id)).toEqual([WS_A])
  })

  it('a member cannot write a row into somebody else’s business', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
        await tx`INSERT INTO public.core_divergence ${tx({
          workspace_id: WS_B,
          capability: 'invoice.create',
          command: 'POST /api/invoices',
          command_payload: tx.json({}),
          expected_output: tx.json({}),
          actual_output: tx.json({}),
          diff_summary: 'cross-tenant write',
        })}`
      }),
    ).rejects.toThrow(/row-level security|violates/)
  })

  it('the service role — not subject to RLS — can read the whole report', async () => {
    const counts = await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE service_role`
      return tx`SELECT count(*)::int AS n FROM public.core_divergence`
    })
    expect(counts[0]!.n).toBeGreaterThanOrEqual(2)
  })
})
