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

  it('prevents duplicate escalation on repeated escalated transition, supports atomic ticket create/assign, and records system actor & sent/failed notification status on SLA sweep', async () => {
    const hdr = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }

    // 1. Atomic ticket creation with idempotency key
    const c1 = await app.inject({
      method: 'POST',
      url: '/api/v1/support-tickets',
      headers: { ...hdr, 'idempotency-key': 'tkt-idem-1' },
      payload: {
        subject: 'Drawer stuck',
        priority: 'high',
        category: 'pos',
        description: 'Cash drawer does not pop',
      },
    })
    expect(c1.statusCode, c1.body).toBe(201)
    const ticketId = c1.json().data.id

    const c2 = await app.inject({
      method: 'POST',
      url: '/api/v1/support-tickets',
      headers: { ...hdr, 'idempotency-key': 'tkt-idem-1' },
      payload: {
        subject: 'Drawer stuck',
        priority: 'high',
        category: 'pos',
        description: 'Cash drawer does not pop',
      },
    })
    expect(c2.statusCode).toBe(200)
    expect(c2.json().replay).toBe(true)

    // 2. Repeated escalated transition does NOT increment escalation_level twice or emit duplicate events
    const esc1 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: hdr,
      payload: { status: 'escalated', reason: 'Urgent' },
    })
    expect(esc1.statusCode).toBe(200)
    expect(esc1.json().data.escalation_level).toBe(1)

    const esc2 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/support-tickets/${ticketId}/status`,
      headers: hdr,
      payload: { status: 'escalated', reason: 'Repeated click' },
    })
    expect(esc2.statusCode).toBe(200)
    expect(esc2.json().data.escalation_level).toBe(1)
    const statusEvents = (db.tables.get('support_ticket_events') ?? []).filter(
      (e) => e.ticket_id === ticketId && e.action === 'status_changed',
    )
    expect(statusEvents).toHaveLength(1)

    // 3. System SLA sweep records actor_id = null (system) and notification_status = sent
    await sweepSupportSlasPeriodic()
    const breachEv = (db.tables.get('support_ticket_events') ?? []).find(
      (e) => e.ticket_id === TICKET_DUE && e.action === 'sla_breached',
    )
    expect(breachEv?.actor_id).toBeNull()
    expect(breachEv?.notification_status).toBe('sent')
  })

  it('classifies restore preview rows into mutually exclusive CREATE/SKIP/REJECT totals and never reports BROKEN_FOREIGN_KEY on parent query error', async () => {
    const hdr = { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A }
    const existingProdId = '12345678-0000-4000-8000-000000000010'
    db.seed('products', [{ id: existingProdId, workspace_id: SHOP_A, name: 'Existing' }])

    // Row 1: existing product -> SKIP
    // Row 2: valid new product -> CREATE
    // Row 3: multiple defects (bad currency + bad timestamp + cross-tenant) -> REJECT counted ONCE
    // Row 4: missing id -> REJECT
    // Row 5: invalid non-UUID id -> REJECT
    const res = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: hdr,
      payload: {
        meta: { workspaceId: SHOP_A, schemaVersion: '1.0' },
        data: {
          products: [
            { id: existingProdId, workspace_id: SHOP_A, currency: 'AFN', sell_price: 100 },
            {
              id: '12345678-0000-4000-8000-000000000011',
              workspace_id: SHOP_A,
              currency: 'USD',
              sell_price: 12.5,
            },
            {
              id: '12345678-0000-4000-8000-000000000012',
              workspace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              currency: 'ZZZ',
              created_at: 'not-a-date',
            },
            { workspace_id: SHOP_A },
            { id: 'not-a-uuid', workspace_id: SHOP_A },
          ],
        },
      },
    })
    expect(res.statusCode).toBe(200)
    const d = res.json().data
    expect(d.totalInputRows).toBe(5)
    expect(d.wouldSkip).toBe(1)
    expect(d.wouldCreate).toBe(1)
    expect(d.rejectedRows).toBe(3)
    expect(d.wouldCreate + d.wouldSkip + d.rejectedRows).toBe(d.totalInputRows)
    expect(d.errors).toContain('INVALID_CURRENCY_CODE')
    expect(d.errors).toContain('INVALID_ROW_UUID')
    expect(d.errors).toContain('MISSING_ROW_ID')

    // Parent FK query error must NOT invent BROKEN_FOREIGN_KEY
    db.fail('invoices', { message: 'parent lookup failed' })
    const fkErrRes = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${SHOP_A}/export-restore-preview`,
      headers: hdr,
      payload: {
        meta: { workspaceId: SHOP_A, schemaVersion: '1.0' },
        data: {
          invoice_items: [
            {
              id: '77777777-0000-4000-8000-000000000099',
              workspace_id: SHOP_A,
              invoice_id: '88888888-0000-4000-8000-000000000099',
            },
          ],
        },
      },
    })
    expect(fkErrRes.statusCode).toBe(200)
    expect(fkErrRes.json().data.errors).toContain('DATABASE_VALIDATION_QUERY_FAILED')
    expect(fkErrRes.json().data.errors).not.toContain('BROKEN_FOREIGN_KEY')
  })
})
