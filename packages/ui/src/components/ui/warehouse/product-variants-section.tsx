'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/product-variants-section.tsx
//
// Product Variants Section (Option 11 / Variants)
// Mounted on the product page (warehouse-detail-container) only when the
// business profile carries the `variants` capability.
// Reuses Dialog-free inline form, Input, Button, Badge.
// ============================================

import { memo, useCallback, useState } from 'react'
import {
  apiErrorMessage,
  useCreateProductVariant,
  useProductVariants,
  type ProductVariant,
} from '@hisabche/api'
import { Plus, Tag } from 'lucide-react'
import { Badge } from '../badge'
import { Button } from '../button'
import { Input } from '../input'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

type Translate = (key: string, fallback?: string) => string

const identity: Translate = (_key, fallback) => fallback ?? _key

export const ProductVariantsSection = memo(function ProductVariantsSection({
  productId,
  t = identity,
}: {
  productId: string
  t?: Translate | undefined
}) {
  const { data: variants = [], isError: loadFailed } = useProductVariants(productId)
  const createVariant = useCreateProductVariant(productId)

  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [attrName, setAttrName] = useState('')
  const [attrValue, setAttrValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = useCallback(async () => {
    if (!sku.trim()) return
    const attributes =
      attrName.trim() && attrValue.trim()
        ? [{ name: attrName.trim(), value: attrValue.trim() }]
        : []

    setError(null)
    try {
      await createVariant.mutateAsync({
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
        attributes,
      })
    } catch (cause) {
      setError(apiErrorMessage(cause, t('warehouse.extSaveFailed', 'ثبت انجام نشد')))
      return
    }

    setSku('')
    setBarcode('')
    setAttrName('')
    setAttrValue('')
  }, [sku, barcode, attrName, attrValue, createVariant, t])

  const list = variants as ProductVariant[]

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('warehouse.extVariantsTitle', 'تنوع‌های محصول (سایز، رنگ، مدل)')}
          </h3>
        </div>
        <Badge variant="outline">
          {list.length} {t('warehouse.extVariantsCount', 'تنوع')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Input
          name="sku"
          placeholder={t('warehouse.extSku', 'کد کالا (SKU)')}
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />
        <Input
          name="barcode"
          placeholder={t('warehouse.extVariantBarcode', 'بارکد تنوع (اختیاری)')}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <Input
          name="attrName"
          placeholder={t('warehouse.extAttrName', 'ویژگی (مثلا: سایز)')}
          value={attrName}
          onChange={(e) => setAttrName(e.target.value)}
        />
        <Input
          name="attrValue"
          placeholder={t('warehouse.extAttrValue', 'مقدار (مثلا: XL)')}
          value={attrValue}
          onChange={(e) => setAttrValue(e.target.value)}
        />
      </div>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={handleAdd} disabled={!sku.trim() || createVariant.isPending}>
          <Plus className="h-4 w-4 me-1" />
          {t('warehouse.extAddVariant', 'افزودن تنوع')}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
      {loadFailed ? (
        <p role="alert" className="mb-3 text-xs text-[hsl(var(--color-destructive))]">
          {t('warehouse.extLoadFailed', 'خواندن اطلاعات انجام نشد')}
        </p>
      ) : null}

      <div className="space-y-2">
        {!loadFailed && list.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('warehouse.extVariantsEmpty', 'هنوز تنوعی برای این کالا ثبت نشده است.')}
          </p>
        ) : null}
        {list.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]"
          >
            <div>
              <span className="font-mono text-sm font-medium text-[hsl(var(--fg-primary))]">
                {v.sku}
              </span>
              {v.barcode && (
                <span className="ms-3 text-xs text-[hsl(var(--fg-tertiary))] font-mono">
                  {t('warehouse.extBarcodeLabel', 'بارکد')}: {v.barcode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(v.attributes as Array<{ name: string; value: string }>).map((a, i) => (
                <Badge key={i} variant="secondary">
                  {a.name}: {a.value}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
})
