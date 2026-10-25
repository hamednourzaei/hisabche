// ============================================
// scripts/verify-core-divergence-pg.mjs
//
// ONE COMMAND that proves the core-divergence migration on a REAL Postgres.
//
//   node scripts/verify-core-divergence-pg.mjs "<postgres-url>"
//
// Example:
//   node scripts/verify-core-divergence-pg.mjs \
//     "postgres://postgres:PASSWORD@127.0.0.1:5432/hisabche_verify"
//
// ⚠️ WHY THIS EXISTS AS A SCRIPT AND NOT ONLY AS A `*.pg.test.ts`.
//
// The vitest suite (`backend/src/__tests__/core-divergence.pg.test.ts`) starts
// an EMBEDDED Postgres. On the development machine that fails for two reasons
// that are not product defects:
//
//   · `initdb: could not change permissions of directory %TEMP%\…` — the
//     sandbox/profile does not let initdb chmod its data directory;
//   · `could not create shared memory segment: error code 1314` — the process
//     is not permitted to create the shared-memory segment Postgres needs.
//
// The SAME test file accepts a real database through `HISABCHE_PG_URL`, and this
// script is the one-command wrapper that:
//
//   1. creates a scratch schema-free database (or uses the one given),
//   2. runs docs/core-divergence-migration.sql TWICE — idempotency is the point,
//   3. runs docs/VERIFY-core-divergence.sql and requires every check to be true,
//   4. then runs the isolation checks as real member roles.
//
// It prints PASS/FAIL per check and exits non-zero on any failure, so it can be
// pasted into a report as evidence. It does NOT touch a production database: it
// creates and drops its own tables inside the database you name, and it refuses
// to run against a database that already has a `core_divergence` table unless
// you pass --force.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import postgres from 'postgres'

const ROOT = process.cwd()
const DOCS = join(ROOT, 'docs')
const read = (name) => readFileSync(join(DOCS, name), 'utf8')

const args = process.argv.slice(2)
const force = args.includes('--force')
const url = args.find((a) => !a.startsWith('--'))

if (!url) {
  console.error('usage: node scripts/verify-core-divergence-pg.mjs "<postgres-url>" [--force]')
  console.error('  the database must already exist; this script creates only tables')
  process.exit(2)
}

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const USER_NONE = '33333333-3333-4333-8333-333333333333'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`)
}

let sql
try {
  // ⚠️ `max: 1` IS REQUIRED FOR `sql.unsafe` WITH MULTI-STATEMENT FILES.
  // postgres.js refuses to run several statements over a pooled connection
  // («UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1»), because a
  // multi-statement string is an implicit transaction and a pool could leave half
  // of it on one connection and half on another. One connection, one script.
  sql = postgres(url, { max: 1, onnotice: () => {} })

  // ── preflight ────────────────────────────────────────────────────────────
  const version = await sql`SELECT version() AS v`
  console.log(`\nPostgres: ${String(version[0].v).split(',')[0]}\n`)

  const [existing] = await sql`
    SELECT count(*)::int AS n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'core_divergence'`
  if (existing.n > 0 && !force) {
    console.error(
      'refusing: this database already has a core_divergence table.\n' +
        'Pass --force if it is a scratch database you are willing to re-use.',
    )
    process.exit(2)
  }

  // ── the roles and the membership chain the policy reads ──────────────────
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

    CREATE TABLE IF NOT EXISTS public.workspace_members (
      workspace_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role text NOT NULL DEFAULT 'owner',
      has_access boolean NOT NULL DEFAULT true,
      suspended_at timestamptz,
      PRIMARY KEY (workspace_id, user_id)
    );
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `)
  check('roles, workspace_members and auth.uid() are in place', true)

  // ── the migration, TWICE ─────────────────────────────────────────────────
  await sql.unsafe(read('core-divergence-migration.sql'))
  check('migration run 1 (docs/core-divergence-migration.sql)', true)
  await sql.unsafe(read('core-divergence-migration.sql'))
  check('migration run 2 — idempotent, no error on re-run', true)

  const policies = await sql`SELECT policyname FROM pg_policies WHERE tablename = 'core_divergence'`
  check(
    'exactly one policy after two runs',
    policies.length === 1 && policies[0].policyname === 'core_divergence_workspace_members',
    policies.map((p) => p.policyname).join(','),
  )

  // ── the VERIFY file: every ok must be true ──────────────────────────────
  await sql.unsafe(`
    DELETE FROM public.core_divergence;
    INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access)
    VALUES ('${WS_A}', '${USER_A}', 'owner', true),
           ('${WS_B}', '${USER_B}', 'owner', true),
           ('${WS_B}', '${USER_A}', 'member', true)
    ON CONFLICT DO NOTHING;
    UPDATE public.workspace_members SET suspended_at = now()
      WHERE workspace_id = '${WS_B}' AND user_id = '${USER_A}';
  `)

  const verifySets = await sql.unsafe(read('VERIFY-core-divergence.sql'))
  const flat = verifySets.flat()
  const badVerify = flat.filter((row) => row && row.ok === false)
  check(
    'VERIFY-core-divergence.sql: every check reports ok',
    badVerify.length === 0,
    badVerify.map((r) => r.check ?? 'unnamed').join(', '),
  )
  const policyRow = flat.find((r) => r && r.uses_membership_chain !== undefined)
  check('policy uses the membership chain', policyRow?.uses_membership_chain === true)
  check('policy has no phantom app.current_workspace_id', policyRow?.uses_phantom_setting === false)
  const grantsRow = flat.find((r) => r && r.anon_privileges !== undefined)
  check(
    'anon holds no privileges',
    Number(grantsRow?.anon_privileges) === 0,
    `anon=${grantsRow?.anon_privileges}`,
  )
  check(
    'authenticated cannot DELETE or TRUNCATE',
    Number(grantsRow?.authenticated_write_privileges) === 0,
  )

  // ── isolation, as real member roles ─────────────────────────────────────
  const insert = (ws) =>
    sql`INSERT INTO public.core_divergence ${sql({
      workspace_id: ws,
      capability: 'payment.record',
      command: 'POST /api/payments',
      command_payload: sql.json({ amount: 500 }),
      expected_output: sql.json({ cash: 500 }),
      actual_output: sql.json({ cash: 501 }),
      diff_summary: 'DIVERGENCE cash: core 50000 vs stored 50100',
    })}`

  await insert(WS_A)
  await insert(WS_B)

  // ⚠️ ONE RESERVED CONNECTION PER ROLE CHECK, EXPLICITLY RELEASED.
  //
  // `SET LOCAL` is scoped to a TRANSACTION, so outside one it is discarded before
  // the next statement — the role would silently revert to superuser and every
  // isolation check would "pass" by reading everything. Each block therefore runs
  // inside an explicit BEGIN … ROLLBACK on a reserved connection, and the
  // reservation is released in `finally` (with `max: 1` a leak deadlocks the next
  // call, which is how the first version of this script hung).
  const asRole = async (role, userId, body) => {
    const reserved = await sql.reserve()
    try {
      await reserved.unsafe('BEGIN')
      await reserved.unsafe(`SET LOCAL ROLE ${role}`)
      if (userId) await reserved`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      const result = await body(reserved)
      await reserved.unsafe('ROLLBACK')
      return result
    } catch (error) {
      // ⚠️ THE ROLLBACK MUST RUN EVEN WHEN THE EXPECTED FAILURE IS THE POINT.
      // A denied statement leaves the transaction ABORTED; any later command on
      // it — including the ROLLBACK itself — answers «current transaction is
      // aborted». Swallowing the rollback error here keeps the reserved
      // connection usable for the next check instead of turning one expected
      // denial into two unrelated failures.
      try {
        await reserved.unsafe('ROLLBACK')
      } catch {
        // already rolled back by the server on error
      }
      throw error
    } finally {
      reserved.release()
    }
  }

  const countAs = (userId) =>
    asRole('authenticated', userId, async (tx) => {
      const rows = await tx`SELECT count(*)::int AS n FROM public.core_divergence`
      return rows[0].n
    })

  check('member of A sees only A (1 row)', (await countAs(USER_A)) === 1)
  check('member of B sees only B (1 row)', (await countAs(USER_B)) === 1)
  check('a user in no workspace sees nothing', (await countAs(USER_NONE)) === 0)

  const visibleToA = await asRole('authenticated', USER_A, async (tx) => {
    return tx`SELECT workspace_id FROM public.core_divergence`
  })
  check(
    'a SUSPENDED membership grants nothing',
    visibleToA.length === 1 && visibleToA[0].workspace_id === WS_A,
    visibleToA.map((r) => r.workspace_id).join(','),
  )

  let refused = false
  try {
    await asRole('authenticated', USER_A, async (tx) => {
      await tx`INSERT INTO public.core_divergence ${tx({
        workspace_id: WS_B,
        capability: 'x',
        command: 'y',
        command_payload: tx.json({}),
        expected_output: tx.json({}),
        actual_output: tx.json({}),
        diff_summary: 'z',
      })}`
    })
  } catch (error) {
    refused = /row-level security|violates/i.test(error.message)
  }
  check('a member cannot write into another workspace', refused)

  let anonDenied = false
  try {
    await asRole('anon', null, async (tx) => tx`SELECT count(*) FROM public.core_divergence`)
  } catch (error) {
    anonDenied = /permission denied/i.test(error.message)
  }
  check('anon cannot read at all', anonDenied)

  const asService = await asRole('service_role', null, async (tx) => {
    const rows = await tx`SELECT count(*)::int AS n FROM public.core_divergence`
    return rows[0].n
  })
  check(
    'service_role (not subject to RLS) reads the whole report',
    asService >= 2,
    `rows=${asService}`,
  )
} catch (error) {
  check('harness', false, error instanceof Error ? error.message : String(error))
} finally {
  try {
    await sql?.end({ timeout: 5 })
  } catch {
    // nothing was connected
  }
}

const failed = results.filter((r) => !r.ok)
console.log(
  `\nchecks=${results.length} passed=${results.length - failed.length} failed=${failed.length}`,
)
if (failed.length > 0) {
  console.log('\nFAILED:')
  for (const f of failed) console.log(`  · ${f.name}`)
}
process.exit(failed.length === 0 ? 0 : 1)
