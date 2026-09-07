// packages/ui/src/components/ui/manufacturing/components/CreateWorkOrderDialog.tsx
'use client'

import { SelectField } from '../../select-field'
import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export interface CreateWorkOrderInput {
  productId: string
  quantity: number
  bomId: string
  startDate?: string
  endDate?: string
}

interface ProductOption {
  id: string
  name: string
}

interface BomOption {
  id: string
  productId: string
  version: number
}

interface CreateWorkOrderDialogProps {
  t: (key: string, fallback?: string) => string
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateWorkOrderInput) => void
  isSubmitting: boolean
  products: ProductOption[]
  boms: BomOption[]
}

export const CreateWorkOrderDialog = memo(function CreateWorkOrderDialog({
  t,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  products,
  boms,
}: CreateWorkOrderDialogProps) {
  const [productId, setProductId] = useState('')
  const [bomId, setBomId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (isOpen) {
      setProductId('')
      setBomId('')
      setQuantity('1')
      setStartDate('')
      setEndDate('')
    }
  }, [isOpen])

  const bomsForProduct = useMemo(
    () => (productId ? boms.filter((b) => b.productId === productId) : []),
    [boms, productId],
  )

  useEffect(() => {
    // Reset selected BOM when it no longer belongs to the chosen product
    if (bomId && !bomsForProduct.some((b) => b.id === bomId)) {
      setBomId('')
    }
  }, [bomsForProduct, bomId])

  const canSubmit = !!productId && !!bomId && Number(quantity) > 0

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      onSubmit({
        productId,
        bomId,
        quantity: Number(quantity),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })
    },
    [canSubmit, productId, bomId, quantity, startDate, endDate, onSubmit],
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 md:p-4 bg-black/40"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-work-order-title"
        className={cn(
          'w-full max-w-sm md:max-w-md rounded-xl md:rounded-2xl',
          'bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))]',
          'shadow-2xl shadow-black/20 max-h-[90vh] overflow-y-auto',
        )}
      >
        <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-[hsl(var(--border-default))]">
          <h2
            id="create-work-order-title"
            className="text-sm md:text-base font-semibold text-[hsl(var(--fg-primary))]"
          >
            {t('manufacturing.workOrders.dialogTitle', 'دستور تولید جدید')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
            aria-label={t('action.close', 'بستن')}
          >
            <X className="size-4 md:size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-3 md:space-y-4">
          <div className="space-y-1 md:space-y-1.5">
            <label
              htmlFor="wo-product"
              className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
            >
              {t('manufacturing.workOrders.selectProduct', 'انتخاب محصول')}
            </label>
            <SelectField
              value={productId}
              onChange={(value) => setProductId(value)}
              options={[
                {
                  value: '',
                  label: t(
                    'manufacturing.workOrders.selectProductPlaceholder',
                    '-- انتخاب محصول --',
                  ),
                },
                ...products.map((p) => ({ value: p.id, label: p.name })),
              ]}
              className={
                'w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]'
              }
              id={'wo-product'}
            />
          </div>

          <div className="space-y-1 md:space-y-1.5">
            <label
              htmlFor="wo-bom"
              className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
            >
              {t('manufacturing.workOrders.selectBom', 'انتخاب فرمول ساخت')}
            </label>
            <SelectField
              value={bomId}
              onChange={(value) => setBomId(value)}
              options={[
                {
                  value: '',
                  label: t('manufacturing.workOrders.selectBomPlaceholder', '-- انتخاب فرمول --'),
                },
                ...bomsForProduct.map((b) => ({ value: b.id, label: `v${b.version}` })),
              ]}
              className={
                'w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] disabled:opacity-50'
              }
              disabled={!productId || bomsForProduct.length === 0}
              id={'wo-bom'}
            />
            {productId && bomsForProduct.length === 0 && (
              <p className="text-[11px] text-[hsl(var(--color-destructive))]">
                {t(
                  'manufacturing.workOrders.noBomsForProduct',
                  'برای این محصول فرمول ساختی ثبت نشده',
                )}
              </p>
            )}
          </div>

          <div className="space-y-1 md:space-y-1.5">
            <label
              htmlFor="wo-quantity"
              className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
            >
              {t('manufacturing.workOrders.quantity', 'تعداد')}
            </label>
            <input
              id="wo-quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 md:space-y-1.5">
              <label
                htmlFor="wo-start-date"
                className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
              >
                {t('manufacturing.workOrders.startDate', 'تاریخ شروع')}
              </label>
              <input
                id="wo-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              />
            </div>
            <div className="space-y-1 md:space-y-1.5">
              <label
                htmlFor="wo-end-date"
                className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
              >
                {t('manufacturing.workOrders.endDate', 'تاریخ پایان')}
              </label>
              <input
                id="wo-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              {t('action.cancel', 'انصراف')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium bg-[hsl(var(--color-primary))] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <Loader2 className="size-3.5 md:size-4 animate-spin" aria-hidden="true" />
              )}
              {t('action.create', 'ایجاد')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})
