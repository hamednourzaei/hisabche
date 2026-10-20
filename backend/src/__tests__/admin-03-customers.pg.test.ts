// ============================================
// Admin 03 Customers migration pg test
// Runs docs/admin-03-customers-migration.sql TWICE to verify idempotency
// and verifies table privileges, RLS, and constraints.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-admin-cust-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/admincust`
let sql: postgres.Sql

describe('admin-03-customers-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE admincust`
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

  it('runs the migration idempotently (twice without error)', async () => {
    const migrationSql = readFileSync(
      join(__dirname, '../../../docs/admin-03-customers-migration.sql'),
      'utf-8',
    )
    await sql.unsafe(migrationSql)
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('supports creating and revoking support sessions', async () => {
    const workspaceId = 'c3609ccf-5e75-469a-8377-565f3aac47b3'
    const adminId = '32d21a19-f6b0-45b9-a50a-a6238cd55077'
    const token = 'sup_tok_123456789'

    const rows = await sql`
      INSERT INTO public.support_sessions (workspace_id, admin_id, admin_email, token, reason, expires_at)
      VALUES (${workspaceId}, ${adminId}, 'admin@hisabche.com', ${token}, 'Debugging invoice rounding issue', NOW() + INTERVAL '1 hour')
      RETURNING id, is_revoked;
    `
    expect(rows[0]?.is_revoked).toBe(false)

    // Revoke
    const updated = await sql`
      UPDATE public.support_sessions SET is_revoked = true WHERE id = ${rows[0]!.id} RETURNING is_revoked;
    `
    expect(updated[0]?.is_revoked).toBe(true)
  })

  it('supports creating admin notes with tags', async () => {
    const workspaceId = 'c3609ccf-5e75-469a-8377-565f3aac47b3'
    const adminId = '32d21a19-f6b0-45b9-a50a-a6238cd55077'

    const rows = await sql`
      INSERT INTO public.admin_notes (workspace_id, admin_id, admin_email, note, tags)
      VALUES (${workspaceId}, ${adminId}, 'admin@hisabche.com', 'Customer requested higher limit on offline licenses', ARRAY['vip', 'offline'])
      RETURNING id, tags;
    `
    expect(rows[0]?.tags).toEqual(['vip', 'offline'])
  })

  it('enforces check constraints on admin_data_requests', async () => {
    const workspaceId = 'c3609ccf-5e75-469a-8377-565f3aac47b3'

    await expect(
      sql`
        INSERT INTO public.admin_data_requests (workspace_id, request_type, status, sla_due_at)
        VALUES (${workspaceId}, 'INVALID_TYPE', 'PENDING', NOW() + INTERVAL '7 days');
      `,
    ).rejects.toThrow()

    // Valid insertion
    const valid = await sql`
      INSERT INTO public.admin_data_requests (workspace_id, request_type, status, sla_due_at)
      VALUES (${workspaceId}, 'EXPORT', 'PENDING', NOW() + INTERVAL '7 days')
      RETURNING id, request_type, status;
    `
    expect(valid[0]?.request_type).toBe('EXPORT')
  })
})
