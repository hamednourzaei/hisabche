// ============================================
// Capability #68 — escalation of a stalled approval.
// Engine N17.
//
// ⚠️ THIS TURNS DEAD CODE INTO A CAPABILITY.
//
// `approval.domain.ts#shouldEscalate` and `escalatedRole` were written, fully
// tested, and called by nothing — the pattern `§7.1` calls «correct code nobody
// can find», and it was on the unwired register from 30 September until this
// file gave it a caller. The register entry is deleted when the guard goes green,
// which is what the guard is for.
//
// ⚠️ ESCALATION MOVES THE QUESTION UP, IT DOES NOT DECIDE IT.
//
// When a step waits past its deadline, the escalation reassigns WHO must act.
// It does not approve anything, does not skip a step, and does not time out into
// an approval. A document nobody approved is still unapproved after the
// escalation fires — it has simply stopped waiting for the wrong person.
//
// That separation is the whole safety property. The alternative — an approval
// that fires because nobody answered — is a document moving money on the basis
// of a calendar, and `approval-gate.domain.ts` already established that an
// approval which decides nothing is worse than no approval at all.
//
// ⚠️ AND IT NEVER ESCALATES INTO NOTHING.
//
// A step whose next role has nobody holding it must be REPORTED, not silently
// kept waiting or quietly approved. An escalation that lands on an empty role is
// a document stuck forever with a log entry saying it moved — which is the most
// confusing state a workflow can be in.
// ============================================

import type { WorkspaceRole } from '../authorization/authorization.domain'

/** The role order escalation walks. Chosen, not computed. */
const ROLE_ORDER: WorkspaceRole[] = ['seller', 'manager', 'owner']

export interface EscalationPolicy {
  /** Hours a step may wait before it is escalated. Zero means never. */
  afterHours: number
  /** Where it goes. Must be HIGHER than the current role or it is refused. */
  toRole: WorkspaceRole
  /** How many times the same document may be escalated. */
  maxTimes?: number
}

export type EscalationVerdict =
  /** Move it up. */
  | { escalate: true; toRole: WorkspaceRole; hoursWaiting: number }
  /** Not yet, or not again. Both are normal states, not warnings. */
  | { escalate: false; reason: 'NOT_DUE' | 'EXHAUSTED' | 'POLICY_OFF' | 'NO_HIGHER_ROLE' }
  /**
   * ⚠️ The step's role holds nobody. Reported, never auto-approved and never
   * left waiting silently — a document stuck forever behind a log entry saying
   * it moved is the most confusing state a workflow can be in.
   */
  | { escalate: false; reason: 'NO_ONE_TO_ESCALATE_TO'; toRole: WorkspaceRole }

export interface EscalationInput {
  /** The role the step is currently waiting on. */
  currentRole: WorkspaceRole
  /** Who actually holds that role in this workspace. Empty = nobody. */
  holdersOf: (role: WorkspaceRole) => number
  /** ISO datetime the step started waiting. */
  waitingSince: string
  now: Date
  policy: EscalationPolicy | null
  /** How many times this document has already been escalated. */
  escalationsSoFar: number
}

/** Whole hours between two datetimes. */
export function hoursWaiting(waitingSince: string, now: Date): number {
  const since = Date.parse(waitingSince)
  if (Number.isNaN(since)) return 0
  return (now.getTime() - since) / 3_600_000
}

/**
 * Should this step escalate, and to whom?
 *
 * ⚠️ EVERY ORDER MATTERS. `POLICY_OFF` first, because a shop with no policy must
 * never escalate. `NO_HIGHER_ROLE` before the time check, because escalating
 * to the same role is a no-op that would make the history lie about a move that
 * did not happen. `EXHAUSTED` before the time check for the same reason.
 */
export function decideEscalation(input: EscalationInput): EscalationVerdict {
  const { policy } = input
  if (!policy || policy.afterHours <= 0) return { escalate: false, reason: 'POLICY_OFF' }

  if (policy.maxTimes !== undefined && input.escalationsSoFar >= policy.maxTimes) {
    return { escalate: false, reason: 'EXHAUSTED' }
  }

  const currentRank = ROLE_ORDER.indexOf(input.currentRole)
  const targetRank = ROLE_ORDER.indexOf(policy.toRole)

  // ⚠️ REFUSED WHEN IT WOULD NOT GO UP. `owner` is the top, so an owner-only
  // policy can never fire — and must say so rather than "escalate to owner"
  // from an owner's own step, which would loop.
  if (targetRank <= currentRank) return { escalate: false, reason: 'NO_HIGHER_ROLE' }

  const waited = hoursWaiting(input.waitingSince, input.now)
  if (waited < policy.afterHours) return { escalate: false, reason: 'NOT_DUE' }

  if (input.holdersOf(policy.toRole) === 0) {
    return { escalate: false, reason: 'NO_ONE_TO_ESCALATE_TO', toRole: policy.toRole }
  }

  return { escalate: true, toRole: policy.toRole, hoursWaiting: waited }
}

// ─── Compensation (#81) ─────────────────────────────────────────────────────

/** What a command did, so it can be described — and possibly undone. */
export type CommandKind =
  | 'invoice_create'
  | 'invoice_cancel'
  | 'payment_record'
  | 'payment_cancel'
  | 'purchase_order_create'
  | 'stock_adjust'
  | 'budget_commit'

export interface CompensationPlan {
  kind: CommandKind
  /**
   * ⚠️ CAN THIS BE UNDONE, AND HOW. `none` is a real answer and the most
   * honest one for several commands.
   */
  strategy: 'reverse' | 'void' | 'release' | 'none'
  /** Why it is what it is. Shown before anything is done. */
  reason: string
  /**
   * ⚠️ TRUE when undoing would itself need an entry in the books — which is
   * every case where money or stock moved. Undo is never invisible, and the UI
   * has to say so before the button, not after.
   */
  touchesBooks: boolean
  /** True when the reversal cannot be produced automatically. */
  needsHuman: boolean
  why: string
}

/**
 * What undoing a command actually means.
 *
 * ⚠️ THERE IS NO DELETE, AND THIS IS WHY. The rules forbid a compensating
 * DELETE: if the process dies mid-write, the compensation never runs and the
 * half-written row is permanent. Every strategy here is therefore a FORWARD
 * operation — the same reversal `ledger.reverseDocument` performs, the same
 * cancel `PaymentsService.cancelPayment` performs, the same release
 * `BudgetService` performs. Undo is a new entry that undoes an old one, and the
 * audit trail shows both, which is the only thing that can be reconciled.
//
// ⚠️ `budget_commit` is RELEASED, NOT DELETED, for the same reason — and because a
// released commitment that later needs re-establishing must leave a trace.
 */
export function compensationFor(kind: CommandKind): CompensationPlan {
  switch (kind) {
    case 'payment_record':
      return {
        kind,
        strategy: 'reverse',
        touchesBooks: true,
        needsHuman: false,
        reason: 'cancels the payment, returns the allocations, and posts a mirror entry',
        why: 'the ledger entry is reversed, never deleted, so both are visible',
      }

    case 'invoice_create':
      return {
        kind,
        strategy: 'void',
        touchesBooks: true,
        needsHuman: false,
        reason: 'cancels the invoice and reverses its ledger entry and stock movement',
        why: 'a posted invoice cannot be deleted — lesson 80/BUG-001 forbid it',
      }

    case 'invoice_cancel':
      // ⚠️ CANNOT BE UNDONE. Reinstating a cancelled document would rewrite
      // history: its number was issued, its stock moved and its ledger entry
      // exists. The honest answer is that this is one-way.
      return {
        kind,
        strategy: 'none',
        touchesBooks: true,
        needsHuman: true,
        reason: 'a cancelled invoice cannot be un-cancelled',
        why: 'its number was issued and its entries were reversed; reinstating rewrites history',
      }

    case 'purchase_order_create':
      return {
        kind,
        strategy: 'release',
        touchesBooks: false,
        needsHuman: false,
        reason: 'cancels the order and releases the budget commitment it reserved',
        why: 'the commitment is released, never deleted — a re-order leaves a trace',
      }

    case 'stock_adjust':
      return {
        kind,
        strategy: 'reverse',
        touchesBooks: true,
        needsHuman: false,
        reason: 'writes the opposite stock movement with a reference to this one',
        why: 'stock is a ledger of movements; undo is another movement, never a deletion',
      }

    case 'budget_commit':
      return {
        kind,
        strategy: 'release',
        touchesBooks: false,
        needsHuman: false,
        reason: 'releases the commitment against the budget',
        why: 'released, not deleted — a later re-commit must be visible as such',
      }

    case 'payment_cancel':
      return {
        kind,
        strategy: 'none',
        touchesBooks: true,
        needsHuman: true,
        reason: 'a cancelled payment cannot be restored',
        why: 'its allocations were returned and its entry reversed; re-recording is a NEW payment',
      }

    default:
      return {
        kind,
        strategy: 'none',
        touchesBooks: false,
        needsHuman: true,
        reason: 'no compensation is defined for this action',
        why: 'the closed set does not cover it, and guessing would write to the books',
      }
  }
}
