// ============================================
// Admin 04 Billing migration pg test
// Runs docs/admin-04-billing-migration.sql TWICE to verify idempotency
// and verifies Maker-Checker constraints and billing ledger immutability.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-admin-bill-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/adminbill`
let sql: postgres.Sql

describe('admin-04-billing-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE adminbill`
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
      join(__dirname, '../../../docs/admin-04-billing-migration.sql'),
      'utf-8',
    )
    await sql.unsafe(migrationSql)
    await expect(sql.unsafe(migrationSql)).resolves.toBeDefined()
  })

  it('enforces Maker-Checker constraint: proposer CANNOT approve own request', async () => {
    // 1. Propose request
    const rows = await sql`
      INSERT INTO public.admin_action_requests (action_type, payload, proposed_by)
      VALUES ('REFUND', '{"amount": 1000000}'::jsonb, 'admin1@hisabche.com')
      RETURNING id, status, proposed_by;
    `
    expect(rows[0]?.status).toBe('PENDING')

    // 2. Proposer attempts to approve own request -> throws check constraint violation!
    await expect(
      sql`
        UPDATE public.admin_action_requests 
        SET status = 'APPROVED', approved_by = 'admin1@hisabche.com', decided_at = NOW()
        WHERE id = ${rows[0]!.id};
      `,
    ).rejects.toThrow()

    // 3. Different approver approves request -> success!
    const approved = await sql`
      UPDATE public.admin_action_requests 
      SET status = 'APPROVED', approved_by = 'admin2@hisabche.com', decided_at = NOW()
      WHERE id = ${rows[0]!.id}
      RETURNING status, approved_by;
    `
    expect(approved[0]?.status).toBe('APPROVED')
    expect(approved[0]?.approved_by).toBe('admin2@hisabche.com')
  })

  it('enforces idempotency key uniqueness on billing ledger entries', async () => {
    const workspaceId = 'c3609ccf-5e75-469a-8377-565f3aac47b3'
    const ikey = 'idem-key-refund-001'

    await sql`
      INSERT INTO public.billing_ledger_entries (workspace_id, entry_type, amount_irr, description, actor_email, idempotency_key)
      VALUES (${workspaceId}, 'REFUND', -5000000, 'Customer refund', 'admin@hisabche.com', ${ikey});
    `

    // Duplicate idempotency_key must be rejected
    await expect(
      sql`
        INSERT INTO public.billing_ledger_entries (workspace_id, entry_type, amount_irr, description, actor_email, idempotency_key)
        VALUES (${workspaceId}, 'REFUND', -5000000, 'Customer refund duplicate', 'admin@hisabche.com', ${ikey});
      `,
    ).rejects.toThrow()
  })

  it('supports versioned plan prices', async () => {
    const res = await sql`
      INSERT INTO public.plan_prices (plan, amount_irr, effective_from, effective_until, created_by)
      VALUES ('ONLINE_500', 50000000, NOW() - INTERVAL '30 days', NOW() + INTERVAL '30 days', 'admin@hisabche.com')
      RETURNING plan, amount_irr;
    `
    expect(res[0]?.amount_irr).toBe('50000000')
  })
})
