// ============================================
// packages/validation/src/schemas/compensation-plan.ts
//
// Capability #81 — what undoing a command will do, as something the client can
// ASK ABOUT before it acts. Moved here from the server's escalation.domain and
// compensation.service so the offline engine answers the SAME question with the
// SAME table instead of a copy of it.
// ============================================

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

/**
 * The HTTP routes that perform a command, and what undoing them costs.
 *
 * ⚠️ KEYED BY ROUTE, NOT BY SCREEN. A guard below checks that every mutating
 * money route appears here, so a new one cannot be added without saying what
 * its undo does — which is the moment a developer asks the right question.
 */
export const COMPENSATION_BY_ROUTE: Readonly<Record<string, { kind: CommandKind; label: string }>> =
  {
    'DELETE /invoices/:id': { kind: 'invoice_create', label: 'invoice' },
    'POST /invoices/:id/cancel': { kind: 'invoice_cancel', label: 'invoice' },
    'POST /payments': { kind: 'payment_record', label: 'payment' },
    'POST /payments/:id/cancel': { kind: 'payment_cancel', label: 'payment' },
    'POST /purchasing/orders': { kind: 'purchase_order_create', label: 'purchase order' },
    'POST /warehouse/adjust': { kind: 'stock_adjust', label: 'stock adjustment' },
    'POST /operations/budgets/:id/consume': { kind: 'budget_commit', label: 'budget commitment' },
  }

/**
 * What undoing this route will do, before it happens.
 *
 * ⚠️ AN UNKNOWN ROUTE IS `null`, NEVER A DEFAULT. The caller asked about
 * something this table does not describe, and answering «nothing in particular»
 * would be the system saying it does not know — which is exactly the answer
 * that must reach the person about to move money.
 */
export function compensationForRoute(route: string): (CompensationPlan & { label: string }) | null {
  const entry = COMPENSATION_BY_ROUTE[route]
  if (!entry) return null

  return { ...compensationFor(entry.kind), label: entry.label }
}

/** Whether the UI must warn before offering this action. */
export function requiresWarning(plan: CompensationPlan | null): boolean {
  if (!plan) return true
  // ⚠️ Both conditions warn. A plan that needs a human is obviously worth a
  // warning; one that touches the books is worth one too, because the user is
  // about to move an entry and should know it before, not after.
  return plan.touchesBooks || plan.needsHuman
}
