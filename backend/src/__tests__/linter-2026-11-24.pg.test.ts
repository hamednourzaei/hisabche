// ============================================
// docs/linter-2026-11-24-migration.sql, run for real -- twice.
//
// The live database carries three advisory classes: policies that call
// auth.uid() per row, four pairs of permissive policies for the same command,
// and thirteen duplicate indexes. The fixture is that live state; the
// assertions are the behaviour a person sees, not the shape of the SQL:
//
//   * a member still reads their own row and their colleagues' rows,
//   * a stranger still reads nothing,
//   * a branch row is visible when it is in my workspace OR it is mine,
//   * a UI preference is visible only with an active membership,
//   * invoice items are still read and written through the parent invoice,
//   * a second run changes nothing (no nested subquery, no error).
//
// The index drops are guarded by definition: an index that is not identical,
// or that a constraint owns, must survive.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-lint1124-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const W1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const I1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

// Every duplicate pair the linter reported, in its live shape.
const INDEXES = `
  CREATE TABLE public.checkout_sessions (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.journal_lines (id uuid PRIMARY KEY, workspace_id uuid, account_id uuid);
  CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.stock_movements (id uuid PRIMARY KEY, workspace_id uuid, product_id uuid);
  CREATE TABLE public.subscriptions (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.sync_change_log (sync_version bigint PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.transactions (id uuid PRIMARY KEY, workspace_id uuid, customer_id uuid);

  CREATE INDEX checkout_sessions_workspace_id_idx ON public.checkout_sessions (workspace_id);
  CREATE INDEX checkout_sessions_workspace_idx    ON public.checkout_sessions (workspace_id);
  CREATE INDEX customers_workspace_id_idx         ON public.customers (workspace_id);
  CREATE INDEX customers_workspace_idx            ON public.customers (workspace_id);
  CREATE INDEX invoice_items_invoice_id_idx       ON public.invoice_items (invoice_id);
  CREATE INDEX invoice_items_invoice_idx          ON public.invoice_items (invoice_id);
  CREATE INDEX invoices_workspace_id_idx          ON public.invoices (workspace_id);
  CREATE INDEX invoices_workspace_idx             ON public.invoices (workspace_id);
  CREATE INDEX invoices_workspace_id_customer_id_idx ON public.invoices (workspace_id, customer_id);
  CREATE INDEX invoices_workspace_customer_idx    ON public.invoices (workspace_id, customer_id);
  CREATE INDEX journal_lines_workspace_id_account_id_idx ON public.journal_lines (workspace_id, account_id);
  CREATE INDEX journal_lines_workspace_account_idx ON public.journal_lines (workspace_id, account_id);
  CREATE INDEX products_workspace_id_idx          ON public.products (workspace_id);
  CREATE INDEX products_workspace_idx             ON public.products (workspace_id);
  CREATE INDEX stock_movements_workspace_product_idx ON public.stock_movements (workspace_id, product_id);
  CREATE INDEX stock_movements_workspace_idx      ON public.stock_movements (workspace_id, product_id);
  CREATE INDEX subscriptions_workspace_id_idx     ON public.subscriptions (workspace_id);
  CREATE INDEX subscriptions_workspace_idx        ON public.subscriptions (workspace_id);
  CREATE INDEX sync_change_log_workspace_version_idx ON public.sync_change_log (workspace_id, sync_version);
  CREATE INDEX sync_change_log_ws_version_idx     ON public.sync_change_log (workspace_id, sync_version);
  CREATE INDEX transactions_workspace_id_idx      ON public.transactions (workspace_id);
  CREATE INDEX transactions_workspace_idx         ON public.transactions (workspace_id);
  CREATE INDEX transactions_workspace_id_customer_id_idx ON public.transactions (workspace_id, customer_id);
  CREATE INDEX transactions_workspace_customer_idx ON public.transactions (workspace_id, customer_id);
  CREATE INDEX workspace_members_workspace_id_idx ON public.workspace_members (workspace_id);
  CREATE INDEX workspace_members_workspace_idx    ON public.workspace_members (workspace_id);
`

const BEFORE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;

  CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $fn$;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

  CREATE SCHEMA private;
  GRANT USAGE ON SCHEMA private TO anon, authenticated;

  CREATE TABLE public.workspace_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    user_id      uuid NOT NULL,
    role         text NOT NULL DEFAULT 'member',
    has_access   boolean NOT NULL DEFAULT true,
    suspended_at timestamptz
  );

  -- The helper lives in schema private on the live database (linter-2026-09-14).
  CREATE FUNCTION private.is_workspace_member(_workspace_id uuid, _user_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM workspace_members
       WHERE workspace_id = _workspace_id
         AND user_id = _user_id
         AND has_access = true
         AND suspended_at IS NULL
    )
  $fn$;

  CREATE FUNCTION private.auth_workspace_ids()
  RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp AS $fn$
    SELECT workspace_id FROM workspace_members
     WHERE user_id = (SELECT auth.uid())
       AND has_access = true
       AND suspended_at IS NULL
  $fn$;

  GRANT EXECUTE ON FUNCTION private.is_workspace_member(uuid, uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION private.auth_workspace_ids() TO authenticated;

  CREATE TABLE public.invoices (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, customer_id uuid);
  CREATE TABLE public.invoice_items (id uuid PRIMARY KEY, invoice_id uuid NOT NULL);
  CREATE TABLE public.member_branches (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, user_id uuid NOT NULL);
  CREATE TABLE public.ui_visibility_profiles (
    workspace_id uuid NOT NULL,
    user_id      uuid NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE TABLE public.notifications (id uuid PRIMARY KEY, user_id uuid NOT NULL);

  ${INDEXES}

  ALTER TABLE public.workspace_members       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invoices                ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invoice_items           ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.member_branches         ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ui_visibility_profiles  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;

  -- ---- the live state: two permissive policies per group, bare auth.uid() ----
  CREATE POLICY invoice_items_via_parent ON public.invoice_items
    FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.invoices parent
       WHERE parent.id = invoice_items.invoice_id
         AND parent.workspace_id IN (SELECT private.auth_workspace_ids())
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.invoices parent
       WHERE parent.id = invoice_items.invoice_id
         AND parent.workspace_id IN (SELECT private.auth_workspace_ids())
    ));

  CREATE POLICY invoice_items_workspace_members ON public.invoice_items
    FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_items.invoice_id
         AND i.workspace_id IN (
           SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
         )
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.id = invoice_items.invoice_id
         AND i.workspace_id IN (
           SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
         )
    ));

  CREATE POLICY member_branches_own_rows ON public.member_branches
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

  CREATE POLICY member_branches_workspace_members ON public.member_branches
    FOR ALL TO authenticated
    USING (workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
       WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
    ))
    WITH CHECK (workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
       WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
    ));

  CREATE POLICY ui_visibility_profiles_own ON public.ui_visibility_profiles
    FOR ALL TO authenticated
    USING (
      user_id = auth.uid()
      AND workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
         WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
      )
    )
    WITH CHECK (
      user_id = auth.uid()
      AND workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
         WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
      )
    );

  CREATE POLICY ui_visibility_profiles_own_rows ON public.ui_visibility_profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

  -- live roles for workspace_members are {public}: no TO clause.
  CREATE POLICY workspace_members_own_row ON public.workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY workspace_members_colleagues ON public.workspace_members
    FOR SELECT
    USING (private.is_workspace_member(workspace_id, auth.uid()));

  -- already wrapped: must come out with exactly one subquery.
  CREATE POLICY notifications_own_rows ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

  -- the parent table a child policy reads must itself be readable.
  CREATE POLICY invoices_fixture_read ON public.invoices
    FOR SELECT TO authenticated
    USING (workspace_id IN (SELECT private.auth_workspace_ids()));

  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT SELECT ON public.workspace_members TO anon;
  -- The rewritten write policies carry no TO clause (default PUBLIC). anon must
  -- still read nothing from them, because every expression requires auth.uid().
  GRANT SELECT ON public.invoice_items, public.member_branches, public.ui_visibility_profiles TO anon;

  -- ---- data ----
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
    ('${W1}', '${A}', 'owner'),
    ('${W1}', '${C}', 'member');

  INSERT INTO public.invoices (id, workspace_id) VALUES ('${I1}', '${W1}');
  INSERT INTO public.invoice_items (id, invoice_id) VALUES
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '${I1}');

  INSERT INTO public.member_branches (id, workspace_id, user_id) VALUES
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${W1}', '${C}'),
    ('ffffffff-ffff-4fff-8fff-ffffffffffff', '${W2}', '${A}');

  INSERT INTO public.ui_visibility_profiles (workspace_id, user_id) VALUES
    ('${W1}', '${A}'),
    ('${W1}', '${C}'),
    ('${W2}', '${A}');

  INSERT INTO public.notifications (id, user_id) VALUES
    ('99999999-9999-4999-8999-999999999999', '${A}');
`

let sql: ReturnType<typeof postgres>

/** Run `fn` as a signed-in member, or as anon when `userId` is null. */
async function asRole<T>(
  role: 'authenticated' | 'anon',
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await sql.unsafe(`SET request.jwt.claim.sub = '${userId ?? ''}'`)
  await sql.unsafe(`SET ROLE ${role}`)
  try {
    return await fn()
  } finally {
    await sql.unsafe('RESET ROLE')
    await sql.unsafe('RESET request.jwt.claim.sub')
  }
}

const asUser = <T>(userId: string, fn: () => Promise<T>) => asRole('authenticated', userId, fn)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  await sql.unsafe(BEFORE)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('linter-2026-11-24', () => {
  it('before it runs, the VERIFY query finds every reported warning', async () => {
    const [row] = await sql.unsafe(read('VERIFY-linter-2026-11-24.sql'))
    expect(row).toMatchObject({
      initplan_policies: 7,
      multiple_permissive_tables: 4,
      duplicate_index_groups: 13,
      canonical_indexes_present: 13,
      retired_policies_remaining: 6,
      merged_policies_present: 2,
      ok: false,
    })
  })

  it('runs twice without error', async () => {
    await sql.unsafe(read('linter-2026-11-24-migration.sql'))
    await sql.unsafe(read('linter-2026-11-24-migration.sql'))
  })

  it('leaves the already-wrapped policy with exactly one subquery', async () => {
    const [row] = await sql`
      SELECT qual FROM pg_policies
       WHERE schemaname = 'public' AND policyname = 'notifications_own_rows'`
    expect((row?.qual.match(/SELECT auth\.uid\(\)/g) ?? []).length).toBe(1)
  })

  it('a member still reads their own row and every colleague row', async () => {
    const rows = await asUser(
      A,
      () => sql`SELECT user_id FROM public.workspace_members ORDER BY user_id`,
    )
    expect(rows.map((row) => row.user_id)).toEqual([A, C])
  })

  it('someone with no membership reads no membership row', async () => {
    const rows = await asUser(B, () => sql`SELECT user_id FROM public.workspace_members`)
    expect(rows).toHaveLength(0)
  })

  it('anon still reads nothing from workspace_members', async () => {
    const rows = await asRole('anon', null, () => sql`SELECT user_id FROM public.workspace_members`)
    expect(rows).toHaveLength(0)
  })

  it('anon reads nothing from the rewritten write policies either', async () => {
    const counts = await asRole('anon', null, async () => {
      const [items] = await sql`SELECT count(*)::int AS n FROM public.invoice_items`
      const [branches] = await sql`SELECT count(*)::int AS n FROM public.member_branches`
      const [profiles] = await sql`SELECT count(*)::int AS n FROM public.ui_visibility_profiles`
      return [items?.n, branches?.n, profiles?.n]
    })
    expect(counts).toEqual([0, 0, 0])
  })

  it('reads branch rows from my workspace and my own rows elsewhere', async () => {
    const rows = await asUser(A, () => sql`SELECT id FROM public.member_branches ORDER BY id`)
    expect(rows).toHaveLength(2)
  })

  it('reads a UI preference only where an active membership exists', async () => {
    const rows = await asUser(
      A,
      () => sql`SELECT workspace_id FROM public.ui_visibility_profiles ORDER BY workspace_id`,
    )
    expect(rows.map((row) => row.workspace_id)).toEqual([W1])
  })

  it('reads invoice items through the parent invoice, and writes them there', async () => {
    const visible = await asUser(A, () => sql`SELECT id FROM public.invoice_items`)
    expect(visible).toHaveLength(1)

    const afterInsert = await asUser(A, async () => {
      await sql`INSERT INTO public.invoice_items (id, invoice_id)
                VALUES ('12121212-1212-4212-8212-121212121212', ${I1})`
      return sql`SELECT count(*)::int AS n FROM public.invoice_items`
    })
    expect(afterInsert[0]?.n).toBe(2)
  })

  it('refuses an invoice item for a workspace the user is not in', async () => {
    await expect(
      asUser(
        B,
        () =>
          sql`INSERT INTO public.invoice_items (id, invoice_id)
            VALUES ('13131313-1313-4313-8313-131313131313', ${I1})`,
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('does not drop an index whose definition is not identical', async () => {
    await sql.unsafe(
      'CREATE INDEX products_workspace_idx ON public.products (workspace_id) WHERE workspace_id IS NOT NULL',
    )
    await sql.unsafe(read('linter-2026-11-24-migration.sql'))
    const [row] = await sql`
      SELECT count(*)::int AS n FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'products_workspace_idx'`
    expect(row?.n).toBe(1)
  })

  it('does not drop an index a constraint owns', async () => {
    await sql.unsafe(
      'CREATE UNIQUE INDEX customers_workspace_idx ON public.customers (workspace_id)',
    )
    await sql.unsafe(
      'ALTER TABLE public.customers ADD CONSTRAINT customers_workspace_idx UNIQUE USING INDEX customers_workspace_idx',
    )
    await sql.unsafe(read('linter-2026-11-24-migration.sql'))
    const [row] = await sql`
      SELECT count(*)::int AS n FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'customers_workspace_idx'`
    expect(row?.n).toBe(1)
  })

  it('the VERIFY query then finds no warning', async () => {
    const [row] = await sql.unsafe(read('VERIFY-linter-2026-11-24.sql'))
    expect(row).toMatchObject({
      initplan_policies: 0,
      multiple_permissive_tables: 0,
      duplicate_index_groups: 0,
      canonical_indexes_present: 13,
      retired_policies_remaining: 0,
      merged_policies_present: 4,
      ok: true,
    })
  })
})
