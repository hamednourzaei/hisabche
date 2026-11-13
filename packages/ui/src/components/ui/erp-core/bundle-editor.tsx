'use client'
// ============================================
// «بسته (کیت)» — the components of a bundle product (V61 B.2.8), on the
// product's own page.
//
// ⚠️ The whole list is saved at once, in one database transaction
// (`product_bundle_set_items`): every component must be this business's own
// product, not the bundle itself and not another bundle. Saving an empty list
// makes the product a standard one again.
// ⚠️ Recording the components does NOT yet change what a SALE of the bundle
// does to stock: selling a bundle still moves the bundle's own stock. The
// screen says so — the expansion rule exists (`expandBundleStockAndCost`) but
// is not wired into the invoice (reported, V61-IMPLEMENTATION-PROGRESS.md).
// ============================================
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useBundleItems, useSaveBundleItems } from '@hisabche/api'

import { Button } from '../button'
import { Input } from '../input'
import { useToast } from '../toast-provider'
import { LabeledSelect, useProductOptions } from '../business-packs/pack-shared'
import { QueryState, refusalText } from './erp-shared'

export const BUNDLE_ERROR_CODES = [
  'BUNDLE_COMPONENT_IS_SELF',
  'BUNDLE_COMPONENT_DUPLICATE',
  'BUNDLE_COMPONENT_NOT_FOUND',
  'BUNDLE_COMPONENT_IS_BUNDLE',
  'BUNDLE_PRODUCT_IS_COMPONENT',
  'BUNDLE_ITEM_INVALID',
  'BUNDLE_SAVE_NOT_INSTALLED',
] as const

interface DraftComponent {
  productId: string
  quantity: string
}

export function BundleEditor({ productId }: { productId: string }) {
  const t = useTranslations('erpCore.bundle')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const toast = useToast()
  const products = useProductOptions('goods').filter((p) => p.value !== productId)
  const items = useBundleItems(productId)
  const save = useSaveBundleItems()
  const [draft, setDraft] = useState<DraftComponent[] | null>(null)

  // The saved list until the person changes something; their draft after that.
  const saved: DraftComponent[] = (items.data ?? []).map((item) => ({
    productId: item.component_product_id,
    quantity: String(Number(item.quantity)),
  }))
  const rows = draft ?? saved
  const setRow = (index: number, patch: Partial<DraftComponent>) =>
    setDraft(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const submit = () => {
    const parsed = rows.map((row) => ({
      component_product_id: row.productId,
      quantity: Number(row.quantity),
    }))
    if (parsed.some((row) => !row.component_product_id || !(row.quantity > 0))) {
      toast.error(tr('errors.incomplete'))
      return
    }
    save.mutate(
      { productId, items: parsed },
      {
        onSuccess: () => {
          setDraft(null)
          toast.success(parsed.length > 0 ? tr('saved') : tr('cleared'))
        },
        onError: (e) => toast.error(refusalText(e, BUNDLE_ERROR_CODES, tr)),
      },
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5">
      <h3 className="text-sm font-semibold">{tr('title')}</h3>
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <QueryState
        isLoading={items.isLoading}
        isError={items.isError}
        onRetry={() => void items.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        {rows.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('empty')}</p>
        ) : null}
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <LabeledSelect
              name={`items.${index}.component_product_id`}
              label={tr('component')}
              value={row.productId}
              onChange={(value) => setRow(index, { productId: value })}
              options={products}
            />
            <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
              {tr('quantity')}
              <Input
                name={`items.${index}.quantity`}
                inputMode="decimal"
                value={row.quantity}
                onChange={(e) => setRow(index, { quantity: e.target.value })}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft(rows.filter((_, i) => i !== index))}
            >
              {tr('remove')}
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDraft([...rows, { productId: '', quantity: '1' }])}
          >
            {tr('add')}
          </Button>
          <Button size="sm" disabled={save.isPending || !items.data} onClick={submit}>
            {tr('save')}
          </Button>
        </div>
      </QueryState>
    </section>
  )
}
