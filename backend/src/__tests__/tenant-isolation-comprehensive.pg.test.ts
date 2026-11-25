// ============================================
// backend/src/__tests__/tenant-isolation-comprehensive.pg.test.ts
//
// Real PostgreSQL cross-tenant isolation & RLS verification:
// - Two separate workspaces (wsA, wsB) and two users (userA, userB)
// - Proves cross-tenant SELECT, UPDATE, DELETE are blocked by RLS
// - Proves anon role cannot read tenant rows
// - Proves NULL workspace_id writes are rejected
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

const DOCS = resolve(__dirname, '../../..', 'docs')
const readDoc = (name: string) => readFileSync(resolve(DOCS, name), 'utf8')

const USER_A = '11111111-1111-4111-8111-11111111111a'
const USER_B = '22222222-2222-4222-8222-22222222222b'
const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CUST_A = 'cccccccc-cccc-4ccc-8ccc-ccccccccccca'
const CUST_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccb'
const PROD_A = 'dddddddd-dddd-4ddd-8ddd-ddddddddddda'
const PROD_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddb'

describe('Comprehensive Tenant Isolation & RLS (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()

    // Provide Supabase auth schema/roles shim for embedded-postgres
    await pg.sql.unsafe(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY,
        email text
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN BYPASSRLS;
        END IF;
      END $$;
    `)

    await pg.sql.unsafe(readDoc('base-schema-migration.sql'))
    await pg.sql.unsafe(readDoc('tenancy-02-migration.sql'))

    await pg.sql`INSERT INTO auth.users (id, email) VALUES (${USER_A}, 'a@test.local'), (${USER_B}, 'b@test.local')`
    await pg.sql`
      INSERT INTO public.workspaces (id, name, slug, owner_id, base_currency)
      VALUES
        (${WS_A}, 'Shop A', 'shop-a', ${USER_A}, 'AFN'),
        (${WS_B}, 'Shop B', 'shop-b', ${USER_B}, 'IRR')
    `
    await pg.sql`
      INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access)
      VALUES
        (${WS_A}, ${USER_A}, 'owner', true),
        (${WS_B}, ${USER_B}, 'owner', true)
    `
    await pg.sql`
      INSERT INTO public.customers (id, workspace_id, user_id, full_name, type)
      VALUES
        (${CUST_A}, ${WS_A}, ${USER_A}, 'Customer Alpha', 'customer'),
        (${CUST_B}, ${WS_B}, ${USER_B}, 'Customer Beta', 'customer')
    `
    await pg.sql`
      INSERT INTO public.products (id, workspace_id, user_id, name, sell_price, buy_price)
      VALUES
        (${PROD_A}, ${WS_A}, ${USER_A}, 'Product Alpha', 100, 60),
        (${PROD_B}, ${WS_B}, ${USER_B}, 'Product Beta', 200, 120)
    `

    // Enable strict RLS policies on customers and products for authenticated users
    await pg.sql.unsafe(`
      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;
      CREATE POLICY customers_tenant_isolation ON public.customers
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = customers.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.has_access = true
              AND wm.suspended_at IS NULL
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = customers.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.has_access = true
              AND wm.suspended_at IS NULL
          )
        );
      DROP POLICY IF EXISTS products_tenant_isolation ON public.products;
      CREATE POLICY products_tenant_isolation ON public.products
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = products.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.has_access = true
              AND wm.suspended_at IS NULL
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = products.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.has_access = true
              AND wm.suspended_at IS NULL
          )
        );
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
      GRANT SELECT ON public.workspace_members TO authenticated;
    `)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('prevents cross-tenant SELECT under authenticated RLS', async () => {
    const rowsA = await pg.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
      return tx`SELECT id::text, full_name FROM public.customers`
    })
    expect(rowsA.map((r) => r.id)).toEqual([CUST_A])

    const rowsB = await pg.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${USER_B}, true)`
      return tx`SELECT id::text, full_name FROM public.customers`
    })
    expect(rowsB.map((r) => r.id)).toEqual([CUST_B])
  })

  it('prevents cross-tenant UPDATE and DELETE under authenticated RLS', async () => {
    const updated = await pg.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
      return tx`UPDATE public.customers SET full_name = 'Hacked' WHERE id = ${CUST_B} RETURNING id`
    })
    expect(updated).toHaveLength(0)

    const deleted = await pg.sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
      return tx`DELETE FROM public.products WHERE id = ${PROD_B} RETURNING id`
    })
    expect(deleted).toHaveLength(0)

    // Verify wsB data untouched
    const checkB = await pg.sql`SELECT full_name FROM public.customers WHERE id = ${CUST_B}`
    expect(checkB[0]?.full_name).toBe('Customer Beta')
  })

  it('blocks cross-tenant INSERT / FK substitution under RLS WITH CHECK', async () => {
    await expect(
      pg.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT set_config('request.jwt.claim.sub', ${USER_A}, true)`
        await tx`
          INSERT INTO public.customers (workspace_id, user_id, full_name, type)
          VALUES (${WS_B}, ${USER_A}, 'Forged Cross-Tenant', 'customer')
        `
      }),
    ).rejects.toThrow()
  })

  it('denies anon role access to tenant tables', async () => {
    await expect(
      pg.sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE anon`
        return tx`SELECT id FROM public.customers`
      }),
    ).rejects.toThrow()
  })

  it('rejects NULL workspace_id writes at database constraint level', async () => {
    await expect(
      pg.sql`INSERT INTO public.customers (workspace_id, user_id, full_name) VALUES (NULL, ${USER_A}, 'Orphan')`,
    ).rejects.toThrow()
  })
})
