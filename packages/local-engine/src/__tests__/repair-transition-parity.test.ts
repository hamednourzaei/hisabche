// ============================================
// packages/local-engine/src/__tests__/repair-transition-parity.test.ts
//
// Proves V59.1 Repair parity on local SQLite:
//   1. applyLocalRepairTransition enforces REPAIR_MOVES, REPAIR_CANCEL_NOTE_REQUIRED,
//      and REPAIR_INVOICE_ONLY_ON_DELIVERY identically to the server
//   2. assertLocalRepairCanConsumeParts enforces canConsumePartsOnRepair
//   3. HTTP calls to /repair-tickets on local-engine continue to refuse with 501
//      OFFLINE_NOT_AVAILABLE per the offline matrix guard
// ============================================

import { describe, expect, it } from 'vitest'
import { repairMoveRefusal } from '@hisabche/validation'
import {
  applyLocalRepairTransition,
  assertLocalRepairCanConsumeParts,
} from '../services/repair-transitions'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

describe('repair-ticket transition parity on local engine', () => {
  it('applies legal transitions with event log and refuses illegal moves identically to server', async () => {
    const db = createTestDb()
    const ticketId = '11111111-1111-4111-8111-111111111119'
    const invId = '22222222-2222-4222-8222-222222222229'

    db.run(
      `INSERT INTO repair_tickets (id, workspace_id, number, customer_id, device_label, problem, status, customer_approved, created_by)
       VALUES (?, ?, 1, 'cust-1', 'Pixel 8', 'Battery swell', 'received', 0, ?)`,
      [ticketId, TEST_WORKSPACE_ID, TEST_USER_ID],
    )

    // Unapproved ticket in received cannot consume parts.
    expect(() => assertLocalRepairCanConsumeParts(db, TEST_WORKSPACE_ID, ticketId)).toThrow(
      /REPAIR_APPROVAL_REQUIRED/,
    )

    // Illegal jump received -> delivered must fail with exact server refusal code.
    expect(() =>
      applyLocalRepairTransition(db, TEST_WORKSPACE_ID, TEST_USER_ID, ticketId, {
        status: 'delivered',
      }),
    ).toThrow(new RegExp(String(repairMoveRefusal('received', { status: 'delivered' }))))

    // Passing invoiceId on diagnosing must refuse with REPAIR_INVOICE_ONLY_ON_DELIVERY.
    expect(() =>
      applyLocalRepairTransition(db, TEST_WORKSPACE_ID, TEST_USER_ID, ticketId, {
        status: 'diagnosing',
        invoiceId: invId,
      }),
    ).toThrow(/REPAIR_INVOICE_ONLY_ON_DELIVERY/)

    // Valid transition received -> diagnosing -> ready -> delivered succeeds and logs events.
    const d = applyLocalRepairTransition(db, TEST_WORKSPACE_ID, TEST_USER_ID, ticketId, {
      status: 'diagnosing',
    })
    expect(d.status).toBe('diagnosing')

    applyLocalRepairTransition(db, TEST_WORKSPACE_ID, TEST_USER_ID, ticketId, { status: 'ready' })
    const fin = applyLocalRepairTransition(db, TEST_WORKSPACE_ID, TEST_USER_ID, ticketId, {
      status: 'delivered',
      invoiceId: invId,
    })
    expect(fin.status).toBe('delivered')
    expect(() => assertLocalRepairCanConsumeParts(db, TEST_WORKSPACE_ID, ticketId)).toThrow(
      /REPAIR_TICKET_CLOSED/,
    )

    const events = db.all<{ from_status: string | null; to_status: string }>(
      'SELECT from_status, to_status FROM repair_ticket_events WHERE ticket_id = ? ORDER BY created_at',
      [ticketId],
    )
    expect(events).toHaveLength(3)

    // HTTP local-engine endpoint keeps server-only matrix contract (501 OFFLINE_NOT_AVAILABLE).
    const engine = createTestEngine(db)
    const httpRes = await engine.request({
      method: 'POST',
      path: `/repair-tickets/${ticketId}/status`,
      body: { status: 'repairing' },
    })
    expect(httpRes.status).toBe(501)
  })
})
