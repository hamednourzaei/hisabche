// ============================================
// Create invoice — multi-column desktop layout.
// Left: line items with a barcode-driven entry row. Right: customer + totals.
// Ctrl+S saves.
// ============================================

import React, { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { useCreateInvoice, useCustomers, useProducts } from '@hisabche/api'
import type { Customer, Product } from '@hisabche/validation'

import { Button, Card, Input } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/page-header'
import { useBarcodeScanner } from '@/features/inventory/use-barcode-scanner'
import { buildInvoice, lineTotal, subtotalOf, type DraftLine } from '@/features/sales/invoice-draft'
import { useShortcuts } from '@/shared/hooks/use-shortcuts'
import { formatMoney } from '@/shared/lib/currency'
import { useCurrency } from '@/shared/stores/ui.store'

export default function NewInvoicePage() {
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()
  const currency = useCurrency()

  const [lines, setLines] = useState<DraftLine[]>([])
  const [customerId, setCustomerId] = useState<string>('')
  const [productSearch, setProductSearch] = useState('')

  const customers = useCustomers(useMemo(() => ({ page: 1, limit: 200, sortDirection: 'desc' as const }), []))
  const products = useProducts(useMemo(() => ({ page: 1, limit: 50, search: productSearch }), [productSearch]))
  const createInvoice = useCreateInvoice()

  const addProduct = useCallback((product: Product) => {
    setLines((current) => [
      ...current,
      {
        key: `${Date.now()}-${current.length}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.sellPrice ?? 0,
        discount: 0,
      },
    ])
    setProductSearch('')
  }, [])

  // USB scanners type the code then press Enter — resolve it against inventory.
  useBarcodeScanner(
    useCallback(
      (code: string) => {
        const list: Product[] = products.data?.products ?? []
        const match = list.find((product) => product.barcode === code)
        if (match) addProduct(match)
        else setProductSearch(code)
      },
      [addProduct, products.data]
    )
  )

  const subtotal = useMemo(() => subtotalOf(lines), [lines])

  const save = useCallback(async () => {
    if (lines.length === 0) return
    await createInvoice.mutateAsync(buildInvoice(lines, currency, customerId || undefined))
    navigate('/sales')
  }, [createInvoice, currency, customerId, lines, navigate])

  useShortcuts({ save: () => void save() })

  const customerList: Customer[] = customers.data?.customers ?? []
  const productList: Product[] = products.data?.products ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('sales.newInvoice')}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={lines.length === 0 || createInvoice.isPending}
          onClick={() => void save()}
        >
          {t('common.save')}
        </Button>
      </PageHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-4 overflow-hidden p-4">
        <div className="flex min-h-0 flex-col gap-3">
          <Card className="p-3">
            <Input
              autoFocus
              value={productSearch}
              placeholder={`${t('inventory.product')} / ${t('inventory.barcode')}`}
              onChange={(event) => setProductSearch(event.target.value)}
            />

            {productSearch.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto">
                {productList.slice(0, 12).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="flex h-9 w-full items-center gap-3 rounded-[var(--radius-xs)] px-2 text-sm hover:bg-[hsl(var(--surface-muted))]"
                  >
                    <span className="flex-1 truncate text-start">{product.name}</span>
                    <span className="tabular-nums text-[hsl(var(--fg-tertiary))]">
                      {formatMoney(product.sellPrice ?? 0, currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="grid grid-cols-[1fr_90px_130px_130px_36px] gap-3 border-b border-[hsl(var(--border-default))] px-4 py-2 text-[11px] uppercase text-[hsl(var(--fg-tertiary))]">
              <span>{t('inventory.product')}</span>
              <span className="text-end">{t('inventory.stock')}</span>
              <span className="text-end">{t('inventory.price')}</span>
              <span className="text-end">{t('sales.amount')}</span>
              <span />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="grid grid-cols-[1fr_90px_130px_130px_36px] items-center gap-3 border-b border-[hsl(var(--border-default)/0.5)] px-4 py-1.5 text-sm"
                >
                  <span className="truncate">{line.productName}</span>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    className="h-7 text-end"
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item) =>
                          item.key === line.key
                            ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) }
                            : item
                        )
                      )
                    }
                  />
                  <span className="text-end tabular-nums">{formatMoney(line.unitPrice, currency)}</span>
                  <span className="text-end font-medium tabular-nums">
                    {formatMoney(lineTotal(line), currency)}
                  </span>
                  <button
                    type="button"
                    aria-label={t('common.cancel')}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    className="text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--color-destructive))]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <label className="flex flex-col gap-1 text-xs text-[hsl(var(--fg-secondary))]">
              {t('sales.customer')}
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-9 rounded-[var(--radius-sm)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-2 text-sm text-[hsl(var(--fg-primary))] outline-none"
              >
                <option value="">—</option>
                {customerList.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-t border-[hsl(var(--border-strong))] pt-3 text-base font-bold">
              <span>{t('common.total')}</span>
              <span className="tabular-nums">{formatMoney(subtotal, currency)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
