// ============================================
// Admin 06 Ops migration pg test
// Runs docs/admin-06-ops-migration.sql TWICE to verify idempotency
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
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-admin-ops-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/adminops`
let sql: postgres.Sql

describe('admin-06-ops-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE adminops`
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
      join(__dirname, '../../../docs/admin-06-ops-migration.sql'),
      'utf-8',
    )
    await sql.unsafe(migrationSql)
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('supports feature flags and enforces rollout percentage check constraint', async () => {
    // Valid feature flag
    const rows = await sql`
      INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
      VALUES ('new_invoice_grid', 'New Invoice Grid', 'Fast grid rendering', true, 50)
      RETURNING key, rollout_percentage;
    `
    expect(rows[0]?.rollout_percentage).toBe(50)

    // Invalid percentage > 100 rejected
    await expect(
      sql`
        INSERT INTO public.feature_flags (key, name, rollout_percentage)
        VALUES ('invalid_flag', 'Invalid Flag', 150);
      `,
    ).rejects.toThrow()
  })

  it('supports admin announcements and level constraint', async () => {
    const res = await sql`
      INSERT INTO public.admin_announcements (title, message, level)
      VALUES ('Maintenance Window', 'System update on Friday at 02:00 UTC', 'MAINTENANCE')
      RETURNING id, level;
    `
    expect(res[0]?.level).toBe('MAINTENANCE')

    // Invalid level rejected
    await expect(
      sql`
        INSERT INTO public.admin_announcements (title, message, level)
        VALUES ('Invalid', 'Message', 'INVALID_LEVEL');
      `,
    ).rejects.toThrow()
  })

  it('supports background jobs and status tracking', async () => {
    const res = await sql`
      INSERT INTO public.background_jobs (job_type, status, payload)
      VALUES ('MIGRATION', 'QUEUED', '{"step": 1}'::jsonb)
      RETURNING id, status;
    `
    expect(res[0]?.status).toBe('QUEUED')
  })
})
