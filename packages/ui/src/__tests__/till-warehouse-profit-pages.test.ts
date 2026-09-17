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
      "t('till.abandoned_title'",
      'onBankTransfer',
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

describe('#92 till row actions, warehouse edit, manual rates, invoice warehouse', () => {
  it('each till row can be suspended/resumed and closed with a count', () => {
    const view = code(ui('till/till-view.tsx'))
    expect(view).toContain("onSetSuspended(item.sessionId, item.status !== 'suspended')")
    expect(view).toContain('onCloseTill({')
    expect(view).toContain("closeVariance !== 0 && varianceReason.trim() === ''")
  })
  it('warehouse rows have «ویرایش»', () => {
    expect(code(ui('warehouse/warehouse-list-table.tsx'))).toContain(
      'onEdit({ id: row.id, name: row.name, location: row.location })',
    )
    expect(code(ui('warehouse/containers/Warehouse-container.tsx'))).toContain(
      'useUpdateWarehouse()',
    )
  })
  it('currency chips use only rates the user entered — no constants', () => {
    const container = code(ui('warehouse/containers/Warehouse-container.tsx'))
    expect(container).not.toMatch(/rate:\s*0\.\d/)
    expect(container).toContain('rate: rate?.manual ? rate.rate : null')
  })
  it('the invoice warehouse is shown for any warehouse, auto-picked when there is one', () => {
    const select = code(ui('invoice-builder/invoice-warehouse-select.tsx'))
    expect(select).toContain('if (warehouses.length === 0) return null')
    expect(select).toContain('warehouses.length === 1) onChange(warehouses[0]!.id)')
  })
})
