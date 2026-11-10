'use client'

// ============================================
// Which size / colour this line sells (clothing, 10 Nov 2026).
//
// ⚠️ This closes a live defect. The server has refused, since
// variant-binding-01, any line whose product has variants and names none
// (VARIANT_REQUIRED) — and the builder never sent a variant. So once a shop
// added sizes to a T-shirt, that T-shirt could not be sold from the invoice
// form at all. The line now names its variant; the variant's own stock moves
// (variant-stock-01).
//
// Shown only under a picked product that HAS variants; otherwise nothing.
// ============================================

import { useProductVariants } from '@hisabche/api'

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
  onChange,
}: {
  t: Translate
  productId: string
  variantId: string | undefined
  onChange: (variantId: string | undefined) => void
}) {
  const { data } = useProductVariants(productId)
  const variants = (data ?? []) as unknown as VariantRow[]
  if (variants.length === 0) return null

  return (
    <div className="space-y-0.5" data-field="variantId">
      <SelectField
        name="variantId"
        value={variantId ?? ''}
        placeholder={t('variantPicker.pick', 'سایز / رنگ را انتخاب کنید')}
        onChange={(value) => onChange(value || undefined)}
        options={variants.map((variant) => ({ value: variant.id, label: variantLabel(variant) }))}
      />
      {variantId ? null : (
        <p role="alert" className="text-xs text-[hsl(var(--color-warning))]">
          {t('variantPicker.required', 'این کالا چند مدل دارد؛ بدون انتخاب مدل ثبت نمی‌شود.')}
        </p>
      )}
    </div>
  )
}
