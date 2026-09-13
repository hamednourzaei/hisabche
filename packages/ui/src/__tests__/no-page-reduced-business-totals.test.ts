import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Business totals on the warehouse and invoice pages must come from the
// server's `summary` (computed over every row), never from reducing a page.

const root = join(__dirname, '..')
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (rel: string) => strip(readFileSync(join(root, rel), 'utf8'))
const json = (l: string) =>
  JSON.parse(readFileSync(join(root, '../../i18n/messages', l, 'common.json'), 'utf8'))

describe('warehouse cards use the server stock summary', () => {
  const hook = read('hooks/warehouse/use-warehouse.ts')
  const view = read('components/ui/warehouse/warehouse-view.tsx')

  it('requests the summary and does not reduce products', () => {
    expect(hook).toContain('includeSummary: true')
    expect(hook).toContain('data?.summary')
    expect(hook).not.toContain('calculateTotals')
    expect(hook).not.toContain('.reduce(')
  })

  it('view reads summary fields, not the product page', () => {
    expect(view).toContain('summary?.totalValue')
    expect(view).toContain('summary?.lowStockCount')
    expect(view).toContain('summary?.outOfStockCount')
    expect(view).not.toContain('products.filter(')
  })
})

describe('invoice stat cards use the server invoice summary', () => {
  const hook = read('hooks/invoices/use-invoices-page.ts')
  const view = read('components/ui/invoices/invoices-view.tsx')

  it('requests the summary', () => {
    expect(hook).toContain('includeSummary: true')
    expect(hook).toContain('statsData?.summary')
  })

  it('does not sum invoice rows into a card', () => {
    expect(view).toContain('useInvoiceStats(statsSummary, t)')
    expect(view).not.toContain('acc + (inv.total')
  })
})

describe('customers cards say what they cover', () => {
  it('shows a coverage note when partial', () => {
    const stats = read('components/ui/customers/customer-stats.tsx')
    expect(stats).toContain('coverage?.isPartial')
    expect(stats).toContain('customers.statsCoverage')
  })

  it('new keys exist in fa, af and en', () => {
    for (const l of ['fa', 'af', 'en']) {
      const j = json(l)
      expect(j.warehouse.summaryUnavailable, l).toBeTruthy()
      expect(j.customers.statsCoverage, l).toBeTruthy()
      expect(j.customers.statsCoverageInvoices, l).toBeTruthy()
      expect(j.customers.statsCoverageCustomers, l).toBeTruthy()
    }
  })
})
