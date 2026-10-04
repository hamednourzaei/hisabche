// ============================================
// Capabilities #145, #146 — report and dashboard builders.
// Engine N9 (reporting side).
//
// ⚠️ A BUILDER PICKS A DATASET. IT NEVER DEFINES A MEASURE.
//
// The tempting design is a report builder where the person writes the SQL, or
// picks any table and any aggregate. That produces a second profit formula, a
// second aging calculation and a second customer balance — inside a product
// whose entire history is the removal of exactly those. `TASK-close-the-gap.md`
// says it directly: «موتور کوئری جدید نساز» and «سازنده‌ی گزارش روی همان
// ListQuery».
//
// So a report is: a DATASET from a closed list, a set of DIMENSIONS to group
// by, and MEASURES that name functions which already exist. The builder chooses
// which; it cannot write one.
//
// ⚠️ AND EVERY MEASURE CARRIES WHERE ITS NUMBER COMES FROM.
//
// `profit-report.test.ts` exists because `insights` once recomputed profit and
// the two disagreed. A report builder that showed a margin with no provenance
// would put that back: a shop comparing its own dashboard with its own accounts
// would find two numbers and no way to say which is right. So `source` is part
// of the measure, and it is the name of the engine function — not a label.
export type DatasetKey =
  | 'invoices'
  | 'payments'
  | 'journal_entries'
  | 'customers'
  | 'products'
  | 'suppliers'
  | 'budget'
  | 'time_entries'

export type DimensionKey =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'weekday'
  | 'customer'
  | 'product'
  | 'supplier'
  | 'category'
  | 'payment_method'
  | 'status'
  | 'branch'
  | 'currency'

/**
 * ⚠️ MEASURES NAME EXISTING ENGINES, NOT ARITHMETIC.
 *
 * Each one is a function that already exists and is already tested somewhere
 * else. `revenue_from_net_sales` is `buildProfitReport`, not a `SUM` — because a
 * `SUM` over invoice totals is gross sales, which includes the discount and the
 * tax, and a shop comparing its dashboard to its income statement sees a
 * difference it cannot explain.
 */
export interface MeasureDefinition {
  key: string
  labelKey: string
  /**
   * ⚠️ WHERE THE NUMBER COMES FROM. A stable identifier the caller resolves —
   * the same one `profit-report.test.ts` and `outstanding-predicate.test.ts`
   * guard, so a report and a statement cannot drift apart silently.
   */
  source: string
  /**
   * ⚠️ MONOTONE IN THE DIMENSION — whether adding a row to a bucket can only
   * add to the total. Revenue, count and tax all are. A BALANCE is not: summing
   * a balance down a month column produces a nonsense number, and the builder has
   * to be able to say so before a shop reads it.
   */
  additive: boolean
  /** What unit the figure is in, so the UI does not guess a currency. */
  unit: 'money' | 'count' | 'percent' | 'duration'
}

const MEASURES: readonly MeasureDefinition[] = [
  {
    key: 'count',
    labelKey: 'measure.count',
    // ⚠️ Named like the others even though it is the one measure with no engine
    // behind it: a row count is a property of the dataset, not a calculation, and
    // the `source` is where a reader looks to find out whether it is.
    source: 'dataset:invoices.rows',
    additive: true,
    unit: 'count',
  },
  {
    key: 'gross_sales',
    labelKey: 'measure.grossSales',
    source: 'accounting:buildProfitReport:revenue',
    additive: true,
    unit: 'money',
  },
  {
    key: 'net_revenue',
    labelKey: 'measure.netRevenue',
    source: 'accounting:buildProfitReport:revenueAfterInvoiceDiscount',
    additive: true,
    unit: 'money',
  },
  {
    key: 'cost_of_goods',
    labelKey: 'measure.cogs',
    source: 'accounting:buildProfitReport:cost',
    additive: true,
    unit: 'money',
  },
  {
    key: 'gross_profit',
    labelKey: 'measure.grossProfit',
    source: 'accounting:buildProfitReport:totals.grossProfit',
    additive: true,
    unit: 'money',
  },
  {
    key: 'net_profit',
    labelKey: 'measure.netProfit',
    source: 'accounting:buildProfitReport:totals.netProfit',
    additive: true,
    unit: 'money',
  },
  {
    key: 'gross_margin',
    labelKey: 'measure.grossMargin',
    source: 'accounting:buildProfitReport:products.marginPercent',
    // ⚠️ NOT ADDITIVE. A 40% margin on two halves is not an 80% margin on the
    // whole; it is a weighted average, and a builder that summed it would show
    // a shop a margin it does not have.
    additive: false,
    unit: 'percent',
  },
  {
    key: 'outstanding',
    labelKey: 'measure.outstanding',
    source: 'payments:outstandingOf',
    // ⚠️ THE MOST IMPORTANT FLAG IN THIS FILE. Outstanding is a balance: it
    // falls as money arrives, so summing it down a timeline produces a number
    // that grows while the shop collects.
    additive: false,
    unit: 'money',
  },
  {
    key: 'overdue_amount',
    labelKey: 'measure.overdue',
    source: 'payments:ageInvoices',
    additive: false,
    unit: 'money',
  },
  {
    key: 'collected',
    labelKey: 'measure.collected',
    source: 'payments:summarizeParty:received',
    additive: true,
    unit: 'money',
  },
  {
    key: 'salaries',
    labelKey: 'measure.salaries',
    source: 'payroll:payrollLines',
    additive: true,
    unit: 'money',
  },
  {
    key: 'stock_value',
    labelKey: 'measure.stockValue',
    source: 'costing:CostingService.getValuation',
    additive: true,
    unit: 'money',
  },
  {
    key: 'budget_committed',
    labelKey: 'measure.budgetCommitted',
    source: 'budgeting:checkImpact',
    additive: false,
    unit: 'money',
  },
]

function measure(key: string): MeasureDefinition | null {
  return MEASURES.find((m) => m.key === key) ?? null
}

export interface ReportDefinition {
  key: string
  name: string
  dataset: DatasetKey
  /** Null means no grouping — one row for the whole period. */
  groupBy: readonly DimensionKey[] | null
  /** The figures to show. Names only — the values come from the engines. */
  measures: readonly string[]
  /** Ordering, on a measure or a dimension key. */
  orderBy?: { key: string; direction: 'asc' | 'desc' } | undefined
  /**
   * ⚠️ ROW CAP. Not for safety — for honesty: a report that silently returns the
   * first 1,000 rows looks complete and is not, and `no-silent-row-cap.test.ts`
   * exists because of that. A report that would exceed the cap says so.
   */
  maxRows: number
}

export type ReportProblem =
  | 'UNKNOWN_DATASET'
  | 'UNKNOWN_MEASURE'
  | 'UNKNOWN_DIMENSION'
  | 'NO_MEASURES'
  | 'DUPLICATE_MEASURE'
  | 'ORDER_BY_UNKNOWN'
  | 'TOO_MANY_DIMENSIONS'
  | 'NON_ADDITIVE_IN_TIME'
  | 'ROW_CAP_TOO_LOW'

/** Dimensions each dataset can actually group by. */
const DATASET_DIMENSIONS: Readonly<Record<DatasetKey, readonly DimensionKey[]>> = {
  invoices: [
    'day',
    'week',
    'month',
    'quarter',
    'weekday',
    'customer',
    'product',
    'status',
    'currency',
    'branch',
  ],
  payments: ['day', 'week', 'month', 'customer', 'payment_method', 'currency'],
  journal_entries: ['day', 'week', 'month', 'quarter', 'year', 'branch', 'currency'],
  customers: ['month', 'quarter', 'year', 'customer', 'category'],
  products: ['month', 'category', 'product'],
  suppliers: ['month', 'supplier'],
  budget: ['month', 'quarter', 'year', 'category', 'branch'],
  time_entries: ['day', 'week', 'month', 'weekday', 'product', 'employee' as DimensionKey],
}

/** Above this, a report stops being a report and starts being a data dump. */
export const MAX_DIMENSIONS = 3
export const MIN_ROW_CAP = 50

export function validateReport(definition: ReportDefinition): ReportProblem[] {
  const problems: ReportProblem[] = []

  if (!DATASET_DIMENSIONS[definition.dataset]) {
    problems.push('UNKNOWN_DATASET')
    return problems
  }

  if (definition.measures.length === 0) {
    problems.push('NO_MEASURES')
  }

  const seen = new Set<string>()
  for (const key of definition.measures) {
    if (seen.has(key)) problems.push('DUPLICATE_MEASURE')
    seen.add(key)
    if (!measure(key)) problems.push('UNKNOWN_MEASURE')
  }

  const allowed = DATASET_DIMENSIONS[definition.dataset] ?? []
  if (definition.groupBy) {
    if (definition.groupBy.length > MAX_DIMENSIONS) problems.push('TOO_MANY_DIMENSIONS')
    for (const dimension of definition.groupBy) {
      if (!allowed.includes(dimension)) problems.push('UNKNOWN_DIMENSION')
    }
  }

  if (definition.orderBy) {
    if (
      !definition.measures.includes(definition.orderBy.key) &&
      !(definition.groupBy ?? []).includes(definition.orderBy.key as DimensionKey)
    ) {
      problems.push('ORDER_BY_UNKNOWN')
    }
  }

  // ⚠️ THE CHECK THAT SAVES A SHOP FROM A WRONG NUMBER.
  //
  // Grouping by a TIMESPAN and summing a non-additive measure is the single most
  // common way a self-built report lies: outstanding added up month by month is
  // a growing number for a shop that is collecting perfectly well.
  const TIME_DIMENSIONS: readonly DimensionKey[] = [
    'day',
    'week',
    'month',
    'quarter',
    'year',
    'weekday',
  ]
  const groupedByTime = (definition.groupBy ?? []).some((d) => TIME_DIMENSIONS.includes(d))

  if (groupedByTime) {
    for (const key of definition.measures) {
      const definitionOfMeasure = measure(key)
      if (definitionOfMeasure && !definitionOfMeasure.additive) {
        problems.push('NON_ADDITIVE_IN_TIME')
      }
    }
  }

  // ⚠️ A CAP UNDER FIFTY MAKES EVERY REPORT WRONG. Ten rows with a cap of ten
  // looks like a complete answer and is not, and §7٫4 is precisely about a
  // number that is quietly a page.
  if (definition.maxRows < MIN_ROW_CAP) {
    problems.push('ROW_CAP_TOO_LOW')
  }

  return problems
}

/**
 * What a saved report carries that a definition cannot.
 *
 * ⚠️ THE SOURCES TRAVEL WITH THE REPORT. A saved report that does not remember
 * that its margin came from `buildProfitReport` will be read next year by
 * someone who assumes the margin was computed here — and that assumption is how
 * two dashboards start disagreeing.
 */
export interface SavedReport {
  key: string
  name: string
  definition: ReportDefinition
  /** Resolved from the measures, at save time. */
  sources: string[]
  savedAt: string
  version: number
}

export function saveReport(
  definition: ReportDefinition,
  savedAt: string,
  version = 1,
): SavedReport {
  return {
    key: definition.key,
    name: definition.name,
    definition,
    sources: [
      ...new Set(
        definition.measures.map((k) => measure(k)?.source).filter((s): s is string => Boolean(s)),
      ),
    ],
    savedAt,
    version,
  }
}

/**
 * ⚠️ WHAT A DASHBOARD IS: a list of saved reports, pinned to a position.
 *
 * Not a layout engine, and not a place to define anything. The distinction
 * matters because a dashboard builder that could compute a figure is a second
 * profit formula with a grid around it — and the user who built it is the same
 * person who has to defend it to an accountant.
 */
export interface DashboardDefinition {
  key: string
  name: string
  /** Saved report keys, in order. Never inline definitions. */
  tiles: readonly { reportKey: string; position: number; span: 1 | 2 | 3 }[]
}

export type DashboardProblem = 'EMPTY' | 'UNKNOWN_REPORT' | 'DUPLICATE_REPORT' | 'POSITION_CLASH'

export function validateDashboard(
  definition: DashboardDefinition,
  savedReports: readonly Pick<SavedReport, 'key'>[],
): DashboardProblem[] {
  const problems: DashboardProblem[] = []
  const known = new Set(savedReports.map((r) => r.key))
  const seenReports = new Set<string>()
  const seenPositions = new Set<number>()

  if (definition.tiles.length === 0) {
    problems.push('EMPTY')
    return problems
  }

  for (const tile of definition.tiles) {
    if (!known.has(tile.reportKey)) problems.push('UNKNOWN_REPORT')
    if (seenReports.has(tile.reportKey)) problems.push('DUPLICATE_REPORT')
    seenReports.add(tile.reportKey)
    if (seenPositions.has(tile.position)) problems.push('POSITION_CLASH')
    seenPositions.add(tile.position)
  }

  return problems
}

/** Every measure, for a UI to list them without knowing the keys. */
export function allMeasures(): readonly MeasureDefinition[] {
  return MEASURES
}

/** The datasets a builder may pick, with the dimensions each allows. */
export function datasets(): Readonly<Record<string, readonly DimensionKey[]>> {
  return DATASET_DIMENSIONS
}
