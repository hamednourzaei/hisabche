import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'

const MIGRATION_PATH = path.resolve(__dirname, '../../../docs/sync-scope-01-migration.sql')
const VERIFY_PATH = path.resolve(__dirname, '../../../docs/VERIFY-sync-scope-01.sql')

describe('sync-scope-01 migration (real Postgres)', () => {
  let pg: EmbeddedPostgres
  let sql: postgres.Sql

  beforeAll(async () => {
    const port = 55400 + Math.floor(Math.random() * 500)
    pg = new EmbeddedPostgres({
      databaseDir: path.join(__dirname, `.pg-sync-scope-${port}`),
      user: 'postgres',
      password: 'password',
      port,
      persistent: false,
    })
    await pg.initialise()
    await pg.start()
    sql = postgres({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      password: 'password',
      database: 'postgres',
    })

    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

      CREATE TABLE IF NOT EXISTS public.sync_change_log (
        sync_version bigserial PRIMARY KEY,
        workspace_id uuid NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid NOT NULL,
        operation text NOT NULL,
        entity_version bigint NOT NULL DEFAULT 1,
        origin_device text,
        created_at timestamptz NOT NULL DEFAULT now(),
        txid xid8 DEFAULT pg_current_xact_id()
      );

      CREATE OR REPLACE FUNCTION public.sync_pull_changes(
        p_workspace_id uuid, p_cursor bigint, p_limit int
      ) RETURNS TABLE (
        sync_version bigint, workspace_id uuid, entity_type text, entity_id uuid,
        operation text, entity_version bigint, origin_device text, created_at timestamptz
      ) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $f$
        SELECT sync_version, workspace_id, entity_type, entity_id, operation, entity_version, origin_device, created_at
        FROM public.sync_change_log
        WHERE workspace_id = p_workspace_id AND sync_version > p_cursor
        ORDER BY sync_version ASC LIMIT p_limit;
      $f$;
    `)
  }, 60_000)

  afterAll(async () => {
    await sql?.end()
    await pg?.stop()
  })

  it('runs migration twice idempotently and passes all VERIFY checks', async () => {
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8')
    await sql.unsafe(migrationSql)
    await sql.unsafe(migrationSql)

    const verifySql = fs.readFileSync(VERIFY_PATH, 'utf8')
    const rows = await sql.unsafe<Array<{ check: string; ok: boolean }>>(verifySql)
    expect(rows.length).toBeGreaterThanOrEqual(5)
    for (const row of rows) {
      expect(row.ok, `VERIFY failed: ${row.check}`).toBe(true)
    }
  })

  it('filters by p_entity_types, treats NULL as all, and isolates workspaces', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const ws2 = '22222222-2222-4222-8222-222222222222'
    const e1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const e2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const e3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

    await sql`
      INSERT INTO public.sync_change_log (workspace_id, entity_type, entity_id, operation)
      VALUES
        (${ws1}::uuid, 'invoice', ${e1}::uuid, 'create'),
        (${ws1}::uuid, 'time_entry', ${e2}::uuid, 'create'),
        (${ws2}::uuid, 'invoice', ${e3}::uuid, 'create')
    `

    const filtered = await sql<Array<{ entity_type: string; workspace_id: string }>>`
      SELECT entity_type, workspace_id FROM public.sync_pull_changes_v2(${ws1}::uuid, 0, 100, ARRAY['invoice'])
    `
    expect(filtered.map((r) => r.entity_type)).toEqual(['invoice'])
    expect(filtered[0]!.workspace_id).toBe(ws1)

    const allForWs1 = await sql<Array<{ entity_type: string }>>`
      SELECT entity_type FROM public.sync_pull_changes_v2(${ws1}::uuid, 0, 100, NULL)
    `
    expect(allForWs1.map((r) => r.entity_type)).toEqual(['invoice', 'time_entry'])
  })
})
