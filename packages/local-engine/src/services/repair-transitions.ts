// ============================================
// packages/local-engine/src/services/repair-transitions.ts
//
// Shared repair ticket transition & part-consumption checks on the local
// engine SQLite cache, invoking the canonical `@hisabche/validation` rules
// (`repairMoveRefusal`, `repairEstimateRefusal`, `canConsumePartsOnRepair`)
// so illegal transitions refuse identically on both server and device.
// ============================================

// Not node:crypto: Metro (Android/iOS) has no Node built-ins (12 Nov 2026 release build).
import { newId } from '../routes/people-common'
import {
  canConsumePartsOnRepair,
  repairMoveRefusal,
  type RepairStatus,
  type RepairTicketMoveInput,
} from '@hisabche/validation'
import type { LocalDb } from '../db'
import { ConflictError, NotFoundError, ValidationError } from '../errors'

export interface LocalRepairTicketRow {
  id: string
  workspace_id: string
  status: RepairStatus
  customer_approved: number
  invoice_id: string | null
  updated_at: string
  closed_at: string | null
}

/**
 * Validates and applies a repair ticket status move against local SQLite using
 * the exact same refusal codes as the server (`REPAIR_MOVE_NOT_ALLOWED`,
 * `REPAIR_CANCEL_NOTE_REQUIRED`, `REPAIR_INVOICE_ONLY_ON_DELIVERY`, `REPAIR_TICKET_CHANGED`).
 */
export function applyLocalRepairTransition(
  db: LocalDb,
  workspaceId: string,
  actorId: string,
  ticketId: string,
  input: RepairTicketMoveInput,
): { status: RepairStatus; updatedAt: string; closedAt: string | null } {
  const row = db.get<LocalRepairTicketRow>(
    `SELECT id, workspace_id, status, customer_approved, invoice_id, updated_at, closed_at
       FROM repair_tickets
      WHERE id = ? AND workspace_id = ?`,
    [ticketId, workspaceId],
  )
  if (!row) throw new NotFoundError('Repair ticket', ticketId)

  const refusal = repairMoveRefusal(row.status, input)
  if (refusal) {
    throw new ValidationError(refusal)
  }

  const nowIso = new Date().toISOString()
  const closedAt =
    input.status === 'delivered' || input.status === 'cancelled'
      ? (row.closed_at ?? nowIso)
      : row.closed_at

  const result = db.transaction(() => {
    const changed = db.run(
      `UPDATE repair_tickets
          SET status = ?,
              invoice_id = COALESCE(?, invoice_id),
              updated_at = ?,
              closed_at = ?
        WHERE id = ? AND workspace_id = ? AND status = ?`,
      [input.status, input.invoiceId ?? null, nowIso, closedAt, ticketId, workspaceId, row.status],
    )
    if (changed.changes !== 1) throw new ConflictError('REPAIR_TICKET_CHANGED')

    db.run(
      `INSERT INTO repair_ticket_events (id, workspace_id, ticket_id, from_status, to_status, note, actor_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        workspaceId,
        ticketId,
        row.status,
        input.status,
        input.note ?? null,
        actorId,
        nowIso,
      ],
    )
    return { status: input.status, updatedAt: nowIso, closedAt }
  })

  return result
}

/**
 * Checks whether a local repair ticket can consume spare parts under the exact
 * same `canConsumePartsOnRepair` rule used by the server.
 */
export function assertLocalRepairCanConsumeParts(
  db: LocalDb,
  workspaceId: string,
  ticketId: string,
): void {
  const row = db.get<LocalRepairTicketRow>(
    `SELECT id, workspace_id, status, customer_approved, invoice_id, updated_at, closed_at
       FROM repair_tickets
      WHERE id = ? AND workspace_id = ?`,
    [ticketId, workspaceId],
  )
  if (!row) throw new NotFoundError('Repair ticket', ticketId)
  const gate = canConsumePartsOnRepair({
    status: row.status,
    customerApproved: Boolean(row.customer_approved),
  })
  if (!gate.allowed) throw new ValidationError(gate.reason ?? 'REPAIR_APPROVAL_REQUIRED')
}
