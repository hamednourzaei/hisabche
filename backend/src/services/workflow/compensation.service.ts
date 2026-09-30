// ============================================
// Capability #81 — undo/compensation, as something the client can ASK ABOUT.
//
// ⚠️ WHY A SEPARATE SERVICE WHEN `compensationFor` IS A PURE FUNCTION.
//
// Because the question is asked BEFORE the action, and that is the whole point.
// A user who is about to cancel a 5,000,000 invoice needs to know, before they
// click, that the stock comes back and the ledger entry is reversed — and that a
// cancelled invoice cannot be un-cancelled. Telling them afterwards is not a
// disclosure, it is a complaint.
//
// So this adds one thing the domain cannot: the mapping from a ROUTE to the
// command it performs. `compensationFor` knows that cancelling a payment needs a
// ledger reversal; it does not know that `POST /api/payments/:id/cancel` is the
// route a shop's "undo" button would call. Keeping that mapping here is what
// stops the UI from hard-coding it and getting it wrong per screen.
// ============================================

import { compensationFor, type CommandKind, type CompensationPlan } from './escalation.domain'

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
