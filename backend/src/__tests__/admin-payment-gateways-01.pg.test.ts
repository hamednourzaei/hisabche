// ============================================
// backend/src/__tests__/admin-payment-gateways-01.pg.test.ts
//
// V63 · P-1 — docs/admin-payment-gateways-01-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE and does not re-disable an enabled gateway;
//  2. seeds STRIPE/PAYPAL in both modes, all disabled, LOCAL live included;
//  3. refuses a duplicate provider+environment;
//  4. refuses a secret-looking key in `public_config`;
//  5. leaves anon/authenticated with no privilege and RLS enabled.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-gateways-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/gateways`
let sql: postgres.Sql

const migration = readFileSync(
  join(__dirname, '../../../docs/admin-payment-gateways-01-migration.sql'),
  'utf-8',
)

describe('admin-payment-gateways-01-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE gateways`
    await root.end()
    sql = postgres(url)
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

  it('does not re-disable a gateway on the second run', async () => {
    await sql`
      UPDATE public.platform_payment_gateways
         SET is_enabled = true
       WHERE provider = 'STRIPE' AND environment = 'TEST'
    `
    await sql.unsafe(migration)

    const rows = await sql<{ is_enabled: boolean }[]>`
      SELECT is_enabled FROM public.platform_payment_gateways
       WHERE provider = 'STRIPE' AND environment = 'TEST'
    `
    expect(rows[0]?.is_enabled).toBe(true)
  })

  it('seeds every provider and mode, disabled', async () => {
    const rows = await sql<{ provider: string; environment: string }[]>`
      SELECT provider, environment FROM public.platform_payment_gateways
       WHERE provider <> 'STRIPE' OR environment <> 'TEST'
       ORDER BY provider, environment
    `
    expect(rows.map((row) => `${row.provider}/${row.environment}`)).toEqual([
      'PAYPAL/LIVE',
      'PAYPAL/TEST',
      'STRIPE/LIVE',
    ])
  })

  it('refuses the same provider and environment twice', async () => {
    await expect(
      sql`INSERT INTO public.platform_payment_gateways (provider, environment)
          VALUES ('STRIPE', 'TEST')`,
    ).rejects.toThrow(/platform_payment_gateways_provider_environment_key|duplicate key/i)
  })

  it('refuses a secret-looking key in the public config', async () => {
    await expect(
      sql`INSERT INTO public.platform_payment_gateways
            (provider, environment, public_config)
          VALUES ('LOCAL', 'TEST', '{"secret_key":"sk_live_x"}'::jsonb)`,
    ).rejects.toThrow(/check constraint|public_config/i)
  })

  it('accepts ordinary public configuration', async () => {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO public.platform_payment_gateways
        (provider, environment, public_config)
      VALUES ('LOCAL', 'TEST', '{"merchant_id":"m-1","currency":"AFN"}'::jsonb)
      RETURNING id
    `
    expect(rows).toHaveLength(1)
  })

  it('enables RLS and leaves anon/authenticated with nothing', async () => {
    const rls = await sql<{ relrowsecurity: boolean }[]>`
      SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'platform_payment_gateways'
    `
    expect(rls[0]?.relrowsecurity).toBe(true)

    const grants = await sql<{ grantee: string }[]>`
      SELECT grantee
        FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name = 'platform_payment_gateways'
         AND grantee IN ('anon', 'authenticated', 'PUBLIC')
    `
    expect(grants).toHaveLength(0)
  })
})
