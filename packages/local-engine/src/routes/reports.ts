// ============================================
// packages/local-engine/src/routes/reports.ts
//
// The books' statements, on the device: balance sheet, income statement,
// general ledger and the profit report of every currency.
//
// ⚠️ NOT A SECOND SET OF RULES. Each route reads SQLite (report-sources.ts) and
// hands the rows to the function the server's AccountingService calls:
// `toBalanceSheet`, `toIncomeStatement`, `buildGeneralLedger`,
// `buildProfitReport`. Unknown stays unknown — the profit report returns `null`
// for a cost nobody recorded, exactly as on the server.
// ============================================

import {
  buildGeneralLedger,
  buildProfitReport,
  dateOnly,
  dayBefore,
  explainInvoiceProfit,
  productJourney,
  toBalanceSheet,
  toIncomeStatement,
  type AccountRootType,
} from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import {
  invoiceEvidenceSources,
  ledgerLines,
  ledgerTotals,
  productJourneySources,
  profitSources,
  reportRange,
} from './report-sources'

export function registerReportRoutes(router: Router): void {
  // ─── GET /accounting/balance-sheet?date= ────────────────────
  router.get('/accounting/balance-sheet', (c: RouteHandlerContext) => {
    const asOf = dateOnly(c.query.date ?? new Date())
    return toBalanceSheet(ledgerTotals(c.db, c.ctx.workspaceId, null, asOf), asOf)
  })

  // ─── GET /accounting/income-statement?from=&to= ─────────────
  router.get('/accounting/income-statement', (c: RouteHandlerContext) => {
    const { from, to } = reportRange(c.query)
    return toIncomeStatement(ledgerTotals(c.db, c.ctx.workspaceId, from, to), from, to)
  })

  // ─── GET /accounting/general-ledger?accountId=&fromDate=&toDate= ──
  router.get('/accounting/general-ledger', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const accountId = query.accountId
    if (!accountId) throw new ValidationError('ACCOUNT_ID_REQUIRED')
    const from = query.fromDate ? dateOnly(query.fromDate) : null
    const to = query.toDate ? dateOnly(query.toDate) : null

    const account = db.get<{ id: string; code: string; name: string; type: AccountRootType }>(
      'SELECT id, code, name, type FROM account WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [accountId, ctx.workspaceId],
    )
    if (!account) throw new NotFoundError('Account')

    // What the account held STRICTLY BEFORE the window opens.
    const opening = from
      ? ledgerTotals(db, ctx.workspaceId, null, dayBefore(from)).find(
          (row) => row.accountId === accountId,
        )
      : undefined

    return buildGeneralLedger({
      account,
      from,
      to,
      lines: ledgerLines(db, ctx.workspaceId, accountId, from, to),
      opening,
    })
  })

  // ─── GET /accounting/profit-report/by-currency ──────────────
  // One report per currency with documents in the range (plus the primary one),
  // never summed across currencies.
  router.get('/accounting/profit-report/by-currency', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { from, to } = reportRange(query)
    if (from > to) throw new ValidationError('PROFIT_REPORT_RANGE_INVALID')
    const primary = query.currency?.trim() || ctx.baseCurrency
    const sources = profitSources(db, ctx.workspaceId, from, to, ctx.baseCurrency)
    const currencies = [primary, ...new Set(sources.invoices.map((invoice) => invoice.currency))]
      .filter(Boolean)
      .filter((code, index, all) => all.indexOf(code) === index)
    return currencies.map((currency) => buildProfitReport({ from, to, currency, ...sources }))
  })

  // ─── GET /accounting/evidence/invoices/:id ──────────────────
  // «Why is this invoice's profit what it is?» — the server's chain, unchanged.
  router.get('/accounting/evidence/invoices/:id', (c: RouteHandlerContext) => {
    const sources = invoiceEvidenceSources(
      c.db,
      c.ctx.workspaceId,
      c.params.id ?? '',
      c.ctx.baseCurrency,
    )
    if (!sources) throw new NotFoundError('Invoice')
    return explainInvoiceProfit(sources)
  })

  // ─── GET /accounting/evidence/products/:id ──────────────────
  // A product's money journey in one currency; never converted between currencies.
  router.get('/accounting/evidence/products/:id', (c: RouteHandlerContext) => {
    const { db, ctx, query, params } = c
    const productId = params.id ?? ''
    if (!query.fromDate || !query.toDate) throw new ValidationError('DATE_RANGE_REQUIRED')
    if (!query.currency || !/^[A-Z]{3}$/.test(query.currency)) {
      throw new ValidationError('CURRENCY_REQUIRED')
    }
    const from = dateOnly(query.fromDate)
    const to = dateOnly(query.toDate)
    if (from > to) throw new ValidationError('PROFIT_REPORT_RANGE_INVALID')
    const sources = profitSources(db, ctx.workspaceId, from, to, ctx.baseCurrency)
    const journey = productJourneySources(db, ctx.workspaceId, productId, from, to)
    const row = buildProfitReport({
      from,
      to,
      currency: query.currency,
      ...sources,
      payrolls: [],
    }).products.find((p) => p.productId === productId)
    return productJourney({
      productId,
      currency: query.currency,
      layers: journey.layers,
      consumptions: journey.consumptions,
      revenue: row?.revenue ?? 0,
      // No sales of it in the window is a real 0; sold without a cost is null.
      profit: row ? row.profit : 0,
    })
  })
}
