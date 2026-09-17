// Requests #89 (till page), #90 (multi-warehouse), #91 (profit & loss).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ui = (p: string) => readFileSync(join(__dirname, '../components/ui', p), 'utf8')
const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, '')

describe('#89 till page', () => {
  const view = code(ui('till/till-view.tsx'))
  const container = code(ui('till/containers/till-container.tsx'))

  it('removed sections are gone', () => {
    for (const key of [
      "t('till.session_title'",
      "t('till.movement_title'",
      "t('till.close_title'",
      "t('till.abandoned_title'",
      'onBankTransfer',
      'onClose(',
    ]) {
      expect(view, key).not.toContain(key)
    }
  })
  it('till list with «افزودن صندوق», click selects, «افزودن مبلغ به صندوق», search + filter above the table', () => {
    expect(view).toContain("t('till.add_till'")
    expect(view).toContain('onRowClick={(item) => onSelectTill(item.sessionId)}')
    expect(view).toContain("t('till.add_cash'")
    const ledger = view.slice(view.indexOf("t('till.ledger_title'"))
    expect(ledger.indexOf('value={ledgerSearch}')).toBeLessThan(ledger.indexOf('<table'))
    expect(ledger.indexOf('<SegmentedFilter')).toBeLessThan(ledger.indexOf('<table'))
    expect(container).toContain('useOpenSessions()')
    expect(container).toContain("kind: 'cash_in'")
  })
  it('shows the profit % from the accounting core', () => {
    expect(view).toContain('<MarginCell value={entry.marginPercent} />')
  })
})

describe('#90 multi-warehouse', () => {
  const container = code(ui('warehouse/containers/Warehouse-container.tsx'))
  it('list ↔ one warehouse by ?warehouse=, same stat cards, «افزودن انبار»', () => {
    expect(container).toContain("searchParams?.get('warehouse')")
    expect(container).toContain('useWarehouseOverview()')
    expect(container).toContain('useWarehouseDetail(warehouseParam)')
    expect(container).toContain('<WarehouseListTable')
    expect(container).toContain("safeT('warehouse.addWarehouse'")
  })
  it('the invoice form can name the warehouse', () => {
    expect(code(ui('invoice-builder/containers/invoice-builder-container.tsx'))).toContain(
      '<InvoiceWarehouseSelect',
    )
    expect(code(ui('invoice-builder/containers/invoice-preview-container.tsx'))).toContain(
      '...(draft.warehouseId ? { warehouseId: draft.warehouseId } : {}),',
    )
  })
})

describe('#91 profit & loss', () => {
  const tab = code(ui('accounting/tabs/IncomeStatementTab.tsx'))
  const table = code(ui('accounting/components/ProductProfitTable.tsx'))
  it('same date range, currency from onboarding, shared DataTable, totals + links', () => {
    expect(tab).toContain('useProfitReport(from, to, currency)')
    expect(tab).toContain('useCurrencyStore((state) => state.primaryCurrency)')
    expect(table).toContain('<DataTable')
    expect(table).toContain("router.push('/team-and-payroll')")
    expect(table).toContain("router.push('/till')")
    expect(table).toContain('percent(totals.netMarginPercent)')
    expect(table).not.toMatch(/\.reduce\(/)
  })
})
