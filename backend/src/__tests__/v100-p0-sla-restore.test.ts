// ============================================
// backend/src/__tests__/v100-p0-sla-restore.test.ts
//
// V100 P0 (4.4 + 4.5) verification:
//   - Atomic Support Ticket transitions/comments (rollback on event table write failure)
//   - Automated SLA periodic sweep via job-scheduler (`sweepSupportSlasPeriodic`) with idempotency
//   - Complete Restore Preview validation (> 500 chunked conflict scan, DB FK fallback when
//     parent table absent, DB query failure propagation into DATABASE_VALIDATION_QUERY_FAILED)
// ============================================

import type { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-sla-owner' }
const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TICKET_DUE = 'eeeeeeee-0000-4000-8000-000000000010'
const TICKET_FUTURE = 'eeeeeeee-0000-4000-8000-000000000011'

const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])
vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance
let sweepSupportSlasPeriodic: typeof import('../plugins/job-scheduler.plugin').sweepSupportSlasPeriodic

beforeAll(async () => {
  const sched = await import('../plugins/job-scheduler.plugin')
  sweepSupportSlasPeriodic = sched.sweepSupportSlasPeriodic
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  db.tables.clear()
  db.failures.clear()
  db.writeFailures.clear()
  db.seed('workspaces', [{ id: SHOP_A, name: 'Ops Shop', base_currency: 'AFN', time_zone: 'UTC' }])
  db.seed('workspace_members', [
    {
      id: fakeId('ma'),
      workspace_id: SHOP_A,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('support_tickets', [
    {
      id: TICKET_DUE,
      workspace_id: SHOP_A,
      ticket_code: 'HSB-DUE-1',
      subject: 'Overdue printer driver crash',
      priority: 'critical',
      category: 'pos',
      description: 'Printer halts',
      sla_hours: 2,
      response_due_at: new Date(Date.now() - 3600_000).toISOString(),
      status: 'open',
      escalation_level: 0,
      created_by: OWNER.id,
    },
    {
      id: TICKET_FUTURE,
      workspace_id: SHOP_A,
      ticket_code: 'HSB-FUT-1',
      subject: 'Question on tax code',
      priority: 'low',
      category: 'accounting',
      description: 'Need report tip',
      sla_hours: 48,
      response_due_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      status: 'open',
      escalation_level: 0,
      created_by: OWNER.id,
    },
  ])
  db.seed('support_ticket_events', [])
  db.seed('support_ticket_comments', [])
  db.seed('activities', [])
  db.seed('invoices', [])
})

describe('V100 P0 (4.4 + 4.5) — Atomic Support SLA & Complete Restore Preview', () => {
  it('rolls back ticket transition atomically on event write error and runs idempotent automated SLA sweep', async () => {
    const hdr = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }

    // Write failure on support_ticket_events must NOT mutate support_tickets status
    db.failWrite('support_ticket_events', { message: 'append-only audit failure' })
    const failedTransition = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${TICKET_FUTURE}/status`,
      headers: hdr,
      payload: { status: 'acknowledged' },
    })
    expect(failedTransition.statusCode).toBe(500)
    db.writeFailures.clear()
    expect(db.rows('support_tickets').find((t) => t.id === TICKET_FUTURE)?.status).toBe('open')

    // Automated scheduler sweep escalates ONLY overdue ticket and writes immutable event + notification
    await sweepSupportSlasPeriodic()
    expect(db.rows('support_tickets').find((t) => t.id === TICKET_DUE)?.status).toBe('escalated')
    expect(db.rows('support_tickets').find((t) => t.id === TICKET_FUTURE)?.status).toBe('open')
    expect(
      db.rows('support_ticket_events').filter((e) => e.action === 'sla_breached'),
    ).toHaveLength(1)
    expect(db.rows('activities').filter((a) => a.entity_id === TICKET_DUE)).toHaveLength(1)

    // Repeat automated sweep is strictly idempotent (zero duplicate escalation events)
    await sweepSupportSlasPeriodic()
    expect(db.rows('support_tickets').find((t) => t.id === TICKET_DUE)?.escalation_level).toBe(1)
    expect(
      db.rows('support_ticket_events').filter((e) => e.action === 'sla_breached'),
    ).toHaveLength(1)
  })

  it('checks >500 chunked ID conflicts, validates parent DB FKs, and propagates DB validation failures', async () => {
    const hdr = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }

    // Seed 650 products, with ID #610 existing in DB (beyond old 500-row slice!)
    const conflictId = '99999999-0000-4000-8000-000000000610'
    db.seed('products', [{ id: conflictId, workspace_id: SHOP_A, name: 'Existing item 610' }])
    const products = Array.from({ length: 650 }, (_, idx) => ({
      id: `99999999-0000-4000-8000-${String(idx).padStart(12, '0')}`,
      workspace_id: SHOP_A,
      name: `Item ${idx}`,
    }))
    // Child invoice_items referencing an absent invoice_id (invoices table omitted from archive AND DB)
    const missingInvId = '88888888-0000-4000-8000-000000000999'
    const backupData = {
      products,
      invoice_items: [
        {
          id: '77777777-0000-4000-8000-000000000001',
          workspace_id: SHOP_A,
          invoice_id: missingInvId,
          product_name: 'Orphan line',
        },
      ],
    }
    const checksumSha256 = createHash('sha256').update(JSON.stringify(backupData)).digest('hex')

    const res = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: hdr,
      payload: {
        meta: { workspaceId: SHOP_A, schemaVersion: '1.0', checksumSha256 },
        data: backupData,
      },
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json().data
    expect(body.restoreExecutionSupported).toBe(false)
    expect(body.valid).toBe(false)
    expect(body.existingConflicts).toHaveLength(1)
    expect(body.existingConflicts[0]?.id).toBe(conflictId)
    expect(body.brokenForeignKeys).toHaveLength(1)
    expect(body.missingDependencyCount).toBe(1)
    expect(body.wouldSkip).toBe(1)
    expect(body.wouldUpdate).toBe(0)
    expect(body.errors).toContain('BROKEN_FOREIGN_KEY')

    // DB failure during validation must mark valid=false and include DATABASE_VALIDATION_QUERY_FAILED
    db.fail('products', { message: 'preview read timeout' })
    const dbFailRes = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: hdr,
      payload: {
        meta: { workspaceId: SHOP_A, schemaVersion: '1.0' },
        data: { products: [{ id: '12345678-0000-4000-8000-000000000001', workspace_id: SHOP_A }] },
      },
    })
    expect(dbFailRes.statusCode).toBe(200)
    expect(dbFailRes.json().data.valid).toBe(false)
    expect(dbFailRes.json().data.errors).toContain('DATABASE_VALIDATION_QUERY_FAILED')
  })
})
