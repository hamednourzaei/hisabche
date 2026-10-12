// ============================================
// packages/ui/src/lib/customers/statement-totals.ts
//
// Pure statement totals computation per currency for Customer 360.
// Shared by screen, CSV export, and print.
// ============================================

import { asList } from '@hisabche/api'

export interface StatementTotalsRow {
  currency: string
  totalSales: number | null
  totalPurchases: number | null
  totalReceived: number | null
  totalPaid: number | null
  openingBalance: number | null
  netBalance: number | null
}

export interface StatementCurrencySummary {
  currency: string
  totalSales?: number | null | undefined
  totalPurchases?: number | null | undefined
  totalReceived?: number | null | undefined
  totalPaid?: number | null | undefined
  openingBalance?: number | null | undefined
  receivable?: number | null | undefined
  payable?: number | null | undefined
  netBalance?: number | null | undefined
}

export interface StatementSummarySource {
  bookCurrency?: string | null | undefined
  currencies?: string[] | null | undefined
  byCurrency?: StatementCurrencySummary[] | null | undefined
}

export interface StatementLedgerSource {
  movements?: Array<{ currency?: string | null | undefined }> | null | undefined
}

/**
 * Filter and format statement totals per currency.
 *
 * ⚠️ NEVER FALLS BACK TO TOP-LEVEL SUMMARY:
 * Top-level `summarizeParty` sums across all currencies without conversion.
 * Falling back to it would label a mixed-currency sum as `bookCurrency`.
 * If `byCurrency` is empty, this returns `[]`.
 */
export function getStatementTotals(
  summary: StatementSummarySource | null | undefined,
  ledger?: StatementLedgerSource | null | undefined,
): StatementTotalsRow[] {
  if (!summary?.byCurrency) return []

  const list = asList<StatementCurrencySummary>(summary.byCurrency)
  const ledgerMovements = ledger?.movements ?? []

  return list
    .filter((row: StatementCurrencySummary) => {
      const hasSales = row.totalSales != null && row.totalSales !== 0
      const hasPurchases = row.totalPurchases != null && row.totalPurchases !== 0
      const hasReceived = row.totalReceived != null && row.totalReceived !== 0
      const hasPaid = row.totalPaid != null && row.totalPaid !== 0
      const hasOpening = row.openingBalance != null && row.openingBalance !== 0
      const hasNet = row.netBalance != null && row.netBalance !== 0
      const hasMovement = ledgerMovements.some(
        (m) => (m.currency || summary.bookCurrency || '') === row.currency,
      )
      return (
        hasSales || hasPurchases || hasReceived || hasPaid || hasOpening || hasNet || hasMovement
      )
    })
    .map((row: StatementCurrencySummary) => ({
      currency: row.currency,
      totalSales: row.totalSales != null ? row.totalSales : null,
      totalPurchases: row.totalPurchases != null ? row.totalPurchases : null,
      totalReceived: row.totalReceived != null ? row.totalReceived : null,
      totalPaid: row.totalPaid != null ? row.totalPaid : null,
      openingBalance: row.openingBalance != null ? row.openingBalance : null,
      netBalance: row.netBalance != null ? row.netBalance : null,
    }))
}
