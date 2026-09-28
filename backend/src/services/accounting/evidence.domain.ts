// ============================================
// backend/src/services/accounting/evidence.domain.ts
//
// «Why is this invoice's profit what it is?» — the chain behind the number:
//
//   sales lines ─► discount shared by line value ─► net sales
//        │
//        └─► cost: each consumption ─► the cost layer it drew from ─► the
//            document that created the layer (a purchase, a receipt, an
//            opening balance, a production run)
//
//   and beside it: the journal entry the invoice posted, the payments that
//   settled it.
//
// ⚠️ ONE FORMULA. The totals are buildProfitReport's — the same function the
// profit report and the till's margin use (راهنمای سشن §۸, «سود فقط از
// AccountingService»). This file only lays the pieces side by side; a test
// asserts the chain's totals equal invoiceMargins() to the cent.
// ============================================

import {
  buildProfitReport,
  lineRevenues,
  type ProfitConsumption,
  type ProfitInvoice,
  type ProfitLine,
} from './profit-report.domain'

export interface EvidenceLayer {
  sourceType: string
  sourceId: string | null
  unitCost: number
  entryDate: string
}

export interface EvidenceConsumption extends ProfitConsumption {
  quantity: number
  unitCost: number
  /** The layer the cost came from; null for an estimated shortfall. */
  layer: EvidenceLayer | null
}

export interface InvoiceEvidence {
  invoiceId: string
  currency: string
  grossSales: number
  discount: number
  netSales: number
  cost: number
  grossProfit: number
  marginPercent: number | null
  lines: Array<{
    productId: string | null
    name: string
    quantity: number
    grossRevenue: number
    netRevenue: number
    cost: number
    profit: number
    costMissing: boolean
    costEstimated: boolean
    sources: Array<{
      quantity: number
      unitCost: number
      amount: number
      isEstimated: boolean
      layer: EvidenceLayer | null
    }>
  }>
  ledger: Array<{ id: string; entryNumber: string | null; status: string }>
  payments: Array<{ paymentId: string; amount: number }>
  paidTotal: number
  /** Stated, not hidden: a profit built on a missing or estimated cost is overstated or approximate. */
  warnings: Array<'COST_MISSING' | 'COST_ESTIMATED' | 'NOT_POSTED'>
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function explainInvoiceProfit(input: {
  invoice: ProfitInvoice
  lines: ProfitLine[]
  consumptions: EvidenceConsumption[]
  ledger: Array<{ id: string; entryNumber: string | null; status: string }>
  payments: Array<{ paymentId: string; amount: number }>
}): InvoiceEvidence {
  const { invoice } = input
  const lines = input.lines.filter((l) => l.invoiceId === invoice.id)
  const consumptions = input.consumptions.filter((c) => c.invoiceId === invoice.id)

  // The totals: exactly the profit report's.
  const report = buildProfitReport({
    from: '',
    to: '',
    currency: invoice.currency,
    invoices: [invoice],
    lines,
    consumptions,
    payrolls: [],
  })

  const net = lineRevenues(invoice, lines)
  const grossSales = round2(lines.reduce((sum, l) => sum + l.totalPrice, 0))
  const netSales = report.totals.revenue

  const lineViews = lines.map((line) => {
    const sources = consumptions.filter((c) => c.productId === line.productId)
    const productRow = report.products.find(
      (p) => (p.productId ?? p.name) === (line.productId ?? line.productName),
    )
    // A product sold on two lines shares one cost pool; the line gets its
    // share of that pool by quantity, as the report attributes it.
    const sameProductQty = lines
      .filter((l) => l.productId === line.productId)
      .reduce((sum, l) => sum + l.quantity, 0)
    const share = sameProductQty > 0 ? line.quantity / sameProductQty : 0
    const cost = round2((productRow?.cost ?? 0) * share)
    const netRevenue = round2(net.get(line) ?? 0)
    return {
      productId: line.productId,
      name: line.productName,
      quantity: line.quantity,
      grossRevenue: round2(line.totalPrice),
      netRevenue,
      cost,
      profit: round2(netRevenue - cost),
      costMissing: productRow?.costMissing ?? false,
      costEstimated: productRow?.costEstimated ?? false,
      sources: sources.map((c) => ({
        quantity: c.quantity,
        unitCost: c.unitCost,
        amount: round2(c.amount),
        isEstimated: c.isEstimated,
        layer: c.layer,
      })),
    }
  })

  const warnings: InvoiceEvidence['warnings'] = []
  if (report.products.some((p) => p.costMissing)) warnings.push('COST_MISSING')
  if (report.products.some((p) => p.costEstimated)) warnings.push('COST_ESTIMATED')
  if (!input.ledger.some((j) => j.status === 'posted')) warnings.push('NOT_POSTED')

  return {
    invoiceId: invoice.id,
    currency: invoice.currency,
    grossSales,
    discount: round2(grossSales - netSales),
    netSales,
    cost: report.totals.cost,
    grossProfit: report.totals.grossProfit,
    marginPercent: report.totals.netMarginPercent,
    lines: lineViews,
    ledger: input.ledger,
    payments: input.payments,
    paidTotal: round2(input.payments.reduce((sum, p) => sum + p.amount, 0)),
    warnings,
  }
}

// ─── A product's money journey ───────────────────────────────────────────────

export interface ProductJourney {
  productId: string
  currency: string
  /** Cost layers received: where the money went IN (purchases, receipts, openings). */
  bought: {
    quantity: number
    amount: number
    bySource: Array<{ sourceType: string; quantity: number; amount: number }>
  }
  /** Consumptions: the cost that LEFT with each sale or adjustment. */
  sold: {
    quantity: number
    cost: number
    byConsumer: Array<{ consumerType: string; quantity: number; cost: number }>
  }
  /** What is still on the shelf, at the cost it was bought. */
  onHand: { quantity: number; value: number }
  /** The report's revenue and profit for this product in the same window. */
  revenue: number
  profit: number
}

export function productJourney(input: {
  productId: string
  currency: string
  layers: Array<{
    sourceType: string
    receivedQty: number
    remainingQty: number
    unitCost: number
    currency: string
  }>
  consumptions: Array<{ consumerType: string; quantity: number; amount: number }>
  revenue: number
  profit: number
}): ProductJourney {
  const layers = input.layers.filter((l) => l.currency === input.currency)
  const bySource = new Map<string, { quantity: number; amount: number }>()
  for (const l of layers) {
    const row = bySource.get(l.sourceType) ?? { quantity: 0, amount: 0 }
    row.quantity += l.receivedQty
    row.amount += l.receivedQty * l.unitCost
    bySource.set(l.sourceType, row)
  }
  const byConsumer = new Map<string, { quantity: number; cost: number }>()
  for (const c of input.consumptions) {
    const row = byConsumer.get(c.consumerType) ?? { quantity: 0, cost: 0 }
    row.quantity += c.quantity
    row.cost += c.amount
    byConsumer.set(c.consumerType, row)
  }
  const sum = <T>(rows: T[], f: (r: T) => number) => round2(rows.reduce((s, r) => s + f(r), 0))
  return {
    productId: input.productId,
    currency: input.currency,
    bought: {
      quantity: sum(layers, (l) => l.receivedQty),
      amount: sum(layers, (l) => l.receivedQty * l.unitCost),
      bySource: [...bySource].map(([sourceType, r]) => ({
        sourceType,
        quantity: round2(r.quantity),
        amount: round2(r.amount),
      })),
    },
    sold: {
      quantity: sum(input.consumptions, (c) => c.quantity),
      cost: sum(input.consumptions, (c) => c.amount),
      byConsumer: [...byConsumer].map(([consumerType, r]) => ({
        consumerType,
        quantity: round2(r.quantity),
        cost: round2(r.cost),
      })),
    },
    onHand: {
      quantity: sum(layers, (l) => l.remainingQty),
      value: sum(layers, (l) => l.remainingQty * l.unitCost),
    },
    revenue: round2(input.revenue),
    profit: round2(input.profit),
  }
}
