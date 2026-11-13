// ============================================
// packages/ui/src/lib/workflow/approval-rule.ts
//
// An approval TEMPLATE says who approves. Whether an invoice waits for it is
// a RULE (`/api/rules`): «invoice.total_book > X → require_approval(template)».
// Nothing wrote that rule (owner, 18 Oct 2026: «فاکتور بالای 5000» was only a
// name — every invoice posted without approval). These two functions are the
// only place the screen turns «مبلغ بیشتر از X» into a rule and back.
//
// Owner decision (12 Nov 2026, V61 open decision 2): ONE approval engine, this
// one. Two things the retired V61 policy engine could say are said here now:
//   - WHICH invoices: sales, purchases, or both (`invoice.type`);
//   - the amount in the BOOKS' currency (`invoice.total_book` = total × the
//     invoice's own rate), so «above 50,000» also catches a USD invoice worth
//     that much. A rule written before this compares `invoice.total`, the
//     invoice's own currency — read back and labelled as such, not rewritten.
// ============================================

import type { BusinessRule } from '@hisabche/api'

/** Which invoices a condition applies to. */
export type ApprovalInvoiceType = 'all' | 'sale' | 'purchase'
export const APPROVAL_INVOICE_TYPES: readonly ApprovalInvoiceType[] = ['all', 'sale', 'purchase']

/** Which currency the amount is in: the books' (new rules) or the invoice's own (older ones). */
export type ApprovalAmountCurrency = 'book' | 'invoice'

/** What a template's condition is, read from the rules. */
export type ApprovalCondition =
  | {
      kind: 'above'
      amount: number
      invoiceType: ApprovalInvoiceType
      currency: ApprovalAmountCurrency
    }
  | { kind: 'always'; invoiceType: ApprovalInvoiceType }
  /** No rule names this template: it holds no invoice at all. */
  | { kind: 'none' }

/**
 * The rule an invoice template needs. `minTotal` null = every invoice (of
 * that type). The amount is in the books' currency.
 */
export function invoiceApprovalRule(
  name: string,
  workflowId: string,
  minTotal: number | null,
  invoiceType: ApprovalInvoiceType = 'all',
) {
  return {
    name,
    entity: 'invoice' as const,
    conditions: {
      match: 'all' as const,
      conditions: [
        // The engine wants at least one condition; «every invoice» is total ≥ 0.
        minTotal === null
          ? { field: 'invoice.total_book', operator: 'gte' as const, value: 0 }
          : { field: 'invoice.total_book', operator: 'gt' as const, value: minTotal },
        ...(invoiceType === 'all'
          ? []
          : [{ field: 'invoice.type', operator: 'eq' as const, value: invoiceType }]),
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

  const typeCondition = rule.conditions.conditions.find(
    (c) => c.field === 'invoice.type' && c.operator === 'eq',
  )
  const invoiceType: ApprovalInvoiceType =
    typeCondition?.value === 'sale' || typeCondition?.value === 'purchase'
      ? typeCondition.value
      : 'all'

  const book = rule.conditions.conditions.find((c) => c.field === 'invoice.total_book')
  const total = book ?? rule.conditions.conditions.find((c) => c.field === 'invoice.total')
  const amount = Number(total?.value)
  if (total && (total.operator === 'gt' || total.operator === 'gte') && amount > 0) {
    return { kind: 'above', amount, invoiceType, currency: book ? 'book' : 'invoice' }
  }
  return { kind: 'always', invoiceType }
}
