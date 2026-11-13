// ============================================
// backend/src/__tests__/admin-action-types-02.pg.test.ts
//
// V63 · S-1 — docs/admin-action-types-02-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE (idempotent) on top of admin-04;
//  2. accepts every maker-checker action V63 needs;
//  3. still refuses an invented action type;
//  4. keeps every pre-existing billing type valid.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-action-types-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/actiontypes`
let sql: postgres.Sql

const billing = readFileSync(
  join(__dirname, '../../../docs/admin-04-billing-migration.sql'),
  'utf-8',
)
const migration = readFileSync(
  join(__dirname, '../../../docs/admin-action-types-02-migration.sql'),
  'utf-8',
)

const V63_TYPES = [
  'SECRET_ROTATE',
  'GATEWAY_ENABLE',
  'SERVER_SCALE_UP',
  'ADMIN_ROLE_GRANT',
  'BULK_EXPORT',
] as const
const BILLING_TYPES = [
  'REFUND',
  'LEDGER_ADJUSTMENT',
  'PRICE_CHANGE',
  'DOWNGRADE',
  'LICENSE_TRANSFER',
] as const

describe('admin-action-types-02-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE actiontypes`
    await root.end()
    sql = postgres(url)
    await sql.unsafe(billing)
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

  it('accepts every V63 maker-checker action', async () => {
    for (const actionType of V63_TYPES) {
      const rows = await sql<{ id: string }[]>`
        INSERT INTO public.admin_action_requests
          (action_type, payload, diff_preview, proposed_by, status)
        VALUES (${actionType}, '{}'::jsonb, '{}'::jsonb, 'maker@hisabche.com', 'PENDING')
        RETURNING id
      `
      expect(rows).toHaveLength(1)
    }
  })

  it('still accepts every pre-existing billing action', async () => {
    for (const actionType of BILLING_TYPES) {
      const rows = await sql<{ id: string }[]>`
        INSERT INTO public.admin_action_requests
          (action_type, payload, diff_preview, proposed_by, status)
        VALUES (${actionType}, '{}'::jsonb, '{}'::jsonb, 'maker@hisabche.com', 'PENDING')
        RETURNING id
      `
      expect(rows).toHaveLength(1)
    }
  })

  it('refuses an invented action type', async () => {
    await expect(
      sql`INSERT INTO public.admin_action_requests (action_type, proposed_by)
          VALUES ('DELETE_EVERYTHING', 'maker@hisabche.com')`,
    ).rejects.toThrow(/admin_action_requests_action_type_check|check constraint/i)
  })

  it('keeps the proposer != approver rule available (same row shape)', async () => {
    const rows = await sql<{ proposed_by: string; status: string }[]>`
      SELECT proposed_by, status FROM public.admin_action_requests
       WHERE action_type = 'SECRET_ROTATE' LIMIT 1
    `
    expect(rows[0]?.status).toBe('PENDING')
    expect(rows[0]?.proposed_by).toBe('maker@hisabche.com')
  })
})
