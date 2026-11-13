// ============================================
// backend/src/__tests__/admin-ip-allowlist-01.pg.test.ts
//
// V63 · S-5 — docs/admin-ip-allowlist-01-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE (idempotent);
//  2. accepts a bare IPv4 address, an IPv4 CIDR and an IPv6 CIDR;
//  3. refuses a malformed range and an out-of-range prefix;
//  4. refuses the same range twice;
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
const dir = pgTempDir('hisabche-pg-ip-allowlist-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/adminip`
let sql: postgres.Sql

const migration = readFileSync(
  join(__dirname, '../../../docs/admin-ip-allowlist-01-migration.sql'),
  'utf-8',
)

describe('admin-ip-allowlist-01-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE adminip`
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

  it('accepts a bare address, an IPv4 range and an IPv6 range', async () => {
    const rows = await sql<{ cidr: string }[]>`
      INSERT INTO public.admin_ip_allowlist (cidr, label, created_by)
      VALUES
        ('203.0.113.7', 'office', 'owner@hisabche.com'),
        ('198.51.100.0/24', 'vpn', 'owner@hisabche.com'),
        ('2001:db8::/32', 'datacentre', 'owner@hisabche.com')
      RETURNING cidr
    `
    expect(rows).toHaveLength(3)
  })

  it('refuses a malformed range', async () => {
    await expect(
      sql`INSERT INTO public.admin_ip_allowlist (cidr) VALUES ('not-an-ip')`,
    ).rejects.toThrow(/check constraint|admin_ip_allowlist_cidr_check/i)
  })

  it('refuses a prefix above 128', async () => {
    await expect(
      sql`INSERT INTO public.admin_ip_allowlist (cidr) VALUES ('203.0.113.0/200')`,
    ).rejects.toThrow(/check constraint|admin_ip_allowlist_cidr_check/i)
  })

  it('refuses the same range twice', async () => {
    await expect(
      sql`INSERT INTO public.admin_ip_allowlist (cidr) VALUES ('198.51.100.0/24')`,
    ).rejects.toThrow(/ux_admin_ip_allowlist_cidr|duplicate key/i)
  })

  it('enables RLS and leaves anon/authenticated with nothing', async () => {
    const rls = await sql<{ relrowsecurity: boolean }[]>`
      SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'admin_ip_allowlist'
    `
    expect(rls[0]?.relrowsecurity).toBe(true)

    const grants = await sql<{ grantee: string }[]>`
      SELECT grantee
        FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND table_name = 'admin_ip_allowlist'
         AND grantee IN ('anon', 'authenticated', 'PUBLIC')
    `
    expect(grants).toHaveLength(0)
  })

  it('serves the console read in insertion order', async () => {
    const rows = await sql<{ cidr: string }[]>`
      SELECT cidr FROM public.admin_ip_allowlist ORDER BY created_at ASC
    `
    expect(rows[0]?.cidr).toBe('203.0.113.7')
  })
})
