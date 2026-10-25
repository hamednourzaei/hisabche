// Standalone execution of docs/core-divergence-migration.sql against a real
// embedded Postgres: run TWICE, then exercise the RLS policy as real members.
// This mirrors backend/src/__tests__/core-divergence.pg.test.ts (which cannot
// run through vitest in this sandbox because the config loader is blocked), so
// the migration is still proved on a real database rather than read.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'

const DOCS = join(process.cwd(), 'docs')
const read = (n) => readFileSync(join(DOCS, n), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const USER_NONE = '33333333-3333-4333-8333-333333333333'

const PORT = 59998
const dir = mkdtempSync(join(process.cwd(), '.pgtest', 'div-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`)
}

let sql
try {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('div')
  const setup = postgres(`postgres://postgres:test@localhost:${PORT}/div`, {
    max: 1,
    onnotice: () => {},
  })

  await setup.unsafe(`
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

  // ── the migration, TWICE, unchanged ──
  await setup.unsafe(read('core-divergence-migration.sql'))
  console.log('--- migration run 1 ok')
  await setup.unsafe(read('core-divergence-migration.sql'))
  console.log('--- migration run 2 ok (idempotent)')

  await setup.unsafe(`
    INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access) VALUES
      ('${WS_A}', '${USER_A}', 'owner', true),
      ('${WS_B}', '${USER_B}', 'owner', true),
      ('${WS_B}', '${USER_A}', 'member', true);
    UPDATE public.workspace_members SET suspended_at = now()
      WHERE workspace_id = '${WS_B}' AND user_id = '${USER_A}';
  `)
  await setup.end()

  sql = postgres(`postgres://postgres:test@localhost:${PORT}/div`, { max: 4, onnotice: () => {} })

  // policies: exactly one
  const policies = await sql`SELECT policyname FROM pg_policies WHERE tablename = 'core_divergence'`
  check(
    'one policy after two runs',
    policies.length === 1,
    JSON.stringify(policies.map((p) => p.policyname)),
  )

  // VERIFY file emits several result sets; the policy check is the one whose
  // rows carry `uses_membership_chain`.
  const verifyRows = await sql.unsafe(read('VERIFY-core-divergence.sql'))
  console.log(
    'VERIFY shape:',
    Array.isArray(verifyRows) ? verifyRows.length : typeof verifyRows,
    'first:',
    JSON.stringify(verifyRows?.[0])?.slice(0, 200),
    'fourth:',
    JSON.stringify(verifyRows?.[4])?.slice(0, 200),
  )
  const flat =
    Array.isArray(verifyRows) && Array.isArray(verifyRows[0]) ? verifyRows.flat() : verifyRows
  const policyRow = flat.find((r) => r?.uses_membership_chain !== undefined)
  check('VERIFY: policy uses membership chain', policyRow?.uses_membership_chain === true)
  check('VERIFY: no phantom current_setting', policyRow?.uses_phantom_setting === false)
  const grantsRow = flat.find((r) => r?.anon_privileges !== undefined)
  check(
    'VERIFY: anon_privileges is 0',
    Number(grantsRow?.anon_privileges) === 0,
    `anon=${grantsRow?.anon_privileges}`,
  )
  check(
    'VERIFY: authenticated has no DELETE/TRUNCATE',
    Number(grantsRow?.authenticated_write_privileges) === 0,
  )

  // anon
  const anonGrants = await sql`
    SELECT count(*)::int AS n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='core_divergence' AND grantee='anon'`
  check('anon has no grants', anonGrants[0].n === 0, `grants=${anonGrants[0].n}`)

  // insert two rows as owner
  const ins = (ws) =>
    sql`INSERT INTO public.core_divergence ${sql({
      workspace_id: ws,
      capability: 'invoice.create',
      command: 'POST /api/invoices',
      command_payload: sql.json({ total: 100 }),
      expected_output: sql.json({ total: 100 }),
      actual_output: sql.json({ total: 99 }),
      diff_summary: 'DIVERGENCE',
    })} RETURNING id`
  await ins(WS_A)
  await ins(WS_B)

  const countAs = (userId) =>
    sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`
      const r = await tx`SELECT count(*)::int AS n FROM public.core_divergence`
      return r[0].n
    })

  check('member A sees only A (1)', (await countAs(USER_A)) === 1, `saw ${await countAs(USER_A)}`)
  check('member B sees only B (1)', (await countAs(USER_B)) === 1)
  check('non-member sees nothing', (await countAs(USER_NONE)) === 0)

  // suspended membership
  const rowsA = await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`
    await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
    return tx`SELECT workspace_id FROM public.core_divergence`
  })
  check(
    'suspended membership grants nothing',
    rowsA.length === 1 && rowsA[0].workspace_id === WS_A,
    JSON.stringify(rowsA.map((r) => r.workspace_id)),
  )

  // cross-tenant write refused
  let refused = false
  try {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
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
  check('cross-tenant write refused by RLS', refused)

  // service role reads all
  const asService = await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE service_role`
    const r = await tx`SELECT count(*)::int AS n FROM public.core_divergence`
    return r[0].n
  })
  check('service_role reads all', asService >= 2, `saw ${asService}`)

  // anon cannot select
  let anonDenied = false
  try {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE anon`
      await tx`SELECT count(*) FROM public.core_divergence`
    })
  } catch (error) {
    anonDenied = /permission denied/i.test(error.message)
  }
  check('anon cannot select', anonDenied)

  await sql.end()
} catch (error) {
  check('harness', false, error.message)
} finally {
  try {
    await sql?.end()
  } catch {
    // best-effort cleanup; the verdict is already recorded
  }
  try {
    await pg.stop()
  } catch {
    // best-effort cleanup; the verdict is already recorded
  }
  rmSync(dir, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok)
console.log(
  `\nchecks=${results.length} passed=${results.length - failed.length} failed=${failed.length}`,
)
process.exit(failed.length === 0 ? 0 : 1)
