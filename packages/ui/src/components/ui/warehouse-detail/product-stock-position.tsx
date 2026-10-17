'use client'

// ============================================
// «موقعیت در انبار» — where this product's stock sits, one line on the product
// page (owner, 17 October 2026).
//
// The per-warehouse list used to be its own section («موجودی در هر انبار»)
// above the stock history, repeating the total that the cards already show.
// What is worth a line of its own is the PART: which warehouse holds what.
// A negative warehouse is shown NEGATIVE — it is a recorded shortfall, not a
// glitch — and «بدون انبار» appears only when stock really sits nowhere.
// An empty answer is «—», a failed read is its own sentence, never «0».
// ============================================

import type { ReactNode } from 'react'
import { apiErrorMessage, useProductWarehouseBreakdown } from '@hisabche/api'

import { ProductShelfLocations } from './product-shelf-locations'

type T = (key: string, fallback?: string) => string

export function ProductStockPosition({
  t,
  productId,
  fmt,
}: {
  t: T
  productId: string
  /** The page's own number formatting — never re-derived here. */
  fmt: (v: number) => string
}) {
  const breakdown = useProductWarehouseBreakdown(productId)
  const data = breakdown.data

  if (breakdown.isLoading) {
    return (
      <span className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('common.loading', 'در حال بارگذاری…')}
      </span>
    )
  }
  if (breakdown.error) {
    return (
      <span role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
        {apiErrorMessage(breakdown.error, t('warehouse.byWarehouse.loadError'))}
      </span>
    )
  }

  const parts: ReactNode[] = (data?.warehouses ?? []).map((w) => (
    <span key={w.id} className="whitespace-nowrap">
      {w.name}{' '}
      <span
        dir="ltr"
        className={
          w.quantity < 0
            ? 'font-semibold tabular-nums text-[hsl(var(--color-destructive))]'
            : 'font-semibold tabular-nums'
        }
      >
        {fmt(w.quantity)}
      </span>
    </span>
  ))
  if (data && data.unassigned !== 0) {
    parts.push(
      <span key="unassigned" className="whitespace-nowrap text-[hsl(var(--fg-secondary))]">
        {t('warehouse.byWarehouse.unassigned')}{' '}
        <span dir="ltr" className="font-semibold tabular-nums">
          {fmt(data.unassigned)}
        </span>
      </span>,
    )
  }
  if (parts.length === 0) return <span className="text-[hsl(var(--fg-tertiary))]">—</span>
  // A red number alone is not an explanation (§7.5): when a warehouse is
  // below zero, say why in the same place — this line replaced the section
  // that used to carry the sentence.
  const negative = (data?.warehouses ?? []).some((w) => w.quantity < 0)
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">{parts}</span>
      <ProductShelfLocations t={t} productId={productId} fmt={fmt} />
      {negative ? (
        <span className="text-xs text-[hsl(var(--color-destructive))]">
          {t('warehouse.byWarehouse.negativeHelp')}
        </span>
      ) : null}
    </span>
  )
}
