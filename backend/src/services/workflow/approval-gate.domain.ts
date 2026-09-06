// ============================================
// backend/src/services/workflow/approval-gate.domain.ts
//
// G6 — whether a document's FINANCIAL EFFECT may happen yet.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// Approval existed and decided nothing. `invoice.service.create()` did this:
//
//     this.applyCosting(...).then(() => this.createAccountingEntries(...))
//     this.tryStartWorkflow(...).catch(err => console.error(...))
//
// Two fire-and-forget chains, side by side, neither aware of the other. The
// journal entry was booked and the stock moved while the workflow instance was
// still at step one — so «در انتظار تأیید» was a LABEL on a document that had
// already had its full effect. Approving it changed a status column; rejecting
// it changed a status column. The money had moved either way.
//
// ---------------------------------------------------------------------------
// WHAT "HOLDING" MEANS HERE, AND WHY
//
// Not "hide the row". The document is real and must stay visible and editable —
// that is the point of a draft.
//
// What is held is the IRREVERSIBLE part: the journal entry and the stock
// movement. Those are the two things that cannot be quietly undone later, and
// they are exactly what an approver is being asked about.
//
// So: a document awaiting approval behaves as a draft. On approval it posts.
// On rejection it stays a draft and nothing was ever booked, which is why
// rejection needs no reversal.
// ============================================

/** The document kinds an approval template can be written against. */
export type ApprovableEntity = 'invoice' | 'purchase_order' | 'expense'

export type ApprovalOutcome =
  /** No active template matched. Post immediately, as before. */
  | { kind: 'post_now' }
  /** A template matched. The document is held until the workflow approves it. */
  | { kind: 'hold'; workflowIds: string[] }

export interface ApprovalDecisionInput {
  /** Whether the rules engine matched an active approval rule. */
  requiresApproval: boolean
  /** Workflow templates the rule named, already filtered to this workspace. */
  workflowIds: string[]
}

/**
 * Decide whether to post now or hold.
 *
 * ⚠️ `requiresApproval` WITH NO WORKFLOW IS `post_now`, NOT `hold`.
 *
 * A rule that says "this needs approval" but names no template that exists —
 * deleted, deactivated, or belonging to another workspace — cannot produce an
 * approval anybody can grant. Holding on it would strand the document forever
 * with no route out, and nobody would be able to tell whether it was waiting on
 * a person or on a misconfiguration.
 *
 * Posting is the safer failure here precisely because the alternative is
 * silent and permanent. The caller logs it.
 */
export function decideApproval(input: ApprovalDecisionInput): ApprovalOutcome {
  if (!input.requiresApproval) return { kind: 'post_now' }
  if (input.workflowIds.length === 0) return { kind: 'post_now' }
  return { kind: 'hold', workflowIds: input.workflowIds }
}

/**
 * The document status while it waits.
 *
 * `pending` is an EXISTING value in `invoiceStatusSchema`, not a new one. Phase
 * F documented that `invoices.status` already conflates document state and
 * settlement state; adding a sixth value to it would deepen that rather than
 * work around it. The authoritative "is this posted" answer is whether a
 * journal entry exists, which is what `postedAt` records.
 */
export const AWAITING_APPROVAL_STATUS = 'pending'

/**
 * May this document's financial effect be applied?
 *
 * A single predicate so the ledger path, the stock path and any future effect
 * ask the same question of the same value — rather than each testing a status
 * string its own way and drifting.
 */
export function mayPostDocument(outcome: ApprovalOutcome): boolean {
  return outcome.kind === 'post_now'
}
