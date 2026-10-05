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
    // The transactions are the shared table: search and the type filter live
    // in its own toolbar, and there is no hand-made table or card list left.
    const ledger = view.slice(view.indexOf("t('till.ledger_title'"))
    expect(ledger).toContain('tableId="till-ledger"')
    expect(ledger).toContain('searchValue={ledgerSearch}')
    expect(ledger).toContain('<TableFilterSelect')
    expect(view).not.toContain('<table')
    expect(view).not.toContain('<SegmentedFilter')
    // «افزودن صندوق» is the page's own action and opens a dialog — once.
    expect(view.split("t('till.add_till'").length - 1).toBe(2)
    expect(view).toContain('data-add-till=""')
    // The chart's range is the shared switch.
    expect(view).toContain('<SegmentedControl')
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
    // Every currency in the range, one report each (never summed).
    expect(tab).toContain('useProfitReportsByCurrency(from, to, primaryCurrency)')
    expect(tab).toContain('useCurrencyStore((state) => state.primaryCurrency)')
    expect(table).toContain('<DataTable')
    // Links go through the locale rule (`useLocalePush`), not a bare router.
    expect(table).toContain("push('/team-and-payroll')")
    expect(table).toContain("push('/till')")
    expect(table).not.toContain('router.push(')
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

describe('#93 «بدون انبار» adds a product; warehouses can be renamed', () => {
  const container = code(ui('warehouse/containers/Warehouse-container.tsx'))
  it('the unassigned view opens the product modal, not a back link', () => {
    // In a real warehouse the same button now opens «افزودن به انبار» (#94).
    expect(container.replace(/\s+/g, ' ')).toContain(
      'isUnassigned ? () => setShowAddModal(true) : () => setShowAddToWarehouse(true)',
    )
    expect(container).toContain("safeT('warehouse.addProduct'")
  })
  it('a new product refreshes the warehouse figures too', () => {
    const refresh = container.slice(container.indexOf('const refreshStock'))
    expect(refresh.slice(0, 300)).toContain('queryKey: warehouseKeys.all')
  })
  it('the warehouse list has an edit action wired to the update hook', () => {
    expect(code(ui('warehouse/warehouse-list-table.tsx'))).toContain(
      "labelKey: 'warehouse.actions'",
    )
    expect(container).toContain('onEdit={setEditingWarehouse}')
    expect(container).toContain(
      'updateWarehouse.mutateAsync({ id: editingWarehouse.id, ...input })',
    )
  })
})

describe('#94/#95 add-to-warehouse modal, product code, expiry', () => {
  const modal = code(ui('warehouse/add-to-warehouse-modal.tsx'))
  const picker = code(ui('invoice-builder/grid/description-cell.tsx'))
  const expiry = code(ui('warehouse-detail/product-expiry-panel.tsx'))

  it('the modal has code, unit + custom unit, quantity, both prices and ONE minimum', () => {
    for (const key of [
      'productCode',
      'unit',
      'quantity',
      'buyPrice',
      'sellPrice',
      'minStock',
      'addUnit',
    ]) {
      expect(modal, key).toContain(`warehouse.${key}`)
    }
    // One minimum-stock input, not a second reorder point.
    expect((modal.match(/wh-product-min/g) ?? []).length).toBe(1)
    expect(modal).toContain('warehouseId,')
  })

  it('expiry is behind a switch and recorded as a batch', () => {
    expect(modal).toContain('<Switch')
    expect(modal).toContain('receiveBatch.mutateAsync({')
    expect(modal).toContain('expiryDate: form.expiryDate')
  })

  it('the invoice picker shows the code and the stock of the invoice warehouse', () => {
    expect(picker).toContain('useInvoiceWarehouseStock()')
    expect(picker).toContain('warehouseStock.quantityOf(product.id)')
    expect(picker).toContain('warehouseStock.warehouseName')
    expect(picker).toContain('{product.sku}')
  })

  it('a sale is blocked on the warehouse figure, a purchase never is', () => {
    expect(picker).toContain(
      "transactionType !== 'purchase' && typeof stock === 'number' && stock <= 0",
    )
  })

  it('the product page can correct an expiry date', () => {
    expect(expiry).toContain('useBatches(productId)')
    expect(expiry).toContain('useUpdateBatchDates()')
    expect(code(ui('warehouse-detail/containers/warehouse-detail-container.tsx'))).toContain(
      '<ProductExpiryPanel',
    )
  })
})
