// ============================================
// Inventory — dense product table, stock filters, barcode lookup,
// CSV/Excel import and export.
// ============================================

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload } from 'lucide-react'
import { useProducts } from '@hisabche/api'
import type { Product } from '@hisabche/validation'

import { Badge, Button, Input, type BadgeTone } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/layout/page-header'
import { FilterTabs, type FilterOption } from '@/components/ui/filter-tabs'
import { useBarcodeScanner } from './use-barcode-scanner'
import { exportRows, importRows } from '@/shared/lib/spreadsheet'
import { formatAmount, formatMoney } from '@/shared/lib/currency'
import { useSearchFocus } from '@/shared/hooks/use-search-focus'
import { useCurrency } from '@/shared/stores/ui.store'

type StockFilter = 'all' | 'lowStock' | 'outOfStock'

function stockState(product: Product): { key: 'inStock' | 'lowStock' | 'outOfStock'; tone: BadgeTone } {
  const quantity = product.quantity ?? 0
  const minimum = product.minStockLevel ?? 0

  if (quantity <= 0) return { key: 'outOfStock', tone: 'danger' }
  if (minimum > 0 && quantity <= minimum) return { key: 'lowStock', tone: 'warning' }
  return { key: 'inStock', tone: 'success' }
}

export default function ProductsPage() {
  const { t } = useTranslation('desktop')
  const currency = useCurrency()

  const searchRef = useRef<HTMLInputElement>(null)
  useSearchFocus(searchRef)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')

  const query = useProducts(
    useMemo(
      () => ({ page: 1, limit: 300, search, lowStock: filter === 'lowStock' ? true : undefined }),
      [filter, search]
    )
  )

  const rows = useMemo(() => {
    const list: Product[] = query.data?.products ?? []
    if (filter === 'outOfStock') return list.filter((product) => (product.quantity ?? 0) <= 0)
    return list
  }, [filter, query.data])

  // A scan filters the table down to the matching product.
  useBarcodeScanner(useCallback((code: string) => setSearch(code), []))

  const columns = useMemo<readonly Column<Product>[]>(
    () => [
      { key: 'name', header: t('inventory.product'), width: '1fr', render: (row) => row.name },
      { key: 'barcode', header: t('inventory.barcode'), width: '160px', render: (row) => row.barcode ?? '—' },
      {
        key: 'stock',
        header: t('inventory.stock'),
        width: '110px',
        align: 'end',
        render: (row) => formatAmount(row.quantity ?? 0),
      },
      {
        key: 'price',
        header: t('inventory.price'),
        width: '150px',
        align: 'end',
        render: (row) => formatMoney(row.sellPrice ?? 0, currency),
      },
      {
        key: 'state',
        header: t('sales.status'),
        width: '130px',
        render: (row) => {
          const state = stockState(row)
          return <Badge tone={state.tone}>{t(`inventory.${state.key}`)}</Badge>
        },
      },
    ],
    [currency, t]
  )

  const options: readonly FilterOption<StockFilter>[] = [
    { value: 'all', label: t('common.total') },
    { value: 'lowStock', label: t('inventory.lowStock') },
    { value: 'outOfStock', label: t('inventory.outOfStock') },
  ]

  const onExport = useCallback(async () => {
    await exportRows(
      'products.xlsx',
      rows.map((row) => ({
        name: row.name,
        barcode: row.barcode ?? '',
        quantity: row.quantity ?? 0,
        sellPrice: row.sellPrice ?? 0,
      }))
    )
  }, [rows])

  const onImport = useCallback(async () => {
    const imported = await importRows()
    if (imported) setSearch('')
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('inventory.title')}>
        <Input
          ref={searchRef}
          value={search}
          placeholder={`${t('common.search')} / ${t('inventory.barcode')}`}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72"
        />
        <Button size="sm" variant="ghost" onClick={() => void onImport()}>
          <Upload size={14} />
          {t('common.import', { defaultValue: 'Import' })}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void onExport()}>
          <Download size={14} />
          {t('common.export')}
        </Button>
      </PageHeader>

      <FilterTabs options={options} value={filter} onChange={setFilter} />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row, index) => row.id ?? `product-${index}`}
        loading={query.isLoading}
        emptyLabel={t('common.empty')}
      />
    </div>
  )
}
