// ============================================
// packages/ui/src/lib/workflow/approval-rule.ts
//
// An approval TEMPLATE says who approves. Whether an invoice waits for it is
// a RULE (`/api/rules`): «invoice.total > X → require_approval(template)».
// Nothing wrote that rule (owner, 18 Oct 2026: «فاکتور بالای 5000» was only a
// name — every invoice posted without approval). These two functions are the
// only place the screen turns «مبلغ بیشتر از X» into a rule and back.
//
// ⚠️ The amount is in the INVOICE's own currency: the server evaluates the
// rule against `invoice.total` as recorded (decideApprovalRoute).
// ============================================

import type { BusinessRule } from '@hisabche/api'

/** What a template's condition is, read from the rules. */
export type ApprovalCondition =
  | { kind: 'above'; amount: number }
  | { kind: 'always' }
  /** No rule names this template: it holds no invoice at all. */
  | { kind: 'none' }

/** The rule an invoice template needs. `minTotal` null = every invoice. */
export function invoiceApprovalRule(name: string, workflowId: string, minTotal: number | null) {
  return {
    name,
    entity: 'invoice' as const,
    // The engine wants at least one condition; «every invoice» is total ≥ 0.
    conditions: {
      match: 'all' as const,
      conditions: [
        minTotal === null
          ? { field: 'invoice.total', operator: 'gte' as const, value: 0 }
          : { field: 'invoice.total', operator: 'gt' as const, value: minTotal },
      ],
    },
    actions: [{ kind: 'require_approval', workflowId }],
  }
}

/** The active rule that sends invoices to this template, said as a condition. */
export function approvalConditionOf(
  rules: readonly BusinessRule[],
  workflowId: string,
): ApprovalCondition {
  const rule = rules.find(
    (candidate) =>
      candidate.active &&
      candidate.entity === 'invoice' &&
      candidate.actions.some(
        (action) => action.kind === 'require_approval' && action.workflowId === workflowId,
      ),
  )
  if (!rule) return { kind: 'none' }
  const total = rule.conditions.conditions.find((c) => c.field === 'invoice.total')
  const amount = Number(total?.value)
  if (total && (total.operator === 'gt' || total.operator === 'gte') && amount > 0) {
    return { kind: 'above', amount }
  }
  return { kind: 'always' }
}
