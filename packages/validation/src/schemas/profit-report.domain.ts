// ============================================
// packages/validation/src/schemas/profit-report.domain.ts
//
// Request #91 — the profit and loss report on /accounting, in the ACCOUNTING
// CORE and nowhere else (insights reads it from here; the till asks it for the
// margin of a document). One set of rules:
//
// ⚠️ THIS FILE IS A RULE, NOT A SERVER CAPABILITY.
//
// It moved out of `backend/src/services/accounting/profit-report.domain.ts` in
// Phase 2 of the offline edition: the device must state the profit of a sale it
// made with no server to ask, and «what did I earn» cannot have two answers.
// The backend file re-exports every name here, so its importers are unchanged.
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
//
// ⚠️ `round2` IS THE SHARED ONE (`./money`), AND IT DOES NOT DECIDE MEANING.
//
// There is ONE `round2`, in `./money`, and every file imports it.
//
// ⚠️ AND A ROUNDING HELPER HAS NO OPINION ABOUT WHAT A MISSING FIGURE MEANS.
//
// `round2` answers 0 for a value it cannot round (NaN, Infinity). That is right
// for a raw helper and WRONG for a report: a cost nobody could read would become
// free goods and the profit would be the whole revenue. So this file decides the
// meaning BEFORE the rounding, in the two places a figure can arrive:
//
//   · a CONSUMPTION whose amount is not finite sets `unreadable` on its key
//     (below), so the document is counted as uncosted and the cost status is
//     partial or unknown;
//   · a ROW whose revenue or cost is not finite fails `figuresRead`, and the
//     row's profit — with its margin, and the period's `grossProfit`, which a
//     person decides on — is `null` instead of a difference from zero.
//
// `revenue` and `cost` stay numbers on the row (their consumers, the API and the
// screens, read a number there), so an unreadable one of those still prints 0 on
// those two fields while the profit beside it is a dash. CLAUDE.md §3,
// «unknown is not zero».
// ============================================

import { round2 } from './money'

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
  /**
   * The sale invoices that sold this product with no cost behind it (at most
   * 100) — what «give these sales their cost» acts on (9 Nov 2026).
   */
  uncostedInvoiceIds?: string[] | undefined
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
    /**
     * M5 (B2-5): revenue the ledger HOLDS BACK as deferred revenue in this window (package sold, not yet delivered) minus what
     * deliveries released. Present only when the books currency report carries it; `revenue` already has it taken off, so
     * revenue = the invoices' net sales - this. Package revenue is recognised at DELIVERY, as the ledger says.
     */
    deferredRevenueChange?: number
    /**
     * M5 / C2: what the accounting LEDGER says for the window (books currency): revenue = sales accounts, cost = cost-of-sales
     * accounts, inventoryLoss = write-offs. The ledger is the truth of profit; the rows above are operational drill-down.
     * Present only on the books-currency report and only when the ledger was read.
     */
    ledger?: { revenue: number; cost: number; inventoryLoss: number; grossProfit: number }
    /** Where the headline `revenue` / `cost` / `grossProfit` come from: the ledger, or (labelled NOT_LEDGER_BASED) the drill-down rows. */
    basis: 'ledger' | 'drill_down'
    /** The operational figures behind the headline when it is the ledger: sum(drillDown) + reconciliation = the ledger. */
    drillDown?: { revenue: number; cost: number }
    /**
     * ledger − drill-down, shown explicitly and never absorbed: `revenue` = ledger revenue − totals.revenue,
     * `cost` = (ledger cost + loss) − totals.cost. sum(drill-down) + reconciliation = ledger total.
     */
    reconciliation?: { revenue: number; cost: number }
    salaries: number
    netProfit: number | null
    netMarginPercent: number | null
    invoiceCount: number
    payrollCount: number
  }
  /** Documents in the range in another currency — not in the figures. */
  otherCurrencies: Array<{ currency: string; invoices: number; payrolls: number }>
}

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
  /**
   * The accounting ledger's net change of the deferred-revenue liability over the window, in the BOOKS currency (credits at
   * sale minus releases at delivery). Taken off the revenue of the books-currency report ONLY - never converted, never guessed
   * for another currency (a document in another currency without a rate stays out of the figures, as before).
   */
  deferredRevenueChange?: number | undefined
  /** The books currency, so the change above lands on the right report. */
  booksCurrency?: string | undefined
  /** The ledger's own sums for the window, books currency (see ProfitReport.totals.ledger). */
  ledgerTotals?: { revenue: number; cost: number; inventoryLoss: number } | undefined
}): ProfitReport {
  const deferredChange =
    input.booksCurrency !== undefined && input.booksCurrency === input.currency
      ? round2(Number(input.deferredRevenueChange) || 0)
      : 0
  const inCurrency = new Map(
    input.invoices
      .filter((invoice) => invoice.currency === input.currency)
      .map((invoice) => [invoice.id, invoice]),
  )

  const costByLine = new Map<
    string,
    {
      amount: number
      estimated: boolean
      quantity: number
      quantityKnown: boolean
      unreadable: boolean
    }
  >()
  for (const row of input.consumptions) {
    if (!row.invoiceId || !inCurrency.has(row.invoiceId)) continue
    const key = `${row.invoiceId}:${row.productId}`
    const current = costByLine.get(key) ?? {
      amount: 0,
      estimated: false,
      quantity: 0,
      quantityKnown: true,
      unreadable: false,
    }
    // ⚠️ A CONSUMPTION WHOSE AMOUNT COULD NOT BE READ IS NOT A COST OF ZERO.
    //
    // `round2` would answer 0 for it, and the row's profit would then be the
    // whole revenue — a cost that could not be read shown as free goods. The
    // key is marked, and it is counted as an UNCOSTED document below, so the
    // cost status becomes partial or unknown and the profit is null.
    if (Number.isFinite(row.amount)) current.amount += row.amount
    else current.unreadable = true
    current.estimated ||= row.isEstimated
    if (row.quantity === undefined) current.quantityKnown = false
    else current.quantity += row.quantity
    costByLine.set(key, current)
  }

  type Tally = ProductProfitRow & {
    costedDocuments: number
    uncostedDocuments: number
    uncostedInvoices: Set<string>
  }
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
          uncostedInvoices: new Set<string>(),
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
          if (cost && !cost.unreadable) {
            row.cost += cost.amount
            row.costEstimated ||= cost.estimated
            row.costedDocuments += 1
            // A consumption that covers fewer units than were sold leaves the
            // rest without a cost.
            const short = cost.quantityKnown ? sold - cost.quantity : 0
            if (short > QUANTITY_EPSILON) {
              row.uncostedQuantity += short
              row.uncostedDocuments += 1
              row.uncostedInvoices.add(invoiceId)
            }
          } else {
            row.uncostedQuantity += sold
            row.uncostedDocuments += 1
            row.uncostedInvoices.add(invoiceId)
          }
        }
      }
      byProduct.set(key, row)
    }
  }

  const products: ProductProfitRow[] = [...byProduct.values()]
    .map(({ costedDocuments, uncostedDocuments, uncostedInvoices, ...row }) => {
      // ⚠️ THE FIGURE IS DECIDED BEFORE IT IS ROUNDED (see the file header).
      //
      // A revenue or a cost that could not be read is NOT a number: `round2`
      // would show it as 0, and a profit of `revenue − 0` is «unknown shown as
      // zero». The row keeps the fields its consumers read, but its profit and
      // its margin are null, and it is reported as cost-missing.
      const revenue = round2(row.revenue)
      const cost = round2(row.cost)
      const figuresRead = Number.isFinite(row.revenue) && Number.isFinite(row.cost)
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
      const determinate = isCostDeterminate(costStatus) && figuresRead
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
        uncostedInvoiceIds: [...uncostedInvoices].slice(0, 100),
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
  // The OPERATIONAL (drill-down) figures: the product rows summed, with the ledger's deferral taken off.
  const drillRevenue = round2(products.reduce((sum, row) => sum + row.revenue, 0) - deferredChange)
  const drillCost = round2(products.reduce((sum, row) => sum + row.cost, 0))
  // M5 / C2: the ledger's own figures and the explicit difference to the drill-down (books currency report only).
  const ledgerBlock =
    input.ledgerTotals !== undefined &&
    input.booksCurrency !== undefined &&
    input.booksCurrency === input.currency
      ? (() => {
          const ledgerRevenue = round2(input.ledgerTotals.revenue)
          const ledgerCost = round2(input.ledgerTotals.cost)
          const ledgerLoss = round2(input.ledgerTotals.inventoryLoss)
          return {
            ledger: {
              revenue: ledgerRevenue,
              cost: ledgerCost,
              inventoryLoss: ledgerLoss,
              grossProfit: round2(ledgerRevenue - ledgerCost - ledgerLoss),
            },
            reconciliation: {
              revenue: round2(ledgerRevenue - drillRevenue),
              cost: round2(ledgerCost + ledgerLoss - drillCost),
            },
          }
        })()
      : null
  // C2: when the ledger was read, the HEADLINE is the ledger (revenue = sales accounts; cost = cost of sales + inventory loss, where a
  // scrapped return only moves cost from the first to the second). The rows stay as drill-down and the difference is `reconciliation`.
  const revenue = ledgerBlock ? ledgerBlock.ledger.revenue : drillRevenue
  const cost = ledgerBlock
    ? round2(ledgerBlock.ledger.cost + ledgerBlock.ledger.inventoryLoss)
    : drillCost
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
    products.reduce((sum, row) => (row.profit === null ? sum : sum + row.profit), 0) -
      deferredChange,
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
      ...(deferredChange !== 0 ? { deferredRevenueChange: deferredChange } : {}),
      // NOT_LEDGER_BASED is visible: `basis` says where the headline came from.
      basis: ledgerBlock ? ('ledger' as const) : ('drill_down' as const),
      ...(ledgerBlock
        ? { ...ledgerBlock, drillDown: { revenue: drillRevenue, cost: drillCost } }
        : {}),
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

// ─── V60 Slice 8: Cost Objects & True Profit (delegates 100% to buildProfitReport) ──

export type CostObjectType =
  'project' | 'work_order' | 'repair_ticket' | 'service_session' | 'trip' | 'branch' | 'dimension'

export interface CostObjectInvoiceInput extends ProfitInvoice {
  readonly costObjectId?: string | null | undefined
  readonly costObjectType?: CostObjectType | undefined
  readonly costObjectLabel?: string | null | undefined
}

export interface OverheadAllocationPolicy {
  readonly policyKey: string
  /** Explicit allocated overhead in the same currency, keyed by costObjectId. */
  readonly allocatedByCostObjectId: Readonly<Record<string, number>>
}

export interface CostObjectProfitRow {
  readonly costObjectId: string
  readonly costObjectType: CostObjectType
  readonly label: string
  readonly currency: string
  readonly revenue: number
  readonly cost: number
  readonly grossProfit: number | null
  readonly overheadStatus: 'not_allocated' | 'allocated'
  readonly overheadNote: string | null
  readonly overhead: number | null
  /** null until an overhead rule allocates this object's share — unallocated is unknown, not 0. */
  readonly netProfit: number | null
  /** Net margin: null whenever `netProfit` is. */
  readonly marginPercent: number | null
  /** Gross profit over revenue; null when gross profit is unknown. */
  readonly grossMarginPercent: number | null
  readonly costStatus: CostStatus
  readonly invoiceCount: number
}

export interface CostObjectProfitReport {
  readonly from: string
  readonly to: string
  readonly currency: string
  /** NEEDS_OWNER_DECISION when no explicit overhead policy is configured. */
  readonly overheadPolicyStatus: 'not_allocated' | 'allocated'
  readonly overheadNotice: string
  readonly rows: readonly CostObjectProfitRow[]
  /**
   * Sales in this currency that name no project or branch. They are in the period's profit but
   * in no row here — counted, so the rows are never read as the whole business.
   */
  readonly untagged: { readonly invoiceCount: number; readonly revenue: number }
}

/**
 * Slices revenue, direct cost and profit by cost object (dimension/project/work-order/trip)
 * in ONE currency, delegating every calculation to `buildProfitReport` (no second formula).
 */
export function buildCostObjectProfitReport(input: {
  readonly from: string
  readonly to: string
  readonly currency: string
  readonly invoices: readonly CostObjectInvoiceInput[]
  readonly lines: readonly ProfitLine[]
  readonly consumptions: readonly ProfitConsumption[]
  readonly overheadPolicy?: OverheadAllocationPolicy | undefined
}): CostObjectProfitReport {
  const inCurrency = input.invoices.filter((inv) => inv.currency === input.currency)
  const grouped = new Map<
    string,
    {
      costObjectId: string
      costObjectType: CostObjectType
      label: string
      invoices: CostObjectInvoiceInput[]
      invoiceIds: Set<string>
    }
  >()

  for (const inv of inCurrency) {
    if (!inv.costObjectId) continue
    const existing = grouped.get(inv.costObjectId)
    if (existing) {
      existing.invoices.push(inv)
      existing.invoiceIds.add(inv.id)
    } else {
      grouped.set(inv.costObjectId, {
        costObjectId: inv.costObjectId,
        costObjectType: inv.costObjectType ?? 'dimension',
        label: inv.costObjectLabel ?? inv.costObjectId,
        invoices: [inv],
        invoiceIds: new Set([inv.id]),
      })
    }
  }

  const rows: CostObjectProfitRow[] = []
  for (const group of grouped.values()) {
    const groupLines = input.lines.filter((line) => group.invoiceIds.has(line.invoiceId))
    const groupConsumptions = input.consumptions.filter(
      (c) => c.invoiceId !== null && group.invoiceIds.has(c.invoiceId),
    )
    const subReport = buildProfitReport({
      from: input.from,
      to: input.to,
      currency: input.currency,
      invoices: group.invoices,
      lines: groupLines,
      consumptions: groupConsumptions,
      payrolls: [],
    })

    const gp = subReport.totals.grossProfit
    const hasExplicitOverhead =
      input.overheadPolicy !== undefined &&
      Object.prototype.hasOwnProperty.call(
        input.overheadPolicy.allocatedByCostObjectId,
        group.costObjectId,
      )
    const overheadVal = hasExplicitOverhead
      ? round2(input.overheadPolicy!.allocatedByCostObjectId[group.costObjectId]!)
      : null

    // Unknown gross profit stays null ("unknown is not zero"). 12 Nov 2026 audit: with no
    // overhead allocated, net profit was reported EQUAL to gross profit — overhead counted as 0.
    // Net is known only when both gross profit and this object's overhead are.
    const netVal = gp === null || overheadVal === null ? null : round2(gp - overheadVal)
    const revenue = subReport.totals.revenue
    const marginVal = netVal === null || revenue <= 0 ? null : round2((netVal / revenue) * 100)
    const grossMarginVal = gp === null || revenue <= 0 ? null : round2((gp / revenue) * 100)

    rows.push({
      costObjectId: group.costObjectId,
      costObjectType: group.costObjectType,
      label: group.label,
      currency: input.currency,
      revenue: subReport.totals.revenue,
      cost: subReport.totals.cost,
      grossProfit: gp,
      overheadStatus: overheadVal === null ? 'not_allocated' : 'allocated',
      overheadNote: overheadVal === null ? 'overhead not allocated' : null,
      overhead: overheadVal,
      netProfit: netVal,
      marginPercent: marginVal,
      grossMarginPercent: grossMarginVal,
      costStatus: subReport.totals.costStatus,
      invoiceCount: subReport.totals.invoiceCount,
    })
  }

  return {
    from: input.from,
    to: input.to,
    currency: input.currency,
    overheadPolicyStatus: input.overheadPolicy ? 'allocated' : 'not_allocated',
    overheadNotice: input.overheadPolicy
      ? input.overheadPolicy.policyKey
      : 'overhead not allocated',
    rows,
    untagged: untaggedTotals(input, inCurrency),
  }
}

function untaggedTotals(
  input: Parameters<typeof buildCostObjectProfitReport>[0],
  inCurrency: readonly CostObjectInvoiceInput[],
): { invoiceCount: number; revenue: number } {
  const invoices = inCurrency.filter((inv) => !inv.costObjectId)
  if (invoices.length === 0) return { invoiceCount: 0, revenue: 0 }
  const ids = new Set(invoices.map((inv) => inv.id))
  const report = buildProfitReport({
    from: input.from,
    to: input.to,
    currency: input.currency,
    invoices,
    lines: input.lines.filter((line) => ids.has(line.invoiceId)),
    consumptions: input.consumptions.filter((c) => c.invoiceId !== null && ids.has(c.invoiceId)),
    payrolls: [],
  })
  return { invoiceCount: report.totals.invoiceCount, revenue: report.totals.revenue }
}
