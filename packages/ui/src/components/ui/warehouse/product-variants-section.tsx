'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/product-variants-section.tsx
//
// Product Variants Section (Option 11 / Variants)
// Reuses DataTable, Dialog, Input, Button, Badge.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useCreateProductVariant, useProductVariants, type ProductVariant } from '@hisabche/api'
import { Plus, Tag } from 'lucide-react'
import { Badge } from '../badge'
import { Button } from '../button'
import { Input } from '../input'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

export const ProductVariantsSection = memo(function ProductVariantsSection({
  productId,
}: {
  productId: string
}) {
  const { data: variants = [] } = useProductVariants(productId)
  const createVariant = useCreateProductVariant(productId)

  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [attrName, setAttrName] = useState('')
  const [attrValue, setAttrValue] = useState('')

  const handleAdd = useCallback(async () => {
    if (!sku.trim()) return
    const attributes =
      attrName.trim() && attrValue.trim()
        ? [{ name: attrName.trim(), value: attrValue.trim() }]
        : []

    await createVariant.mutateAsync({
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      attributes,
    })

    setSku('')
    setBarcode('')
    setAttrName('')
    setAttrValue('')
  }, [sku, barcode, attrName, attrValue, createVariant])

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            تنوع‌های محصول (سایز، رنگ، مدل)
          </h3>
        </div>
        <Badge variant="outline">{(variants as ProductVariant[]).length} تنوع</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Input placeholder="کد کالا (SKU)" value={sku} onChange={(e) => setSku(e.target.value)} />
        <Input
          placeholder="بارکد تنوع (اختیاری)"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <Input
          placeholder="ویژگی (مثلا: سایز)"
          value={attrName}
          onChange={(e) => setAttrName(e.target.value)}
        />
        <Input
          placeholder="مقدار (مثلا: XL)"
          value={attrValue}
          onChange={(e) => setAttrValue(e.target.value)}
        />
      </div>

      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={handleAdd} disabled={!sku.trim() || createVariant.isPending}>
          <Plus className="h-4 w-4 me-1" />
          افزودن تنوع
        </Button>
      </div>

      <div className="space-y-2">
        {(variants as ProductVariant[]).map((v) => (
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
                  بارکد: {v.barcode}
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
