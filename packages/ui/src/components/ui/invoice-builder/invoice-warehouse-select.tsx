'use client'

// ============================================
// Multi-warehouse (request #90): which warehouse this invoice moves stock in.
//
// Shown only when there is a choice. With one warehouse the server uses it;
// with none, stock moves in no warehouse. With several and nothing picked, the
// form SAYS that no warehouse's stock will change — a silent unattributed sale
// is how warehouse figures drifted before.
// ============================================

import { useEffect } from 'react'
import { useWarehouseOverview } from '@hisabche/api'

import { SelectField } from '../select-field'

export function InvoiceWarehouseSelect({
  t,
  transactionType,
  value,
  onChange,
}: {
  t: (key: string, fallback?: string) => string
  transactionType: 'sale' | 'purchase'
  value: string | null
  onChange: (id: string | null) => void
}) {
  const { data } = useWarehouseOverview()
  const warehouses = (data?.warehouses ?? []).filter((warehouse) => warehouse.isActive)

  // A remembered warehouse that was deleted is not a choice any more.
  useEffect(() => {
    if (value && data && !warehouses.some((warehouse) => warehouse.id === value)) onChange(null)
  }, [value, data, warehouses, onChange])

  if (warehouses.length < 2) return null

  return (
    <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="invoice-warehouse" className="font-medium text-[hsl(var(--fg-primary))]">
          {transactionType === 'purchase'
            ? t('invoiceBuilder.warehouseIn', 'انبار ورود کالا')
            : t('invoiceBuilder.warehouseOut', 'انبار خروج کالا')}
        </label>
        <div className="min-w-44">
          <SelectField
            id="invoice-warehouse"
            value={value ?? ''}
            onChange={(next) => onChange(next || null)}
            placeholder={t('invoiceBuilder.warehouseNone', 'انتخاب انبار')}
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name,
            }))}
          />
        </div>
      </div>
      {!value ? (
        <p className="mt-1.5 text-xs text-[hsl(var(--color-warning))]">
          {t(
            'invoiceBuilder.warehouseMissing',
            'بدون انتخاب انبار، موجودی کل کالا تغییر می‌کند اما موجودی هیچ انباری تغییر نمی‌کند.',
          )}
        </p>
      ) : null}
    </div>
  )
}
