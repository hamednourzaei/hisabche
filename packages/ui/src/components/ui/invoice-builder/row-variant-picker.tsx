'use client'

// ============================================
// Which size / colour this line sells (clothing, 10 Nov 2026 / V59.1 ATP).
//
// Shows live Available-To-Promise (ATP = onHand - active unexpired holds)
// per variant using the shared checkVariantAtpAvailability rule.
// Shown only under a picked product that HAS variants; otherwise nothing.
// ============================================

import { useMemo } from 'react'
import { useProductVariants, useVariantStock } from '@hisabche/api'
import { checkVariantAtpAvailability } from '@hisabche/validation'

import { SelectField } from '../select-field'

type Translate = (key: string, fallback?: string) => string

interface VariantRow {
  id: string
  sku: string
  attributes?: Array<{ name: string; value: string }> | null
}

/** «L · مشکی» — the values, in the order the variant was made; the SKU when it has none. */
export function variantLabel(variant: VariantRow): string {
  const values = (variant.attributes ?? []).map((a) => a.value).filter(Boolean)
  return values.length > 0 ? values.join(' · ') : variant.sku
}

export function RowVariantPicker({
  t,
  productId,
  variantId,
  warehouseId,
  quantity = 1,
  onChange,
}: {
  t: Translate
  productId: string
  variantId: string | undefined
  warehouseId?: string | null | undefined
  quantity?: number | undefined
  onChange: (variantId: string | undefined) => void
}) {
  const { data } = useProductVariants(productId)
  const stockQuery = useVariantStock(productId)
  const variants = (data ?? []) as unknown as VariantRow[]

  const stockRows = useMemo(
    () =>
      (stockQuery.data?.variants ?? []).flatMap((v) =>
        v.byWarehouse.map((w) => ({
          variantId: v.variantId,
          warehouseId: w.warehouseId ?? 'default',
          quantity: w.quantity,
        })),
      ),
    [stockQuery.data?.variants],
  )
  const activeReservations = stockQuery.data?.reservations ?? []

  if (variants.length === 0) return null

  const atpIssue =
    variantId && stockQuery.data?.ready
      ? checkVariantAtpAvailability({
          demands: [
            {
              variantId,
              warehouseId:
                warehouseId ??
                stockRows.find((r) => r.variantId === variantId)?.warehouseId ??
                'default',
              quantity: Math.max(1, quantity),
            },
          ],
          stock: stockRows,
          activeReservations,
        })
      : null

  return (
    <div className="space-y-0.5" data-field="variantId">
      <SelectField
        name="variantId"
        value={variantId ?? ''}
        placeholder={t('variantPicker.pick', 'سایز / رنگ را انتخاب کنید')}
        onChange={(value) => onChange(value || undefined)}
        options={variants.map((variant) => {
          const line = stockQuery.data?.variants.find((v) => v.variantId === variant.id)
          const reserved = activeReservations
            .filter((r) => r.variantId === variant.id && r.status === 'active')
            .reduce((sum, r) => sum + r.quantity, 0)
          const atp = line ? Math.max(0, line.onHand - reserved) : null
          return {
            value: variant.id,
            label:
              atp !== null
                ? `${variantLabel(variant)} (${t('variantStock.atpShort', 'قابل فروش')}: ${atp})`
                : variantLabel(variant),
          }
        })}
      />
      {!variantId ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-warning))]">
          {t('variantPicker.required', 'این کالا چند مدل دارد؛ بدون انتخاب مدل ثبت نمی‌شود.')}
        </p>
      ) : atpIssue ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('variantPicker.atpShort', 'موجودی قابل فروش (ATP) برای این مدل کافی نیست.')}
        </p>
      ) : null}
    </div>
  )
}
