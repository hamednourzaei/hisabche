'use client'

// ============================================
// Which warehouse this invoice moves stock in.
//
// The choices are the warehouses THIS person may use (their branches decide
// that on the server), narrowed to the invoice's branch when one is chosen.
//
// «تمام انبارها» is a way of LOOKING, not a place goods leave from: the product
// list then shows every warehouse's stock, and the first product picked sets
// the invoice's warehouse to the one it was picked from. An invoice still
// leaves one warehouse — which is why the hint under the select says so.
// ============================================

import { useEffect } from 'react'
import { useStockPlacement } from '@hisabche/api'

import { warehousesForBranch } from '../../../lib/invoices/picker-rows'
import { SelectField } from '../select-field'

/** The select's value for «all warehouses». Never sent as an id. */
const ALL_WAREHOUSES = 'all'

export function InvoiceWarehouseSelect({
  t,
  transactionType,
  branchId,
  value,
  onChange,
}: {
  t: (key: string, fallback?: string) => string
  transactionType: 'sale' | 'purchase'
  /** The invoice's branch. Null = the whole business. */
  branchId: string | null
  value: string | null
  onChange: (id: string | null) => void
}) {
  const { data } = useStockPlacement()
  const warehouses = warehousesForBranch(data, branchId)

  // A remembered warehouse that was deleted, that this person may not use, or
  // that is not in the chosen branch is not a choice any more.
  useEffect(() => {
    if (!data) return
    if (value && !warehouses.some((warehouse) => warehouse.id === value)) onChange(null)
    else if (!value && warehouses.length === 1) onChange(warehouses[0]!.id)
  }, [value, data, warehouses, onChange])

  // A business with no warehouse at all has nothing to choose.
  if (!data || (data.warehouses.length === 0 && !data.restricted)) return null

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
            value={value ?? ALL_WAREHOUSES}
            onChange={(next) => onChange(next === ALL_WAREHOUSES ? null : next)}
            options={[
              // With one warehouse there is nothing to look across.
              ...(warehouses.length > 1
                ? [
                    {
                      value: ALL_WAREHOUSES,
                      label: t('invoiceBuilder.warehouseAll', 'تمام انبارها'),
                    },
                  ]
                : []),
              ...warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.branchName
                  ? `${warehouse.name} · ${warehouse.branchName}`
                  : warehouse.name,
              })),
            ]}
          />
        </div>
      </div>
      {warehouses.length === 0 ? (
        <p className="mt-1.5 text-xs text-[hsl(var(--color-warning))]" data-warehouse-none>
          {data.restricted
            ? t(
                'invoiceBuilder.warehouseNoneAllowed',
                'هیچ انباری در شعبه‌های شما (یا شعبه‌ی انتخاب‌شده) نیست. از مدیر بخواهید انبار را به شعبه‌ی شما وصل کند.',
              )
            : t('invoiceBuilder.warehouseNoneInBranch', 'این شعبه انباری ندارد.')}
        </p>
      ) : !value ? (
        <p className="mt-1.5 text-xs text-[hsl(var(--fg-secondary))]" data-warehouse-all>
          {transactionType === 'purchase'
            ? t(
                'invoiceBuilder.warehouseMissing',
                'بدون انتخاب انبار، موجودی کل کالا تغییر می‌کند اما موجودی هیچ انباری تغییر نمی‌کند.',
              )
            : t(
                'invoiceBuilder.warehouseAllHint',
                'موجودی همه‌ی انبارها نشان داده می‌شود. با انتخاب اولین کالا، انبارِ همان کالا انبار این فاکتور می‌شود.',
              )}
        </p>
      ) : null}
    </div>
  )
}
