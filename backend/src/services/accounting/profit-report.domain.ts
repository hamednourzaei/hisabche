// ============================================
// backend/src/services/accounting/profit-report.domain.ts
//
// Request #91 — the profit and loss report on /accounting, in the ACCOUNTING
// CORE and nowhere else (insights reads it from here; the till asks it for the
// margin of a document). One set of rules:
//
//   revenue of a line = its share of the invoice's NET sales
//                       (subtotal − invoice discount, before tax), split over
//                       lines by total_price. Tax is not the business's money.
//   cost of a line    = the costing core's consumption for that invoice and
//                       product (cost_consumptions, consumer_type 'invoice').
//                       A sale with no consumption is flagged `costMissing`,
//                       never shown as 100% margin by accident.
//   salaries          = GROSS payroll cost (base + bonuses + overtime) of the
//                       payrolls whose period ends in the range. Deductions
//                       and tax are withheld from the employee, not saved by
//                       the business.
//   net profit        = gross profit − salaries; margin % = net / revenue.
//
// Only documents in the report currency are counted. Others are COUNTED and
// reported, not converted with a rate nobody entered.
// ============================================

export interface ProfitInvoice {
  id: string
  currency: string
  subtotal: number
  discountTotal: number
}

export interface ProfitLine {
  invoiceId: string
  productId: string | null
  productName: string
  quantity: number
  totalPrice: number
}

export interface ProfitConsumption {
  invoiceId: string | null
  productId: string
  amount: number
  isEstimated: boolean
}

export interface ProfitPayroll {
  currency: string
  baseSalary: number
  bonuses: number
  overtimeAmount: number
}

export interface ProductProfitRow {
  productId: string | null
  name: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  /** profit / revenue × 100; null when revenue is 0. */
  marginPercent: number | null
  /** Sold, but the costing core recorded no cost: profit is overstated. */
  costMissing: boolean
  /** Part of the cost was estimated (stock was not there when sold). */
  costEstimated: boolean
}

export interface ProfitReport {
  from: string
  to: string
  currency: string
  products: ProductProfitRow[]
  totals: {
    revenue: number
    cost: number
    grossProfit: number
    salaries: number
    netProfit: number
    netMarginPercent: number | null
    invoiceCount: number
    payrollCount: number
  }
  /** Documents in the range in another currency — not in the figures. */
  otherCurrencies: Array<{ currency: string; invoices: number; payrolls: number }>
}

const round2 = (value: number) => Math.round(value * 100) / 100
const percent = (part: number, whole: number) => (whole === 0 ? null : round2((part / whole) * 100))

/** Net sales of each line: the invoice discount is shared by line value. */
export function lineRevenues(invoice: ProfitInvoice, lines: ProfitLine[]): Map<ProfitLine, number> {
  const gross = lines.reduce((sum, line) => sum + line.totalPrice, 0)
  if (gross === 0) return new Map(lines.map((line) => [line, 0]))
  // The invoice's net sales are shared out by line value. With no subtotal on
  // the header (old rows), the lines are all there is: no discount applied.
  const net = invoice.subtotal > 0 ? Math.max(0, invoice.subtotal - invoice.discountTotal) : gross
  const factor = net / gross
  return new Map(lines.map((line) => [line, line.totalPrice * factor]))
}

export function buildProfitReport(input: {
  from: string
  to: string
  currency: string
  invoices: ProfitInvoice[]
  lines: ProfitLine[]
  consumptions: ProfitConsumption[]
  payrolls: ProfitPayroll[]
}): ProfitReport {
  const inCurrency = new Map(
    input.invoices
      .filter((invoice) => invoice.currency === input.currency)
      .map((invoice) => [invoice.id, invoice]),
  )

  const costByLine = new Map<string, { amount: number; estimated: boolean }>()
  for (const row of input.consumptions) {
    if (!row.invoiceId || !inCurrency.has(row.invoiceId)) continue
    const key = `${row.invoiceId}:${row.productId}`
    const current = costByLine.get(key) ?? { amount: 0, estimated: false }
    current.amount += row.amount
    current.estimated ||= row.isEstimated
    costByLine.set(key, current)
  }

  const byProduct = new Map<string, ProductProfitRow>()
  const linesByInvoice = new Map<string, ProfitLine[]>()
  for (const line of input.lines) {
    if (!inCurrency.has(line.invoiceId)) continue
    linesByInvoice.set(line.invoiceId, [...(linesByInvoice.get(line.invoiceId) ?? []), line])
  }

  const costCounted = new Set<string>()
  for (const [invoiceId, lines] of linesByInvoice) {
    const revenues = lineRevenues(inCurrency.get(invoiceId)!, lines)
    for (const line of lines) {
      const key = line.productId ?? `name:${line.productName}`
      const row =
        byProduct.get(key) ??
        ({
          productId: line.productId,
          name: line.productName,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          marginPercent: null,
          costMissing: false,
          costEstimated: false,
        } satisfies ProductProfitRow)
      row.quantity += line.quantity
      row.revenue += revenues.get(line) ?? 0
      if (line.productId) {
        // Several lines of one product on one invoice share one consumption total.
        const costKey = `${invoiceId}:${line.productId}`
        const cost = costByLine.get(costKey)
        if (!costCounted.has(costKey)) {
          costCounted.add(costKey)
          if (cost) {
            row.cost += cost.amount
            row.costEstimated ||= cost.estimated
          } else {
            row.costMissing = true
          }
        }
      }
      byProduct.set(key, row)
    }
  }

  const products = [...byProduct.values()]
    .map((row) => {
      const revenue = round2(row.revenue)
      const cost = round2(row.cost)
      const profit = round2(revenue - cost)
      return { ...row, revenue, cost, profit, marginPercent: percent(profit, revenue) }
    })
    .sort((a, b) => b.profit - a.profit)

  const payrollsInCurrency = input.payrolls.filter((payroll) => payroll.currency === input.currency)
  const salaries = round2(
    payrollsInCurrency.reduce(
      (sum, payroll) => sum + payroll.baseSalary + payroll.bonuses + payroll.overtimeAmount,
      0,
    ),
  )
  const revenue = round2(products.reduce((sum, row) => sum + row.revenue, 0))
  const cost = round2(products.reduce((sum, row) => sum + row.cost, 0))
  const grossProfit = round2(revenue - cost)
  const netProfit = round2(grossProfit - salaries)

  const others = new Map<string, { invoices: number; payrolls: number }>()
  for (const invoice of input.invoices) {
    if (invoice.currency === input.currency) continue
    const entry = others.get(invoice.currency) ?? { invoices: 0, payrolls: 0 }
    entry.invoices += 1
    others.set(invoice.currency, entry)
  }
  for (const payroll of input.payrolls) {
    if (payroll.currency === input.currency) continue
    const entry = others.get(payroll.currency) ?? { invoices: 0, payrolls: 0 }
    entry.payrolls += 1
    others.set(payroll.currency, entry)
  }

  return {
    from: input.from,
    to: input.to,
    currency: input.currency,
    products,
    totals: {
      revenue,
      cost,
      grossProfit,
      salaries,
      netProfit,
      netMarginPercent: percent(netProfit, revenue),
      invoiceCount: inCurrency.size,
      payrollCount: payrollsInCurrency.length,
    },
    otherCurrencies: [...others].map(([currency, counts]) => ({ currency, ...counts })),
  }
}

/** Margin of each invoice (for the till): profit % of its net sales. */
export function invoiceMargins(
  invoices: ProfitInvoice[],
  lines: ProfitLine[],
  consumptions: ProfitConsumption[],
): Map<
  string,
  { revenue: number; cost: number; marginPercent: number | null; costMissing: boolean }
> {
  const result = new Map<
    string,
    { revenue: number; cost: number; marginPercent: number | null; costMissing: boolean }
  >()
  for (const invoice of invoices) {
    const report = buildProfitReport({
      from: '',
      to: '',
      currency: invoice.currency,
      invoices: [invoice],
      lines: lines.filter((line) => line.invoiceId === invoice.id),
      consumptions: consumptions.filter((row) => row.invoiceId === invoice.id),
      payrolls: [],
    })
    result.set(invoice.id, {
      revenue: report.totals.revenue,
      cost: report.totals.cost,
      marginPercent: report.totals.netMarginPercent,
      costMissing: report.products.some((row) => row.costMissing),
    })
  }
  return result
}
