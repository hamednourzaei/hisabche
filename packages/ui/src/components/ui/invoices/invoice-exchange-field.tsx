'use client'

// ============================================
// «تعویض با مدل دیگر» — one select per returned line, inside the ONE return dialog
// (V64 §5.8, V66 §9). It only offers the other models (variants) of the same product;
// the exchange itself is sent by the dialog through `useExchangeInvoice`.
//
// A product with no models offers nothing: the line is then an ordinary return.
// ============================================

import { useProductVariants } from '@hisabche/api'
import { SelectField } from '../select-field'

export interface InvoiceExchangeFieldProps {
  productId: string
  value: string
  onChange: (variantId: string) => void
  disabled: boolean
  tr: (key: string, fallback: string) => string
}

export function InvoiceExchangeField({
  productId,
  value,
  onChange,
  disabled,
  tr,
}: InvoiceExchangeFieldProps) {
  const variants = useProductVariants(productId)
  const active = (variants.data ?? []).filter((variant) => variant.isActive)
  if (active.length === 0) return null

  const labelOf = (attributes: ReadonlyArray<{ name: string; value: string }>, sku: string) =>
    attributes.length > 0 ? attributes.map((a) => a.value).join(' · ') : sku

  return (
    <label className="flex flex-col gap-1 text-xs text-[hsl(var(--fg-secondary))]">
      {tr('exchangeWith', 'تعویض با مدل دیگر')}
      <SelectField
        name="replacementVariantId"
        aria-label={tr('exchangeWith', 'تعویض با مدل دیگر')}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={[
          { value: '', label: tr('exchangeNone', 'بدون تعویض — فقط مرجوعی') },
          ...active.map((variant) => ({
            value: variant.id,
            label: labelOf(variant.attributes, variant.sku),
          })),
        ]}
      />
    </label>
  )
}
