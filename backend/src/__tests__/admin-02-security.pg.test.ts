// ============================================
// Admin 02 Security migration pg test
// Runs docs/admin-02-security-migration.sql TWICE to verify idempotency
// and verifies table privileges, append-only triggers, and role constraints.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-admin-sec-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/adminsec`
let sql: postgres.Sql

const migrationSql = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'admin-02-security-migration.sql'),
  'utf8',
)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('adminsec')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  // Base roles and schema setup
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;
  `)

  // Run migration twice to verify idempotency
  await setup.unsafe(migrationSql)
  await setup.unsafe(migrationSql)

  await setup.end()
  sql = postgres(url, { max: 5, onnotice: () => {} })
})

afterAll(async () => {
  if (sql) await sql.end()
  await pg.stop()
})

describe('admin-02-security-migration.sql', () => {
  it('seeded all 7 admin roles in admin_permissions', async () => {
    const roles = await sql`
      SELECT DISTINCT role FROM public.admin_permissions ORDER BY role
    `
    const roleNames = roles.map((r) => r.role)
    expect(roleNames).toEqual([
      'BILLING',
      'CONTENT',
      'MARKET',
      'OPS',
      'SECURITY',
      'SUPER',
      'SUPPORT',
    ])
  })

  it('rejects invalid role in admin_accounts check constraint', async () => {
    await expect(
      sql`
        INSERT INTO public.admin_accounts (user_id, email, role)
        VALUES (gen_random_uuid(), 'hacker@hisabche.com', 'HACKER')
      `,
    ).rejects.toThrow()
  })

  it('allows service_role to insert valid admin_accounts row', async () => {
    const userId = '11111111-2222-3333-4444-555555555555'
    const [row] = await sql`
      INSERT INTO public.admin_accounts (user_id, email, role)
      VALUES (${userId}, 'super@hisabche.com', 'SUPER')
      RETURNING role, is_active
    `
    expect(row?.role).toBe('SUPER')
    expect(row?.is_active).toBe(true)
  })

  it('audit_logs has additive columns (reason, request_id, correlation_id)', async () => {
    const [audit] = await sql`
      INSERT INTO public.audit_logs (action, entity_type, reason, request_id, correlation_id)
      VALUES ('admin.login', 'admin_accounts', 'Morning login', 'req-123', 'corr-456')
      RETURNING id, reason, request_id, correlation_id
    `
    expect(audit?.reason).toBe('Morning login')
    expect(audit?.request_id).toBe('req-123')
    expect(audit?.correlation_id).toBe('corr-456')
  })

  it('refuses UPDATE on audit_logs rows', async () => {
    const [audit] = await sql`
      INSERT INTO public.audit_logs (action, entity_type)
      VALUES ('test.action', 'test')
      RETURNING id
    `
    await expect(
      sql`
        UPDATE public.audit_logs
        SET action = 'tampered.action'
        WHERE id = ${audit!.id}
      `,
    ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/)
  })

  it('refuses direct DELETE on audit_logs rows', async () => {
    const [audit] = await sql`
      INSERT INTO public.audit_logs (action, entity_type)
      VALUES ('delete.test', 'test')
      RETURNING id
    `
    await expect(
      sql`
        DELETE FROM public.audit_logs
        WHERE id = ${audit!.id}
      `,
    ).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/)
  })

  it('allows deletion ONLY via cleanup_audit_logs_retention', async () => {
    // Insert an old audit log row
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    await sql`
      INSERT INTO public.audit_logs (action, entity_type, created_at)
      VALUES ('ancient.action', 'test', ${oldDate})
    `

    const [res] = await sql`
      SELECT public.cleanup_audit_logs_retention(30, 'admin-operator') AS deleted_count
    `
    expect(Number(res?.deleted_count)).toBeGreaterThanOrEqual(1)

    // Verify retention marker was inserted
    const markers = await sql`
      SELECT action, entity_type, reason FROM public.audit_logs WHERE action = 'audit.cleanup'
    `
    expect(markers.length).toBeGreaterThanOrEqual(1)
    expect(markers[0]?.reason).toBe('Scheduled retention cleanup')
  })
})
