'use client'

import { UnitSelect, toValidUnit } from './units/unit-select'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DollarSign, Package, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { MoneyInput } from './money-input'
import { Label } from './label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { useCreateProduct } from '@hisabche/api'
import { useSyncStore, useBackupStore } from '@hisabche/store'
import { barcodeTakenMessage } from '../../lib/barcode/barcode-errors'

type AddProductModalProps = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  /** Prefilled from a scan the store did not know («unknown barcode → create»). */
  initialBarcode?: string | undefined
}

/**
 * ⚠️ WAS `"piece" | "kg" | "liter" | "meter" | "box"` — FIVE OF FIFTEEN.
 *
 * `units` (phase-l-01) seeds fifteen codes and `unitSchema` accepts all of
 * them. Narrowing to five here did not merely hide options: `toUnitType`
 * coerced everything else to "piece", so a product measured in grams opened
 * as «عدد» and SAVING the form wrote "piece" over the real unit — a silent
 * data change, structurally the T1 currency-to-AFN defect. See T2.
 */
type UnitType = string

type FormData = {
  name: string
  barcode: string
  quantity: number
  buyPrice: number
  sellPrice: number
  unit: UnitType
  minStock: number
}

const UNIT_OPTIONS: { value: UnitType; labelKey: string; fallback: string }[] = [
  { value: 'piece', labelKey: 'warehouse.units.piece', fallback: 'عدد' },
  { value: 'kg', labelKey: 'warehouse.units.kg', fallback: 'کیلوگرم' },
  { value: 'liter', labelKey: 'warehouse.units.liter', fallback: 'لیتر' },
  { value: 'meter', labelKey: 'warehouse.units.meter', fallback: 'متر' },
  { value: 'box', labelKey: 'warehouse.units.box', fallback: 'کارتن' },
]

const inputClass =
  'bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] min-h-[44px]'

export const AddProductModal = memo(function AddProductModal({
  open,
  onClose,
  onCreated,
  initialBarcode,
}: AddProductModalProps) {
  const t = useTranslations()
  const createProduct = useCreateProduct()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    barcode: initialBarcode ?? '',
    quantity: 0,
    buyPrice: 0,
    sellPrice: 0,
    unit: 'piece',
    minStock: 5,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // The modal stays mounted; a scan that opens it later brings its barcode.
  useEffect(() => {
    if (open && initialBarcode) setFormData((prev) => ({ ...prev, barcode: initialBarcode }))
  }, [open, initialBarcode])

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) {
      newErrors.name = t('product.nameRequired')
    }
    if (formData.quantity < 0) {
      newErrors.quantity = t('validation.min')
    }
    if (formData.buyPrice < 0) {
      newErrors.buyPrice = t('validation.min')
    }
    if (formData.sellPrice < 0) {
      newErrors.sellPrice = t('validation.min')
    }
    if (formData.minStock < 0) {
      newErrors.minStock = t('validation.min')
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, t])

  const handleChange = useCallback((field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return

    setIsSubmitting(true)
    setSaveStatus('saving')

    // The picker can display a unit this build does not know (a code added to
    // the `units` table after this deploy). Saving one would push a value the
    // API rejects, so it is refused HERE with a message — not silently turned
    // into 'piece', which is the coercion T2 removed.
    const unit = toValidUnit(formData.unit)
    if (!unit) {
      setErrors((prev) => ({
        ...prev,
        unit: t('warehouse.unitUnknown') || 'این واحد پشتیبانی نمی‌شود',
      }))
      return
    }

    try {
      const product = await createProduct.mutateAsync({
        name: formData.name.trim(),
        barcode: formData.barcode,
        quantity: formData.quantity,
        buyPrice: formData.buyPrice,
        sellPrice: formData.sellPrice,
        unit,
        minStockLevel: formData.minStock,
        category: 'general',
        isActive: true,
      })

      addAuditEntry({
        action: 'create',
        entity: 'product',
        entityId: product.id || '',
        details: `محصول جدید: ${formData.name.trim()}`,
      })

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      setFormData({
        name: '',
        barcode: '',
        quantity: 0,
        buyPrice: 0,
        sellPrice: 0,
        unit: 'piece',
        minStock: 5,
      })
      setErrors({})

      // ✅ FIX: این خط باعث می‌شود که کش در container پاک شود
      onCreated?.()
      onClose()
    } catch (error) {
      console.error('Failed to create product:', error)
      const taken = barcodeTakenMessage(error, t)
      setErrors(taken ? { barcode: taken } : { form: t('common.error') })
      setSaveStatus('idle')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validate, createProduct, setSaveStatus, addAuditEntry, onCreated, onClose, t])

  const handleClose = useCallback(() => {
    setFormData({
      name: '',
      barcode: '',
      quantity: 0,
      buyPrice: 0,
      sellPrice: 0,
      unit: 'piece',
      minStock: 5,
    })
    setErrors({})
    onClose()
  }, [onClose])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        handleClose()
      }
    },
    [handleClose],
  )

  const isPending = isSubmitting || createProduct.isPending

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {isPending && (
          <div className="absolute top-3 end-3 flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>{t('common.saving')}</span>
          </div>
        )}

        <DialogHeader>
          <DialogTitle>{t('warehouse.addProductModal')}</DialogTitle>
          <DialogDescription>{t('warehouse.addProductDescription')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name">
              {t('warehouse.productName')}
              <span className="text-[hsl(var(--color-destructive))] ms-1">*</span>
            </Label>
            <div className="relative">
              <Package className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
              <Input
                id="product-name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('warehouse.productNamePlaceholder')}
                className={inputClass}
                autoFocus
                disabled={isPending}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-[hsl(var(--color-destructive))]">{errors.name}</p>
            )}
          </div>

          {/* Barcode — always a string; a scanner can type straight into it */}
          <div className="space-y-2">
            <Label htmlFor="product-barcode">{t('barcode.label')}</Label>
            <Input
              id="product-barcode"
              name="barcode"
              dir="ltr"
              autoComplete="off"
              value={formData.barcode}
              onChange={(e) => handleChange('barcode', e.target.value)}
              // A scanner ends every code with Enter; here that must not submit
              // the half-filled form.
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder={t('barcode.hint')}
              className={inputClass}
              disabled={isPending}
            />
            {errors.barcode && (
              <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                {errors.barcode}
              </p>
            )}
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-quantity">{t('warehouse.initialStock')}</Label>
              <Input
                id="product-quantity"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', Number(e.target.value))}
                type="number"
                min={0}
                placeholder="0"
                className={inputClass}
                disabled={isPending}
              />
              {errors.quantity && (
                <p className="text-sm text-[hsl(var(--color-destructive))]">{errors.quantity}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-unit">{t('warehouse.unit')}</Label>
              {/* Was five hardcoded units. The list comes from `units` (T2). */}
              <UnitSelect
                value={formData.unit}
                onChange={(unit) => handleChange('unit', unit)}
                disabled={isPending}
                className="w-full min-h-[44px]"
                placeholder={t('warehouse.unit')}
                t={(key, fallback) => t(key) || (fallback ?? key)}
              />
            </div>
          </div>

          {/* Buy Price + Sell Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-buy-price">{t('warehouse.buyPrice')}</Label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
                <MoneyInput
                  id="product-buy-price"
                  value={formData.buyPrice}
                  onChange={(raw) => handleChange('buyPrice', Number(raw))}
                  placeholder="0.00"
                  className={`${inputClass} ps-10`}
                  disabled={isPending}
                />
              </div>
              {errors.buyPrice && (
                <p className="text-sm text-[hsl(var(--color-destructive))]">{errors.buyPrice}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sell-price">{t('warehouse.sellPrice')}</Label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
                <MoneyInput
                  id="product-sell-price"
                  value={formData.sellPrice}
                  onChange={(raw) => handleChange('sellPrice', Number(raw))}
                  placeholder="0.00"
                  className={`${inputClass} ps-10`}
                  disabled={isPending}
                />
              </div>
              {errors.sellPrice && (
                <p className="text-sm text-[hsl(var(--color-destructive))]">{errors.sellPrice}</p>
              )}
            </div>
          </div>

          {/* Min Stock */}
          <div className="space-y-2">
            <Label htmlFor="product-min-stock">{t('warehouse.minStock')}</Label>
            <div className="relative">
              <AlertTriangle className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
              <Input
                id="product-min-stock"
                value={formData.minStock}
                onChange={(e) => handleChange('minStock', Number(e.target.value))}
                type="number"
                min={0}
                placeholder="5"
                className={inputClass}
                disabled={isPending}
              />
            </div>
            {errors.minStock && (
              <p className="text-sm text-[hsl(var(--color-destructive))]">{errors.minStock}</p>
            )}
          </div>

          {/* Form Error */}
          {errors.form && (
            <p className="text-sm text-[hsl(var(--color-destructive))]">{errors.form}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={handleClose}
              disabled={isPending}
            >
              {t('action.cancel')}
            </Button>
            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending && <Loader2 className="size-4 me-2 animate-spin" />}
              {t('action.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
})

AddProductModal.displayName = 'AddProductModal'
