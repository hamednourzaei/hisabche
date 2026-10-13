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
//                       A sale with no consumption has an UNKNOWN cost, and
//                       unknown is not zero: its profit and margin are null,
//                       never «revenue» and «100%» (INV-000077, 11 Oct 2026).
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
  /** Units this consumption covered. Absent ⇒ taken to cover the whole sale. */
  quantity?: number | undefined
}

/**
 * How much is known about what the goods cost.
 *
 *   none       nothing stocked was sold (a service, a text line): no cost exists
 *   known      every unit drew its cost from a real layer — a layer bought at
 *              zero is a known zero, which is not the same as «no layer»
 *   estimated  part was priced at the last cost paid (stock was not there)
 *   partial    some units have a cost and some have none
 *   unknown    no unit has a cost
 *
 * Only `none`, `known` and `estimated` produce a profit figure.
 */
export type CostStatus = 'none' | 'known' | 'estimated' | 'partial' | 'unknown'

export function isCostDeterminate(status: CostStatus): boolean {
  return status === 'none' || status === 'known' || status === 'estimated'
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
  /** The cost that IS recorded. With `costMissing` it is a part, not the cost. */
  cost: number
  /** null when the cost is not fully known — revenue is not profit. */
  profit: number | null
  /** profit / revenue × 100; null when revenue is 0 or the cost is not known. */
  marginPercent: number | null
  costStatus: CostStatus
  /** Units sold with no cost behind them. */
  uncostedQuantity: number
  /** `costStatus` is partial or unknown. */
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
    /** The cost that is recorded; a part of the cost when `costStatus` is partial/unknown. */
    cost: number
    costStatus: CostStatus
    /** Net sales of the rows whose cost is not fully known. */
    uncostedRevenue: number
    /** Revenue − cost over the rows whose cost IS known. Always a real figure. */
    knownGrossProfit: number
    /** null when any sold product has no known cost. */
    grossProfit: number | null
    salaries: number
    netProfit: number | null
    netMarginPercent: number | null
    invoiceCount: number
    payrollCount: number
  }
  /** Documents in the range in another currency — not in the figures. */
  otherCurrencies: Array<{ currency: string; invoices: number; payrolls: number }>
}

const round2 = (value: number) => Math.round(value * 100) / 100
/** Quantities carry four decimals; below this two quantities are the same. */
const QUANTITY_EPSILON = 0.00005
const percent = (part: number, whole: number) => (whole === 0 ? null : round2((part / whole) * 100))

/**
 * A sale in another currency that carries its rate, restated in the BOOKS
 * currency: its revenue at the rate frozen on the invoice. It then meets its
 * cost — cost layers are always in the books currency — and has a profit.
 *
 * ⚠️ ONLY WITH A RATE. An invoice with none (made before rates were kept) is
 * returned untouched, under its own currency, where its profit stays «cannot
 * be computed». Nothing is assumed for it, and it is never treated as 1 = 1.
 */
export function restateAtRates<I extends ProfitInvoice, L extends ProfitLine>(
  invoices: readonly I[],
  lines: readonly L[],
  /** Invoice id → books currency per one unit of the invoice's currency. */
  rates: ReadonlyMap<string, number>,
  booksCurrency: string,
): { invoices: I[]; lines: L[] } {
  const at = (amount: number, rate: number) => Math.round(amount * rate * 100) / 100
  const restated = new Map<string, number>()
  for (const invoice of invoices) {
    const rate = rates.get(invoice.id)
    if (
      typeof rate === 'number' &&
      rate > 0 &&
      Number.isFinite(rate) &&
      invoice.currency !== booksCurrency
    ) {
      restated.set(invoice.id, rate)
    }
  }
  return {
    invoices: invoices.map((invoice) => {
      const rate = restated.get(invoice.id)
      return rate === undefined
        ? invoice
        : {
            ...invoice,
            currency: booksCurrency,
            subtotal: at(invoice.subtotal, rate),
            discountTotal: at(invoice.discountTotal, rate),
          }
    }),
    lines: lines.map((line) => {
      const rate = restated.get(line.invoiceId)
      return rate === undefined ? line : { ...line, totalPrice: at(line.totalPrice, rate) }
    }),
  }
}

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

  const costByLine = new Map<
    string,
    { amount: number; estimated: boolean; quantity: number; quantityKnown: boolean }
  >()
  for (const row of input.consumptions) {
    if (!row.invoiceId || !inCurrency.has(row.invoiceId)) continue
    const key = `${row.invoiceId}:${row.productId}`
    const current = costByLine.get(key) ?? {
      amount: 0,
      estimated: false,
      quantity: 0,
      quantityKnown: true,
    }
    current.amount += row.amount
    current.estimated ||= row.isEstimated
    if (row.quantity === undefined) current.quantityKnown = false
    else current.quantity += row.quantity
    costByLine.set(key, current)
  }

  type Tally = ProductProfitRow & { costedDocuments: number; uncostedDocuments: number }
  const byProduct = new Map<string, Tally>()
  const linesByInvoice = new Map<string, ProfitLine[]>()
  for (const line of input.lines) {
    if (!inCurrency.has(line.invoiceId)) continue
    linesByInvoice.set(line.invoiceId, [...(linesByInvoice.get(line.invoiceId) ?? []), line])
  }

  // Units of each product on each invoice: what a consumption has to cover.
  const soldByKey = new Map<string, number>()
  for (const [invoiceId, lines] of linesByInvoice) {
    for (const line of lines) {
      if (!line.productId) continue
      const key = `${invoiceId}:${line.productId}`
      soldByKey.set(key, (soldByKey.get(key) ?? 0) + line.quantity)
    }
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
          costStatus: 'none',
          uncostedQuantity: 0,
          costMissing: false,
          costEstimated: false,
          costedDocuments: 0,
          uncostedDocuments: 0,
        } satisfies Tally)
      row.quantity += line.quantity
      row.revenue += revenues.get(line) ?? 0
      if (line.productId) {
        // Several lines of one product on one invoice share one consumption total.
        const costKey = `${invoiceId}:${line.productId}`
        const cost = costByLine.get(costKey)
        if (!costCounted.has(costKey)) {
          costCounted.add(costKey)
          const sold = soldByKey.get(costKey) ?? 0
          if (cost) {
            row.cost += cost.amount
            row.costEstimated ||= cost.estimated
            row.costedDocuments += 1
            // A consumption that covers fewer units than were sold leaves the
            // rest without a cost.
            const short = cost.quantityKnown ? sold - cost.quantity : 0
            if (short > QUANTITY_EPSILON) {
              row.uncostedQuantity += short
              row.uncostedDocuments += 1
            }
          } else {
            row.uncostedQuantity += sold
            row.uncostedDocuments += 1
          }
        }
      }
      byProduct.set(key, row)
    }
  }

  const products: ProductProfitRow[] = [...byProduct.values()]
    .map(({ costedDocuments, uncostedDocuments, ...row }) => {
      const revenue = round2(row.revenue)
      const cost = round2(row.cost)
      const costStatus: CostStatus =
        row.productId === null
          ? 'none'
          : uncostedDocuments > 0
            ? costedDocuments > 0
              ? 'partial'
              : 'unknown'
            : row.costEstimated
              ? 'estimated'
              : 'known'
      const determinate = isCostDeterminate(costStatus)
      const profit = determinate ? round2(revenue - cost) : null
      return {
        ...row,
        revenue,
        cost,
        profit,
        marginPercent: profit === null ? null : percent(profit, revenue),
        costStatus,
        uncostedQuantity: round2(row.uncostedQuantity),
        costMissing: !determinate,
      }
    })
    // Best profit first; a row whose profit is not known goes last, in the
    // order of what was sold.
    .sort((a, b) =>
      a.profit === null || b.profit === null
        ? a.profit === null && b.profit === null
          ? b.revenue - a.revenue
          : a.profit === null
            ? 1
            : -1
        : b.profit - a.profit,
    )

  const payrollsInCurrency = input.payrolls.filter((payroll) => payroll.currency === input.currency)
  const salaries = round2(
    payrollsInCurrency.reduce(
      (sum, payroll) => sum + payroll.baseSalary + payroll.bonuses + payroll.overtimeAmount,
      0,
    ),
  )
  const revenue = round2(products.reduce((sum, row) => sum + row.revenue, 0))
  const cost = round2(products.reduce((sum, row) => sum + row.cost, 0))
  const undetermined = products.filter((row) => row.costMissing)
  const stocked = products.filter((row) => row.costStatus !== 'none')
  const costStatus: CostStatus =
    stocked.length === 0
      ? 'none'
      : undetermined.length === stocked.length &&
          stocked.every((row) => row.costStatus === 'unknown')
        ? 'unknown'
        : undetermined.length > 0
          ? 'partial'
          : stocked.some((row) => row.costStatus === 'estimated')
            ? 'estimated'
            : 'known'
  const uncostedRevenue = round2(undetermined.reduce((sum, row) => sum + row.revenue, 0))
  const knownGrossProfit = round2(
    products.reduce((sum, row) => (row.profit === null ? sum : sum + row.profit), 0),
  )
  const grossProfit = isCostDeterminate(costStatus) ? round2(revenue - cost) : null
  const netProfit = grossProfit === null ? null : round2(grossProfit - salaries)

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
      costStatus,
      uncostedRevenue,
      knownGrossProfit,
      grossProfit,
      salaries,
      netProfit,
      netMarginPercent: netProfit === null ? null : percent(netProfit, revenue),
      invoiceCount: inCurrency.size,
      payrollCount: payrollsInCurrency.length,
    },
    otherCurrencies: [...others].map(([currency, counts]) => ({ currency, ...counts })),
  }
}

export interface InvoiceMargin {
  revenue: number
  cost: number
  /** null when the cost is not fully known: the margin is not 100%, it is unknown. */
  marginPercent: number | null
  costStatus: CostStatus
  costMissing: boolean
}

/** Margin of each invoice (for the till): profit % of its net sales. */
export function invoiceMargins(
  invoices: ProfitInvoice[],
  lines: ProfitLine[],
  consumptions: ProfitConsumption[],
): Map<string, InvoiceMargin> {
  const result = new Map<string, InvoiceMargin>()
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
      costStatus: report.totals.costStatus,
      costMissing: report.products.some((row) => row.costMissing),
    })
  }
  return result
}
