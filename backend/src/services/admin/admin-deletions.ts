// ============================================
// backend/src/services/admin/admin-deletions.ts
//
// Owner request (12 Nov 2026): «تأیید دو نفره برای حذف‌ها» — a deletion in the
// platform console needs a SECOND admin.
//
// Two console deletions take something away from a person:
//   - MEMBER_REMOVE        a member loses access to a business;
//   - IP_ALLOWLIST_REMOVE  an address loses access to this console.
// Both used to happen on one admin's click (step-up only). Now the click
// PROPOSES an `admin_action_requests` row; the deletion runs only when a
// different admin approves it (`decideActionRequest` already refuses the
// proposer), and it runs BEFORE the row reads APPROVED — the same rule as a
// secret rotation: a row that says «approved» over a deletion that failed is
// a lie the console would show as truth.
//
// ⚠️ No fallback. Before admin-action-types-03 the CHECK constraint refuses
// the two new types; that is a 503 «not installed», never a direct delete.
// ============================================

import { BaseError } from '../../errors/base.error'
import { AdminService } from '../admin.service'
import { AdminSecurityService } from './admin-security.service'
import { adminIpAllowlistService } from './admin-ip-allowlist.service'

export const DELETION_ACTIONS = ['MEMBER_REMOVE', 'IP_ALLOWLIST_REMOVE'] as const
export type DeletionAction = (typeof DELETION_ACTIONS)[number]

export function isDeletionAction(value: unknown): value is DeletionAction {
  return typeof value === 'string' && (DELETION_ACTIONS as readonly string[]).includes(value)
}

/** admin-action-types-03 not run: the CHECK constraint does not know the type. */
export class AdminActionTypeNotInstalledError extends BaseError {
  readonly code = 'ADMIN_ACTION_TYPE_NOT_INSTALLED'
  constructor() {
    super('ADMIN_ACTION_TYPE_NOT_INSTALLED: run docs/admin-action-types-03-migration.sql', 503)
    this.name = 'AdminActionTypeNotInstalledError'
  }
}

/** The insert was refused by the action-type CHECK — not any other failure. */
export function isUnknownActionType(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return message.includes('admin_action_requests_action_type_check')
}

/**
 * Carry out an approved deletion. Called by `decideActionRequest` after the
 * approver is proven to differ from the proposer, and before the row is
 * marked APPROVED — a throw here leaves the request PENDING.
 */
export async function executeApprovedDeletion(
  actionType: DeletionAction,
  payload: Record<string, unknown>,
  approver: { id: string; email: string },
): Promise<void> {
  const id = typeof payload.id === 'string' ? payload.id : null
  if (!id) throw new Error(`${actionType} request carries no id`)

  if (actionType === 'MEMBER_REMOVE') {
    await new AdminService().removeMember(
      {
        adminUserId: approver.id,
        reason: 'two-person approval',
      },
      id,
    )
    return
  }

  await adminIpAllowlistService.removeEntry(id)
  await AdminSecurityService.logSecurityEvent({
    eventType: 'ADMIN_IP_ALLOWLIST_REMOVED',
    adminEmail: approver.email,
    details: { id, approvedBy: approver.email },
  })
}
