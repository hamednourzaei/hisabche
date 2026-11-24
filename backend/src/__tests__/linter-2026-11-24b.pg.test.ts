// ============================================
// docs/linter-2026-11-24b-migration.sql, run for real — twice.
//
// The second batch of the 24 Nov linter: seven trigger functions get a fixed
// search_path, four SECURITY DEFINER functions lose client EXECUTE, and
// btree_gist moves out of `public`. Proven on a real Postgres with two of the
// seven functions and one of the four SECURITY DEFINER functions absent (a
// database that has not had every feature migration), Supabase's three roles,
// and a live exclusion constraint that depends on btree_gist.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-lint1124b-')
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

const W1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const S1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

// Five of the seven search_path functions, and three of the four SECURITY
// DEFINER functions. `trg_service_delivery_sessions_updated_at`,
// `offline_license_signing_keys_guard` and `package_credit_consume` are absent
// on purpose: the migration must skip them, not fail.
const BEFORE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;

  CREATE FUNCTION public.prevent_license_logs_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
  BEGIN
    RAISE EXCEPTION 'license_logs is append-only';
  END $fn$;

  CREATE FUNCTION public.workspace_operational_dna_history_frozen() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
  BEGIN
    RAISE EXCEPTION 'operational dna history is append-only';
  END $fn$;

  CREATE FUNCTION public.remittance_events_append_only() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
  BEGIN
    RAISE EXCEPTION 'remittance_events is append-only';
  END $fn$;

  CREATE FUNCTION public.repair_ticket_events_append_only() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
  BEGIN
    RAISE EXCEPTION 'repair_ticket_events is append-only';
  END $fn$;

  CREATE FUNCTION public.sync_record_workspace_keyed_change() RETURNS trigger
  LANGUAGE plpgsql AS $fn$
  BEGIN
    RETURN COALESCE(NEW, OLD);
  END $fn$;

  CREATE TABLE public.license_logs (id int PRIMARY KEY, note text);
  INSERT INTO public.license_logs VALUES (1, 'kept');
  CREATE TRIGGER license_logs_append_only
    BEFORE UPDATE OR DELETE ON public.license_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_license_logs_mutation();

  CREATE FUNCTION public.prevent_package_credit_ledger_mutation() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $fn$
  BEGIN
    RAISE EXCEPTION 'package_credit_ledger is append-only';
  END $fn$;

  CREATE FUNCTION public.prevent_package_credit_side_table_mutation() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $fn$
  BEGIN
    RAISE EXCEPTION 'package credit side table is append-only';
  END $fn$;

  CREATE TABLE public.package_credit_ledger (id int PRIMARY KEY);
  INSERT INTO public.package_credit_ledger VALUES (1);
  CREATE TRIGGER trg_prevent_package_credit_ledger_mutation
    BEFORE UPDATE OR DELETE ON public.package_credit_ledger
    FOR EACH ROW EXECUTE FUNCTION public.prevent_package_credit_ledger_mutation();

  CREATE FUNCTION public.canonical_provision_workspace(
    p_order_id uuid, p_user_id uuid, p_workspace_name text,
    p_base_currency text, p_time_zone text
  ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $fn$
  BEGIN
    RETURN jsonb_build_object('ok', true);
  END $fn$;

  -- btree_gist in public, and a constraint that depends on its uuid opclass.
  CREATE EXTENSION btree_gist;
  CREATE TABLE public.appointments (
    id serial PRIMARY KEY,
    workspace_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    during tstzrange NOT NULL,
    status text NOT NULL DEFAULT 'active',
    CONSTRAINT appointments_no_staff_overlap EXCLUDE USING gist (
      workspace_id WITH =, staff_id WITH =, during WITH &&
    ) WHERE (status = 'active')
  );
  INSERT INTO public.appointments (workspace_id, staff_id, during)
  VALUES ('${W1}', '${S1}', tstzrange('2030-01-01 10:00+00', '2030-01-01 11:00+00'));
`

let sql: ReturnType<typeof postgres>

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

describe('linter-2026-11-24b', () => {
  it('before it runs, the VERIFY query says NOT ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-linter-2026-11-24b.sql'))
    expect(row).toMatchObject({
      search_path_found: 5,
      search_path_mutable: 5,
      secdef_found: 3,
      anon_executable: 3,
      authenticated_executable: 3,
      btree_gist_schema: 'public',
      btree_gist_present: true,
      ok: false,
    })
  })

  it('runs twice without error, with three of the functions absent', async () => {
    await sql.unsafe(read('linter-2026-11-24b-migration.sql'))
    await sql.unsafe(read('linter-2026-11-24b-migration.sql'))
  })

  it('every function that exists has a fixed search_path', async () => {
    const rows = await sql`
      SELECT proname, proconfig FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN (
           'prevent_license_logs_mutation',
           'workspace_operational_dna_history_frozen',
           'trg_service_delivery_sessions_updated_at',
           'offline_license_signing_keys_guard',
           'remittance_events_append_only',
           'repair_ticket_events_append_only',
           'sync_record_workspace_keyed_change'
         )
       ORDER BY proname`
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(row.proconfig, row.proname).toEqual(['search_path=public, pg_temp'])
    }
  })

  it('the migration did not invent the absent functions', async () => {
    const rows = await sql`
      SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN (
           'trg_service_delivery_sessions_updated_at',
           'offline_license_signing_keys_guard',
           'package_credit_consume'
         )`
    expect(rows).toHaveLength(0)
  })

  it('⚠️ the append-only trigger still does its job', async () => {
    let message = ''
    try {
      await sql`UPDATE public.license_logs SET note = 'changed' WHERE id = 1`
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('append-only')
    const [row] = await sql`SELECT note FROM public.license_logs WHERE id = 1`
    expect(row?.note).toBe('kept')
  })

  it('⚠️ the SECURITY DEFINER trigger still does its job', async () => {
    let message = ''
    try {
      await sql`DELETE FROM public.package_credit_ledger WHERE id = 1`
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('append-only')
  })

  it('no client role may execute a SECURITY DEFINER function any more', async () => {
    const rows = await sql`
      SELECT p.proname,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
        FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace
         AND p.proname IN (
           'prevent_package_credit_ledger_mutation',
           'prevent_package_credit_side_table_mutation',
           'canonical_provision_workspace'
         )
       ORDER BY p.proname`
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.anon, row.proname).toBe(false)
      expect(row.authenticated, row.proname).toBe(false)
    }
  })

  it('the backend RPC keeps its service_role grant; the trigger function does not', async () => {
    const [rpc] = await sql`
      SELECT has_function_privilege(
               'service_role',
               'public.canonical_provision_workspace(uuid, uuid, text, text, text)',
               'EXECUTE'
             ) AS allowed`
    expect(rpc?.allowed).toBe(true)

    const [triggerFn] = await sql`
      SELECT has_function_privilege(
               'service_role',
               'public.prevent_package_credit_ledger_mutation()',
               'EXECUTE'
             ) AS allowed`
    expect(triggerFn?.allowed).toBe(false)
  })

  it('btree_gist is out of public and the existing exclusion constraint still holds', async () => {
    const [ext] = await sql`
      SELECT n.nspname FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
       WHERE e.extname = 'btree_gist'`
    expect(ext?.nspname).toBe('extensions')

    const [constraint] = await sql`
      SELECT conname, convalidated FROM pg_constraint
       WHERE conname = 'appointments_no_staff_overlap'`
    expect(constraint).toMatchObject({
      conname: 'appointments_no_staff_overlap',
      convalidated: true,
    })

    let message = ''
    try {
      await sql`
        INSERT INTO public.appointments (workspace_id, staff_id, during)
        VALUES (${W1}, ${S1}, tstzrange('2030-01-01 10:30+00', '2030-01-01 11:30+00'))`
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('conflicting key value')
  })

  it('a new exclusion constraint can still be created when extensions is on the path', async () => {
    await sql.unsafe(`
      SET search_path = public, extensions;
      CREATE TABLE public.appointments_v2 (
        id serial PRIMARY KEY,
        workspace_id uuid NOT NULL,
        staff_id uuid NOT NULL,
        during tstzrange NOT NULL,
        status text NOT NULL DEFAULT 'active',
        CONSTRAINT appointments_v2_no_staff_overlap EXCLUDE USING gist (
          workspace_id WITH =, staff_id WITH =, during WITH &&
        ) WHERE (status = 'active')
      );
      RESET search_path;`)
    const [row] = await sql`
      SELECT conname FROM pg_constraint WHERE conname = 'appointments_v2_no_staff_overlap'`
    expect(row?.conname).toBe('appointments_v2_no_staff_overlap')
  })

  it('the client roles may still use the extensions schema', async () => {
    const [row] = await sql`
      SELECT has_schema_privilege('anon', 'extensions', 'USAGE') AS anon,
             has_schema_privilege('authenticated', 'extensions', 'USAGE') AS authenticated`
    expect(row).toMatchObject({ anon: true, authenticated: true })
  })

  it('the VERIFY query says ok', async () => {
    const [row] = await sql.unsafe(read('VERIFY-linter-2026-11-24b.sql'))
    expect(row).toMatchObject({
      search_path_found: 5,
      search_path_mutable: 0,
      secdef_found: 3,
      anon_executable: 0,
      authenticated_executable: 0,
      btree_gist_schema: 'extensions',
      btree_gist_present: true,
      ok: true,
    })
  })
})
