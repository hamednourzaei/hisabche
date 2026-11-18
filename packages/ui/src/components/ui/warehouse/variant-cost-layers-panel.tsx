'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/variant-cost-layers-panel.tsx
//
// WP-01 — the strict costing rule left a gap on purpose: stock that was bought
// before cost layers knew about variants sits in layers with `variant_id = NULL`
// and cannot pay for a variant sale. This panel is where a person says which
// variant that stock actually is. It shows only the open, unassigned layers and
// assigns one at a time; the server refuses a closed layer or one already
// assigned to another variant.
// ============================================

import { useState } from 'react'
import { useLocale } from 'next-intl'
import {
  apiErrorMessage,
  useAssignLayerVariant,
  useCostLayers,
  type ProductCostLayer,
  type ProductVariant,
} from '@hisabche/api'
import {
  formatMoney,
  resolveIntlLocale,
  type KnownCurrency,
  type UiLanguage,
} from '@hisabche/formatting'
import { Button } from '../button'
import { SelectField } from '../select-field'
import { useBookCurrency } from '../../../hooks/use-book-currency'

type Translate = (key: string, fallback?: string) => string

const identity: Translate = (_key, fallback) => fallback ?? _key

function variantLabel(variant: ProductVariant): string {
  const attributes = Array.isArray(variant.attributes)
    ? (variant.attributes as Array<{ name: string; value: string }>)
    : []
  const text = attributes.map((a) => a.value).join(' · ')
  return text || variant.sku
}

function AssignRow({
  layer,
  variants,
  t,
  money,
  onAssign,
  busy,
}: {
  layer: ProductCostLayer
  variants: ProductVariant[]
  t: Translate
  money: (value: number) => string
  onAssign: (variantId: string) => Promise<void>
  busy: boolean
}) {
  const [variantId, setVariantId] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[hsl(var(--fg-secondary))] tabular-nums">
          <span className="me-3">
            {t('warehouse.extLayerQty', 'مقدار')}: {layer.remainingQty}
          </span>
          <span className="me-3">
            {t('warehouse.extLayerUnitCost', 'بهای واحد')}: {money(layer.unitCost)}
          </span>
          <span className="me-3">
            {t('warehouse.extLayerValue', 'ارزش')}: {money(layer.remainingQty * layer.unitCost)}
          </span>
          <span>
            {t('warehouse.extLayerDate', 'تاریخ ورود')}: {layer.entryDate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SelectField
            name={`assign-variant-${layer.id}`}
            value={variantId}
            onChange={setVariantId}
            placeholder={t('warehouse.extAssignTo', 'تخصیص به تنوع')}
            options={variants.map((variant) => ({
              value: variant.id,
              label: variantLabel(variant),
            }))}
          />
          <Button
            size="sm"
            disabled={!variantId || busy}
            onClick={async () => {
              setError(null)
              try {
                await onAssign(variantId)
              } catch (cause) {
                setError(apiErrorMessage(cause, t('warehouse.extAssignFailed', 'تخصیص انجام نشد')))
              }
            }}
          >
            {t('warehouse.extAssignAction', 'تخصیص')}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function VariantCostLayersPanel({
  productId,
  variants,
  t = identity,
}: {
  productId: string
  variants: ProductVariant[]
  t?: Translate | undefined
}) {
  const unassigned = useCostLayers(productId, null, variants.length > 0)
  const assign = useAssignLayerVariant(productId)
  const bookCurrency = useBookCurrency()
  const locale = resolveIntlLocale(useLocale() as UiLanguage)

  const money = (value: number) =>
    bookCurrency ? formatMoney(value, bookCurrency as KnownCurrency, locale) : '—'

  if (variants.length === 0) return null

  const layers = unassigned.data?.layers ?? []

  return (
    <section className="mt-4 border-t border-[hsl(var(--border-default))] pt-4">
      <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('warehouse.extCostLayersTitle', 'لایه‌های بهای تمام‌شده')}
      </h4>
      <p className="mt-1 mb-3 text-xs text-[hsl(var(--fg-tertiary))]">
        {t(
          'warehouse.extCostLayersHint',
          'هر فروش فقط از لایه‌های همان تنوع مصرف می‌کند. موجودی قدیمی که تنوع ندارد تا تخصیص داده نشود برای فروش تنوع‌دار قابل استفاده نیست.',
        )}
      </p>

      {unassigned.isError ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('warehouse.extCostLoadFailed', 'خواندن لایه‌های بها انجام نشد')}
        </p>
      ) : null}

      {!unassigned.isError && unassigned.isPending ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('warehouse.extCostLoading', 'در حال خواندن…')}
        </p>
      ) : null}

      {!unassigned.isError && !unassigned.isPending && layers.length === 0 ? (
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">
          {t('warehouse.extUnassignedEmpty', 'موجودی بدون تنوعی باقی نمانده است.')}
        </p>
      ) : null}

      <div className="space-y-2">
        {layers.map((layer) => (
          <AssignRow
            key={layer.id}
            layer={layer}
            variants={variants}
            t={t}
            money={money}
            busy={assign.isPending}
            onAssign={async (variantId) => {
              await assign.mutateAsync({ layerId: layer.id, variantId })
            }}
          />
        ))}
      </div>
    </section>
  )
}
