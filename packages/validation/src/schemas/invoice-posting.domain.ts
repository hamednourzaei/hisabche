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
  deferred_revenue?: string | undefined
}

export function invoiceLedgerLines(input: {
  isPurchase: boolean
  /** Books currency. */
  total: number
  /** Books currency, tax portion of total. Sales only. */
  taxTotal?: number | undefined
  /** Books currency, from the consumed cost layers. Sales only. */
  costOfGoodsSold?: number | undefined
  /**
   * Books currency, the NET (after discount, before tax) amount of package lines. It is credited to deferred revenue
   * instead of sales and released at delivery (M5-1). Tax is NOT deferred (M5-4). Sales only.
   */
  deferredRevenue?: number | undefined
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
    // Sales: debit receivable for the full total; credit the tax liability for the tax (when there is a tax account);
    // credit deferred revenue for the package part of the net; credit sales for the rest of the net.
    const taxApplied = tax > 0 && accounts.tax ? tax : 0
    const netSales = round2(total - taxApplied)
    const deferred = Math.min(
      Math.max(0, Number(input.deferredRevenue) || 0),
      Math.max(0, netSales),
    )
    // ⚠️ No silent fallback: a deferred amount with no account to hold it would book the package as plain revenue.
    if (deferred > 0 && !accounts.deferred_revenue) {
      throw new Error('DEFERRED_REVENUE_ACCOUNT_MISSING')
    }
    const recognised = round2(netSales - deferred)

    lines = [{ accountId: accounts.receivable!, debit: total, credit: 0 }]
    if (deferred > 0) {
      lines.push({ accountId: accounts.deferred_revenue!, debit: 0, credit: deferred })
    }
    if (recognised > 0 || (deferred === 0 && taxApplied === 0)) {
      lines.push({
        accountId: accounts.sales!,
        debit: 0,
        credit: taxApplied > 0 ? recognised : total,
      })
    }
    if (taxApplied > 0) {
      lines.push({ accountId: accounts.tax!, debit: 0, credit: taxApplied })
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

export interface PackageLineForDeferral {
  offeringType?: string | null | undefined
  quantity: number
  unitPrice?: number | undefined
  totalPrice?: number | undefined
  discount?: number | undefined
}

/**
 * The net (after discount, before tax) value of every PACKAGE line in the BOOKS currency, line by line, and their sum.
 * The invoice's deferred credit and each GRANT's deferred amount both come from this one function, so the journal and
 * the ledger cannot disagree: the total is the sum of the rounded line values, never a second rounding of the sum.
 */
export function computePackageDeferrals(
  lines: PackageLineForDeferral[],
  exchangeRate = 1,
): { perLine: number[]; total: number } {
  const perLine = lines.map((line) => {
    if (line.offeringType !== 'package' || !(line.quantity > 0)) return 0
    const quantity = Number(line.quantity) || 0
    let net = 0
    if (line.unitPrice !== undefined) {
      const gross = round2(quantity * (Number(line.unitPrice) || 0))
      net = round2(gross - Math.min(gross, Number(line.discount) || 0))
    } else if (line.totalPrice !== undefined) {
      net = Number(line.totalPrice) || 0
    }
    return inBooksCurrency(Math.max(0, net), exchangeRate)
  })
  return { perLine, total: round2(perLine.reduce((sum, value) => sum + value, 0)) }
}
