import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('suppliers-notes-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()

    // Mirror Supabase role privilege defaults before creating tables.
    await pg.sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

      CREATE TABLE IF NOT EXISTS public.suppliers (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        phone text,
        email text,
        address jsonb DEFAULT '{}'::jsonb,
        user_id uuid,
        workspace_id uuid NOT NULL,
        is_active boolean DEFAULT true,
        deleted_at timestamptz,
        created_at timestamp without time zone DEFAULT now(),
        updated_at timestamp without time zone DEFAULT now()
      );
      ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.suppliers FROM PUBLIC, anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE ON public.suppliers TO service_role;
    `)

    const migSql = readFileSync(
      resolve(__dirname, '../../../docs/suppliers-notes-01-migration.sql'),
      'utf8',
    )
    // Additive & idempotent: running migration twice must succeed without error.
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('passes all VERIFY assertions and supports reading and writing suppliers.notes', async () => {
    const verifySql = readFileSync(
      resolve(__dirname, '../../../docs/VERIFY-suppliers-notes-01.sql'),
      'utf8',
    )
    const verifyRows = await pg.sql.unsafe<{ check: string; ok: boolean }[]>(verifySql)
    expect(verifyRows.length).toBeGreaterThanOrEqual(4)
    for (const row of verifyRows) {
      expect(row.ok, `VERIFY check failed: ${row.check}`).toBe(true)
    }

    const wsId = '11111111-1111-4111-8111-111111111111'
    const [inserted] = await pg.sql<{ id: string; notes: string }[]>`
      INSERT INTO public.suppliers (name, workspace_id, notes)
      VALUES ('Kabul Flour Co', ${wsId}::uuid, 'Deliveries on Mondays')
      RETURNING id, notes
    `
    expect(inserted?.notes).toBe('Deliveries on Mondays')

    const [defaultRow] = await pg.sql<{ notes: string }[]>`
      INSERT INTO public.suppliers (name, workspace_id)
      VALUES ('Herat Spice Co', ${wsId}::uuid)
      RETURNING notes
    `
    expect(defaultRow?.notes).toBe('')
  })
})
