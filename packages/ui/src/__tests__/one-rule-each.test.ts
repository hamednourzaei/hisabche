// ============================================
// One rule, one file.
//
// ⚠️ «دو فرمول برای یک عدد» is the defect this repository has fixed most
// often: a total computed in the service, again in the grid, again in a
// Postgres function, and a fourth time on the device. The four disagree on
// the day a discount, a tax or a rounding boundary lands on them — and the
// shopkeeper is the one who finds out.
//
// The offline edition makes that risk structural: the same rule must now run
// on a server and on a device with no network. So Phase 2 of the offline
// programme moves each money rule into `packages/validation` and makes BOTH
// runtimes import it. This guard is the enforcement half of that move:
//
//   * the rule's defining function is declared in exactly ONE file;
//   * the backend IMPORTS it instead of carrying a copy;
//   * the file the schema used to own only RE-EXPORTS it.
//
// To add a rule in a later phase, add one row to RULES. Do not add an
// exception: an exception is how a second formula comes back.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/** `packages/` — this test lives in `packages/ui/src/__tests__`. */
const PACKAGES = join(__dirname, '..', '..', '..')
const ROOT = join(PACKAGES, '..')

interface Rule {
  /** What the rule decides, in the shopkeeper's words. */
  what: string
  /** The declaration that must exist once. A distinctive prefix of the line. */
  declaration: string
  /** The one file allowed to declare it, relative to the repository root. */
  owner: string
  /** A file that must import it instead of carrying a copy. */
  importer: string
  /** What the importer must name. */
  importedName: string
  /** The module the importer must take it from. */
  importerFrom: string
}

const RULES: readonly Rule[] = [
  {
    what: 'the money on an invoice header is derived from its lines',
    declaration: 'export function computeInvoiceMoney(',
    owner: 'packages/validation/src/schemas/invoice-math.ts',
    importer: 'backend/src/services/invoice.service.ts',
    importedName: 'computeInvoiceMoney',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the money of one invoice line (quantity, components, discount)',
    declaration: 'export function computeItemTotal(',
    owner: 'packages/validation/src/schemas/invoice-math.ts',
    importer: 'packages/validation/src/schemas/invoice-grid.ts',
    importedName: 'computeItemTotal',
    importerFrom: "'./invoice-math'",
  },
  {
    what: 'the header money of an invoice, from line totals that are already derived',
    declaration: 'export function sumInvoiceLines(',
    owner: 'packages/validation/src/schemas/invoice-math.ts',
    importer: 'packages/validation/src/schemas/invoice-grid.ts',
    importedName: 'sumInvoiceLines',
    importerFrom: "'./invoice-math'",
  },
  {
    what: "rounding one invoice amount to the currency's smallest unit",
    declaration: 'export function roundInvoiceMoney(',
    owner: 'packages/validation/src/schemas/invoice-math.ts',
    importer: 'packages/validation/src/schemas/invoice-grid.ts',
    importedName: 'roundInvoiceMoney',
    importerFrom: "'./invoice-math'",
  },
  {
    // ⚠️ The STORED line total, not only the header (owner decision, 19 Oct
    // 2026). `invoice_items.total_price` was taken from the request body, so the
    // one line-level money figure — the profit report's revenue share and a
    // purchase's cost-layer divisor — was the client's. The server now derives
    // it with this, the same call `computeInvoiceMoney` totals with.
    what: 'the money of one invoice line, rounded once in the currency’s smallest unit',
    declaration: 'export function computeItemTotalRounded(',
    owner: 'packages/validation/src/schemas/invoice-math.ts',
    importer: 'backend/src/services/invoice.service.ts',
    importedName: 'computeItemTotalRounded',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'which warehouse a stock change from the product page lands in',
    declaration: 'export function stockEditWarehouse(',
    owner: 'packages/validation/src/schemas/stock.ts',
    importer: 'backend/src/services/inventory/warehouse-summary.domain.ts',
    importedName: 'stockEditWarehouse',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'how much unassigned stock may be moved into a warehouse',
    declaration: 'export function checkAssign(',
    owner: 'packages/validation/src/schemas/stock.ts',
    importer: 'backend/src/services/inventory/warehouse-summary.domain.ts',
    importedName: 'checkAssign',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'where one product’s stock actually is, warehouse by warehouse',
    declaration: 'export function productWarehouseBreakdown(',
    owner: 'packages/validation/src/schemas/stock.ts',
    importer: 'backend/src/services/inventory/warehouse-summary.domain.ts',
    importedName: 'productWarehouseBreakdown',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'whether a payment may settle this invoice (same currency, or the books one)',
    declaration: 'export function settlesInCurrency(',
    owner: 'packages/validation/src/schemas/payments.domain.ts',
    importer: 'backend/src/services/payments/payments.domain.ts',
    importedName: 'settlesInCurrency',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'what is still owed on an invoice after its allocations',
    declaration: 'export function outstandingOf(',
    owner: 'packages/validation/src/schemas/payments.domain.ts',
    importer: 'backend/src/services/payments/payments.domain.ts',
    importedName: 'outstandingOf',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'every reason a payment may not be recorded as asked',
    declaration: 'export function validateAllocations(',
    owner: 'packages/validation/src/schemas/payments.domain.ts',
    importer: 'backend/src/services/payments/payments.domain.ts',
    importedName: 'validateAllocations',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'spreading a payment over the open invoices, oldest due first',
    declaration: 'export function autoAllocate(',
    owner: 'packages/validation/src/schemas/payments.domain.ts',
    importer: 'backend/src/services/payments/payments.domain.ts',
    importedName: 'autoAllocate',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the three amounts of a payment’s journal entry, in books currency',
    declaration: 'export function paymentPosting(',
    owner: 'packages/validation/src/schemas/payments.domain.ts',
    importer: 'backend/src/services/payments/payments.domain.ts',
    importedName: 'paymentPosting',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'what a party owes, currency by currency — never one figure across them',
    declaration: 'export function partyBalancesByCurrency(',
    owner: 'packages/validation/src/schemas/payments.domain.ts',
    importer: 'backend/src/services/payments/payments.domain.ts',
    importedName: 'partyBalancesByCurrency',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'what consuming a quantity takes from the cost layers, and what it costs',
    declaration: 'export function planConsumption(',
    owner: 'packages/validation/src/schemas/costing.domain.ts',
    importer: 'backend/src/services/inventory-costing/costing.domain.ts',
    importedName: 'planConsumption',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the weighted average of what is still open (by quantity, not by price)',
    declaration: 'export function averageUnitCost(',
    owner: 'packages/validation/src/schemas/costing.domain.ts',
    importer: 'backend/src/services/inventory-costing/costing.domain.ts',
    importedName: 'averageUnitCost',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'whether a business may sell what it does not have',
    declaration: 'export function mayIssue(',
    owner: 'packages/validation/src/schemas/costing.domain.ts',
    importer: 'backend/src/services/inventory-costing/costing.domain.ts',
    importedName: 'mayIssue',
    importerFrom: "'@hisabche/validation'",
  },
  {
    // ⚠️ THREE names that all used to be `stockValue` (owner decision, 19 Oct
    // 2026). One name with three meanings is what this file exists to stop; the
    // rows below are the three meanings, each named for the price it uses.
    what: 'what the cost layers still on hand are worth (Σ remaining × unit cost)',
    declaration: 'export function layersValue(',
    owner: 'packages/validation/src/schemas/costing.domain.ts',
    importer: 'backend/src/services/inventory-costing/costing.domain.ts',
    importedName: 'layersValue',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'what one product’s stock is worth at its SELLING price',
    declaration: 'export function stockValueAtSellPrice(',
    owner: 'packages/validation/src/schemas/product.schema.ts',
    importer:
      'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
    importedName: 'stockValueAtSellPrice',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'what the stock in a warehouse COST — quantity × the BUY price',
    declaration: 'export function stockValueAtBuyPrice(',
    owner: 'backend/src/services/inventory/warehouse-map.domain.ts',
    // ⚠️ A test as the importer: this figure is used only inside its own module
    // (the map's `buildWarehouseMap` and `summarizeStock`), so the test is the
    // one other holder of the name — and it is where a copy would be noticed.
    importer: 'backend/src/__tests__/warehouse-map-domain.test.ts',
    importedName: 'stockValueAtBuyPrice',
    importerFrom: "'../services/inventory/warehouse-map.domain'",
  },
  {
    what: 'the profit of one line, from the cost actually consumed',
    // ⚠️ The full signature, not just the name: this is the MONEY-PATH line
    // profit. The collision with the period-level `grossProfit` in
    // `insights.domain.ts` was resolved on 19 Oct 2026 (owner decision) by
    // renaming that one to `periodGrossProfit`; this one keeps its name, and the
    // signature still pins which formula this row is about.
    declaration: 'export function grossProfit(revenue: number, consumedCost: number)',
    owner: 'packages/validation/src/schemas/costing.domain.ts',
    importer: 'backend/src/services/inventory-costing/costing.domain.ts',
    importedName: 'grossProfit',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the gross profit of a PERIOD, from its revenue and consumed cost',
    declaration: 'export function periodGrossProfit(',
    owner: 'backend/src/services/insights/insights.domain.ts',
    importer: 'backend/src/services/insights/insights.service.ts',
    importedName: 'periodGrossProfit',
    importerFrom: "'./insights.domain'",
  },
  {
    what: 'whether a set of journal lines may become an entry',
    declaration: 'export function validateEntryLines(',
    owner: 'packages/validation/src/schemas/accounting.domain.ts',
    importer: 'backend/src/services/accounting/accounting.domain.ts',
    importedName: 'validateEntryLines',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the integer unit the ledger compares in',
    declaration: 'export function toMinorUnits(',
    owner: 'packages/validation/src/schemas/accounting.domain.ts',
    importer: 'backend/src/services/accounting/accounting.domain.ts',
    importedName: 'toMinorUnits',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the sum the ledger checks its two sides with',
    declaration: 'export function sumMinorUnits(',
    owner: 'packages/validation/src/schemas/accounting.domain.ts',
    importer: 'backend/src/services/accounting/accounting.domain.ts',
    importedName: 'sumMinorUnits',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'a reversal: the original with its two sides exchanged',
    declaration: 'export function reverseLines(',
    owner: 'packages/validation/src/schemas/accounting.domain.ts',
    importer: 'backend/src/services/accounting/accounting.domain.ts',
    importedName: 'reverseLines',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'lines for one account merged, netted and zero-dropped before posting',
    declaration: 'export function collapseLines(',
    owner: 'packages/validation/src/schemas/accounting.domain.ts',
    importer: 'backend/src/services/accounting/accounting.domain.ts',
    importedName: 'collapseLines',
    importerFrom: "'@hisabche/validation'",
  },
  {
    // ⚠️ `LedgerPeriodLock`, the permanent name (owner decision, 19 Oct 2026).
    // `PeriodLock` in the same package is the API payload of `periodLockSchema`
    // (`{lockedUntil, reason}`, no branch); this is the branch-aware lock the
    // posting rule consults. An alias used to keep them apart — a name a reader
    // has to be told about is the wrong name.
    what: 'one period lock, with the branch it belongs to (null = the company lock)',
    declaration: 'export interface LedgerPeriodLock {',
    owner: 'packages/validation/src/schemas/accounting.domain.ts',
    importer: 'backend/src/services/accounting/accounting.domain.ts',
    importedName: 'LedgerPeriodLock',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the journal lines one invoice books',
    declaration: 'export function invoiceLedgerLines(',
    owner: 'packages/validation/src/schemas/invoice-posting.domain.ts',
    importer: 'backend/src/services/accounting/invoice-posting.domain.ts',
    importedName: 'invoiceLedgerLines',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'an invoice amount restated in the books currency at its frozen rate',
    declaration: 'export function inBooksCurrency(',
    owner: 'packages/validation/src/schemas/invoice-posting.domain.ts',
    importer: 'backend/src/services/accounting/invoice-posting.domain.ts',
    importedName: 'inBooksCurrency',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the revenue, cost and profit of every product sold',
    declaration: 'export function buildProfitReport(',
    owner: 'packages/validation/src/schemas/profit-report.domain.ts',
    importer: 'backend/src/services/accounting/profit-report.domain.ts',
    importedName: 'buildProfitReport',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'one line’s share of the invoice net sales',
    declaration: 'export function lineRevenues(',
    owner: 'packages/validation/src/schemas/profit-report.domain.ts',
    importer: 'backend/src/services/accounting/profit-report.domain.ts',
    importedName: 'lineRevenues',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'a foreign sale restated at the rate frozen on its invoice',
    declaration: 'export function restateAtRates',
    owner: 'packages/validation/src/schemas/profit-report.domain.ts',
    importer: 'backend/src/services/accounting/profit-report.domain.ts',
    importedName: 'restateAtRates',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'whether the cost of a sale is known well enough to state a profit',
    declaration: 'export function isCostDeterminate(',
    owner: 'packages/validation/src/schemas/profit-report.domain.ts',
    importer: 'backend/src/services/accounting/profit-report.domain.ts',
    importedName: 'isCostDeterminate',
    importerFrom: "'@hisabche/validation'",
  },
  {
    what: 'the margin of one invoice, for the till',
    declaration: 'export function invoiceMargins(',
    owner: 'packages/validation/src/schemas/profit-report.domain.ts',
    importer: 'backend/src/services/accounting/profit-report.domain.ts',
    importedName: 'invoiceMargins',
    importerFrom: "'@hisabche/validation'",
  },
]

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === 'dist' || name === '.next')
      continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) found.push(path)
  }
  return found
}

/** Every .ts/.tsx in the server and the shared packages, tests excluded. */
function allRuntimeFiles(): string[] {
  const files = sourceFiles(join(ROOT, 'backend', 'src'))
  for (const name of readdirSync(PACKAGES)) {
    const dir = join(PACKAGES, name, 'src')
    try {
      if (statSync(dir).isDirectory()) files.push(...sourceFiles(dir))
    } catch {
      // A package without a `src` folder has no runtime code to guard.
    }
  }
  return files
}

const relativeToRoot = (path: string) => relative(ROOT, path).split('\\').join('/')

describe('one rule, one file', () => {
  const files = allRuntimeFiles()

  for (const rule of RULES) {
    describe(rule.what, () => {
      const holders = files.filter((path) => readFileSync(path, 'utf8').includes(rule.declaration))

      it(`is declared in exactly one file: ${rule.owner}`, () => {
        expect(
          holders.map(relativeToRoot).sort(),
          `«${rule.declaration.trim()}» must exist once. A second copy is a second formula.`,
        ).toEqual([rule.owner])
      })

      it(`is imported by ${rule.importer}, not copied into it`, () => {
        const source = readFileSync(join(ROOT, rule.importer), 'utf8')
        expect(source, `${rule.importer} must import ${rule.importedName}`).toContain(
          rule.importedName,
        )
        expect(source, `${rule.importer} must not redeclare it`).not.toContain(rule.declaration)
        expect(source, `${rule.importer} must take it from ${rule.importerFrom}`).toContain(
          rule.importerFrom,
        )
      })
    })
  }

  it('the schema file only re-exports the money rule — it declares nothing', () => {
    const schema = readFileSync(
      join(ROOT, 'packages/validation/src/schemas/invoice.schema.ts'),
      'utf8',
    )
    expect(schema).toContain(
      "export { computeItemTotal, computeInvoiceMoney } from './invoice-math'",
    )
    expect(schema).not.toContain('export function computeInvoiceMoney(')
    expect(schema).not.toContain('export function computeItemTotal(')
  })
})
