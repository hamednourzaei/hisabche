// ============================================
// packages/validation/src/schemas/invoice-posting.domain.ts
//
// The journal lines one invoice books — pure, so the same lines the service
// posts can be posted by a real-Postgres test (inventory-avco-01 E2E), and by
// the offline device with no server at all.
//
// ⚠️ THIS FILE IS A RULE, NOT A SERVER CAPABILITY.
//
// It moved out of `backend/src/services/accounting/invoice-posting.domain.ts`
// in Phase 2 of the offline edition. The backend file re-exports every name
// here, so its importers are unchanged.
//
// Everything here is in the BOOKS currency: the invoice total at the invoice's
// own frozen rate, and the cost of goods as the cost layers consumed it (those
// are already in the books currency, at each PURCHASE's rate). A later rate
// never re-prices either.
// ============================================

import type { DraftLine } from './accounting.domain'
import { round2 } from './money'

/** An invoice amount in the books currency at the invoice's frozen rate. */
export function inBooksCurrency(amount: number, rate: number): number {
  return rate === 1 ? amount : Math.round(amount * rate * 100) / 100
}

export interface InvoicePostingAccounts {
  inventory?: string | undefined
  payable?: string | undefined
  receivable?: string | undefined
  sales?: string | undefined
  cogs?: string | undefined
  tax?: string | undefined
}

export function invoiceLedgerLines(input: {
  isPurchase: boolean
  /** Books currency. */
  total: number
  /** Books currency, tax portion of total. Sales only. */
  taxTotal?: number | undefined
  /** Books currency, from the consumed cost layers. Sales only. */
  costOfGoodsSold?: number | undefined
  accounts: InvoicePostingAccounts
}): DraftLine[] {
  const { isPurchase, total, accounts } = input
  const tax = Number(input.taxTotal) || 0

  let lines: DraftLine[]
  if (isPurchase) {
    // Goods arrived and we owe the supplier. No revenue is involved —
    // the version before this booked one, which inflated the income
    // statement by the value of every purchase.
    lines = [
      { accountId: accounts.inventory!, debit: total, credit: 0 },
      { accountId: accounts.payable!, debit: 0, credit: total },
    ]
  } else {
    // Sales:
    // When tax is present and tax account exists, separate sales revenue from tax payable:
    // Debit receivable for full total
    // Credit tax liability for tax portion
    // Credit sales revenue for the net amount (total - tax)
    lines = [{ accountId: accounts.receivable!, debit: total, credit: 0 }]

    if (tax > 0 && accounts.tax) {
      const netSales = round2(total - tax)
      if (netSales > 0) {
        lines.push({ accountId: accounts.sales!, debit: 0, credit: netSales })
      }
      lines.push({ accountId: accounts.tax, debit: 0, credit: tax })
    } else {
      lines.push({ accountId: accounts.sales!, debit: 0, credit: total })
    }
  }

  // Cost of goods sold, as the costing core actually consumed it — never the
  // product's CURRENT buy price (a phone bought at 10M and restocked at 9M had
  // both sales costed at 9M when it was).
  if (!isPurchase) {
    const cost = Number(input.costOfGoodsSold) || 0
    if (cost > 0) {
      lines.push(
        { accountId: accounts.cogs!, debit: cost, credit: 0 },
        { accountId: accounts.inventory!, debit: 0, credit: cost },
      )
    }
  }
  return lines
}
