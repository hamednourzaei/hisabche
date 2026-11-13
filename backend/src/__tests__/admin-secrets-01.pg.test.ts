// ============================================
// backend/src/__tests__/admin-secrets-01.pg.test.ts
//
// V63 · S-3 — docs/admin-secrets-01-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE (idempotent);
//  2. refuses a write when Supabase Vault is absent (never a silent success);
//  3. with a stubbed Vault, stores and returns the value, records only last4,
//     and rotates in place;
//  4. refuses `anon`/`authenticated` EXECUTE on the reader (privilege test);
//  5. never exposes the value through `platform_secrets_list`.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-admin-secrets-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/adminsecrets`
let sql: postgres.Sql

const migration = readFileSync(
  join(__dirname, '../../../docs/admin-secrets-01-migration.sql'),
  'utf-8',
)

describe('admin-secrets-01-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE adminsecrets`
    await root.end()
    sql = postgres(url)

    // The REVOKE/GRANT block is conditional on these roles existing, exactly
    // as on Supabase. Create them first so the grants are really exercised.
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END $$;
    `)
  }, 60_000)

  afterAll(async () => {
    if (sql) await sql.end({ timeout: 2 })
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  it('applies twice without error (idempotent)', async () => {
    await sql.unsafe(migration)
    await expect(sql.unsafe(migration)).resolves.toBeDefined()
  })

  it('refuses to store while Vault is absent — never a silent success', async () => {
    await expect(
      sql`SELECT public.platform_secret_set('ai.api_key', 'sk-test-1234', 'AI provider key')`,
    ).rejects.toThrow(/PLATFORM_VAULT_NOT_INSTALLED|VAULT/i)
  })

  it('stores, rotates and reads back with a Vault present', async () => {
    // A minimal stand-in for Supabase Vault (the extension is not in plain PG).
    await sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS vault;
      CREATE TABLE IF NOT EXISTS vault.secrets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        secret text NOT NULL,
        name text,
        description text
      );
      CREATE TABLE IF NOT EXISTS vault.decrypted_secrets (
        id uuid NOT NULL,
        decrypted_secret text NOT NULL
      );
      CREATE OR REPLACE FUNCTION vault.create_secret(secret text, name text DEFAULT NULL, description text DEFAULT NULL)
      RETURNS uuid LANGUAGE plpgsql AS $$
      DECLARE v_id uuid;
      BEGIN
        INSERT INTO vault.secrets (secret, name, description) VALUES ($1, $2, $3) RETURNING id INTO v_id;
        INSERT INTO vault.decrypted_secrets (id, decrypted_secret) VALUES (v_id, $1);
        RETURN v_id;
      END;
      $$;
      CREATE OR REPLACE FUNCTION vault.update_secret(id uuid, secret text)
      RETURNS uuid LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE vault.secrets SET secret = $2 WHERE id = $1;
        DELETE FROM vault.decrypted_secrets WHERE id = $1;
        INSERT INTO vault.decrypted_secrets (id, decrypted_secret) VALUES ($1, $2);
        RETURN $1;
      END;
      $$;
      CREATE OR REPLACE FUNCTION vault.delete_secret(id uuid)
      RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        DELETE FROM vault.decrypted_secrets WHERE id = $1;
        DELETE FROM vault.secrets WHERE id = $1;
      END;
      $$;
    `)

    await sql`SELECT public.platform_secret_set('ai.api_key', 'sk-live-ABCD1234', 'AI provider key')`

    const stored = await sql<{ value: string | null }[]>`
      SELECT public.platform_secret_get('ai.api_key') AS value
    `
    expect(stored[0]?.value).toBe('sk-live-ABCD1234')

    const index = await sql<{ last4: string; purpose: string }[]>`
      SELECT last4, purpose FROM public.platform_secrets WHERE name = 'ai.api_key'
    `
    expect(index[0]?.last4).toBe('1234')
    expect(index[0]?.purpose).toBe('AI provider key')

    // Rotation updates in place (one index row, new value, new last4).
    await sql`SELECT public.platform_secret_set('ai.api_key', 'sk-live-WXYZ9876', 'AI provider key')`
    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM public.platform_secrets WHERE name = 'ai.api_key'
    `
    expect(rows[0]?.count).toBe('1')
    const rotated = await sql<{ value: string | null }[]>`
      SELECT public.platform_secret_get('ai.api_key') AS value
    `
    expect(rotated[0]?.value).toBe('sk-live-WXYZ9876')
  })

  it('a staged rotation is not live until it is promoted', async () => {
    await sql`
      SELECT public.platform_secret_stage(
        'stripe.secret_key', 'sk_live_STAGE9999', 'Stripe secret key'
      )
    `

    const index = await sql<
      { last4: string | null; pending_last4: string | null; pending_by: string | null }[]
    >`
      SELECT last4, pending_last4, pending_by
        FROM public.platform_secrets
       WHERE name = 'stripe.secret_key'
    `
    expect(index[0]?.last4).toBeNull()
    expect(index[0]?.pending_last4).toBe('9999')

    // The staged value is NOT the live value.
    const before = await sql<{ value: string | null }[]>`
      SELECT public.platform_secret_get('stripe.secret_key') AS value
    `
    expect(before[0]?.value).toBeNull()

    await sql`SELECT public.platform_secret_promote('stripe.secret_key')`

    const after = await sql<{ value: string | null }[]>`
      SELECT public.platform_secret_get('stripe.secret_key') AS value
    `
    expect(after[0]?.value).toBe('sk_live_STAGE9999')

    const cleared = await sql<
      { last4: string | null; pending_last4: string | null; pending_at: string | null }[]
    >`
      SELECT last4, pending_last4, pending_at
        FROM public.platform_secrets
       WHERE name = 'stripe.secret_key'
    `
    expect(cleared[0]?.last4).toBe('9999')
    expect(cleared[0]?.pending_last4).toBeNull()
    expect(cleared[0]?.pending_at).toBeNull()

    const staged = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM vault.secrets WHERE name = 'staged/stripe.secret_key'
    `
    expect(staged[0]?.count).toBe('0')
  })

  it('discarding a staged rotation leaves the live secret untouched', async () => {
    await sql`
      SELECT public.platform_secret_stage('stripe.secret_key', 'sk_live_NEVER42', 'Stripe secret key')
    `
    await sql`SELECT public.platform_secret_discard('stripe.secret_key')`

    const live = await sql<{ value: string | null }[]>`
      SELECT public.platform_secret_get('stripe.secret_key') AS value
    `
    expect(live[0]?.value).toBe('sk_live_STAGE9999')

    const cleared = await sql<{ pending_last4: string | null }[]>`
      SELECT pending_last4 FROM public.platform_secrets WHERE name = 'stripe.secret_key'
    `
    expect(cleared[0]?.pending_last4).toBeNull()
  })

  it('the metadata reader never returns the value', async () => {
    const list = await sql<{ name: string; last4: string }[]>`
      SELECT * FROM public.platform_secrets_list()
    `
    const record = list.find((row) => row.name === 'ai.api_key')
    expect(record?.last4).toBe('9876')
    expect(Object.keys(record ?? {})).not.toContain('value')
    expect(Object.keys(record ?? {})).not.toContain('decrypted_secret')
  })

  it('refuses anon and authenticated EXECUTE on the reader', async () => {
    await sql.unsafe(
      `REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO anon, authenticated;`,
    )

    await expect(
      sql.unsafe(`SET ROLE anon; SELECT public.platform_secret_get('ai.api_key');`),
    ).rejects.toThrow(/permission denied/i)

    await expect(
      sql.unsafe(`SET ROLE authenticated; SELECT public.platform_secret_get('ai.api_key');`),
    ).rejects.toThrow(/permission denied/i)

    await sql.unsafe(`RESET ROLE; GRANT USAGE ON SCHEMA public TO PUBLIC;`)
  })

  it('the reader is SECURITY DEFINER with a pinned search_path', async () => {
    const rows = await sql<{ prosecdef: boolean; proconfig: string[] | null }[]>`
      SELECT p.prosecdef, p.proconfig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'platform_secret_get'
    `
    expect(rows[0]?.prosecdef).toBe(true)
    expect((rows[0]?.proconfig ?? []).join(',')).toContain('search_path=public, pg_temp')
  })
})
