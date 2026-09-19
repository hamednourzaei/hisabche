'use client'

// ============================================
// «افزودن به انبار» (request #94) — a product whose opening stock lands in THIS
// warehouse.
//
// The quantity is sent with the warehouse, so the server records it as a stock
// movement into that warehouse (product.service#create): one row maintains both
// `products.quantity` and `warehouse_stock`, instead of a product total that no
// warehouse accounts for.
//
// ⚠️ THE PRODUCT CODE IS NOT DECORATION.
//
// Two warehouses can hold the same kind of goods, and two products can share a
// name. The code is how a person tells «روغن ۵ لیتری» in one warehouse from the
// same words in another — on this form, in the invoice picker, and in exports.
//
// One minimum-stock field, deliberately: a reorder point beside a minimum is
// two numbers for one decision, and nothing in the app reads a second one.
//
// EXPIRY is off until the switch is turned on, and then it is recorded as a
// BATCH (`stock_batches`, the traceability core the expiry report and the FEFO
// queue already read) — not as a new field on the product. Goods received on
// different days expire on different days; one date on the product could only
// ever be a guess about the next delivery.
// ============================================

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreateProduct, useCreateUnit, useReceiveBatch, useUnits } from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'
import { UnitSelect, toValidUnit } from '../units/unit-select'
import { SelectField } from '../select-field'
import { JalaliDatePicker } from '../jalali-datepicker'
import { Switch } from '../switch'

type T = (key: string, fallback?: string) => string

const field =
  'min-h-11 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]'
const primary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50'
const quiet =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-[hsl(var(--border-default))] px-4 text-sm text-[hsl(var(--fg-secondary))]'

/**
 * A workspace's own unit measures something, and the app must know how much.
 * «۱ مثقال = ۴٫۶۸۷۵ گرم» → dimension 'weight', factor 4.6875. The base of each
 * dimension is fixed for everyone (gram, metre, litre, piece), which is why a
 * workspace unit is a row in `custom_units` and never in `units`.
 */
const DIMENSIONS = [
  { value: 'count', labelKey: 'warehouse.dimCount', fallback: 'تعداد (پایه: عدد)' },
  { value: 'weight', labelKey: 'warehouse.dimWeight', fallback: 'وزن (پایه: گرم)' },
  { value: 'length', labelKey: 'warehouse.dimLength', fallback: 'طول (پایه: متر)' },
  { value: 'volume', labelKey: 'warehouse.dimVolume', fallback: 'حجم (پایه: لیتر)' },
] as const

const blankUnit = {
  name: '',
  dimension: 'count' as (typeof DIMENSIONS)[number]['value'],
  factor: '1',
}

const blank = {
  name: '',
  sku: '',
  unit: 'piece',
  quantity: '',
  buyPrice: '',
  sellPrice: '',
  minStock: '5',
  expiryDate: '',
}

export function AddToWarehouseModal({
  t,
  open,
  onClose,
  warehouseId,
  warehouseName,
  onCreated,
}: {
  t: T
  open: boolean
  onClose: () => void
  /** The warehouse the opening stock goes into. */
  warehouseId: string
  warehouseName: string
  onCreated: () => void
}) {
  const [form, setForm] = useState(blank)
  const [error, setError] = useState<string | null>(null)
  const [newUnit, setNewUnit] = useState<typeof blankUnit | null>(null)
  const [hasExpiry, setHasExpiry] = useState(false)
  const createProduct = useCreateProduct()
  const createUnit = useCreateUnit()
  const { data: unitData } = useUnits()
  const receiveBatch = useReceiveBatch()

  useEffect(() => {
    if (open) {
      setForm(blank)
      setError(null)
      setNewUnit(null)
      setHasExpiry(false)
    }
  }, [open])

  const set = (key: keyof typeof blank, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const number = (value: string) => (value.trim() === '' ? 0 : Number(value))
  const valid =
    form.name.trim() !== '' &&
    [form.quantity, form.buyPrice, form.sellPrice, form.minStock].every(
      (value) => value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) >= 0),
    )

  const failed = (err: unknown) => {
    const code = (err as { response?: { data?: { code?: string; error?: string } } })?.response
      ?.data
    if (code?.code === 'UNIT_CUSTOM_MIGRATION_REQUIRED') {
      return t(
        'warehouse.unitMigrationRequired',
        'افزودن واحد دلخواه هنوز در پایگاه داده فعال نشده.',
      )
    }
    return t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.')
  }

  /** A unit the seeded list does not have is this workspace's own. */
  const chosenUnit = (unitData?.units ?? []).find((unit) => unit.code === form.unit)
  const isWorkspaceUnit = !!chosenUnit && toValidUnit(chosenUnit.code) === null

  const addUnit = async () => {
    const name = (newUnit?.name ?? '').trim()
    const factor = Number(newUnit?.factor)
    if (!name || !Number.isFinite(factor) || factor <= 0) {
      setError(t('warehouse.unitFactorInvalid', 'نام و ضریب تبدیل واحد را درست وارد کنید.'))
      return
    }
    try {
      const unit = await createUnit.mutateAsync({
        name,
        dimension: newUnit!.dimension,
        conversionFactor: factor,
      })
      set('unit', unit.code)
      setNewUnit(null)
      setError(null)
    } catch (err) {
      setError(failed(err))
    }
  }

  const submit = async () => {
    // A seeded unit goes through as itself. A workspace unit is stored the way
    // the schema already models one: `unit: 'custom'` plus the word in
    // `unitLabel` — the same shape invoice lines use. Anything else (a code
    // from neither list) is refused rather than silently saved as «عدد».
    const seeded = toValidUnit(form.unit)
    const unit = seeded ?? (isWorkspaceUnit ? ('custom' as const) : null)
    if (!unit) {
      setError(t('warehouse.unitUnknown', 'این واحد پشتیبانی نمی‌شود'))
      return
    }
    if (hasExpiry && !form.expiryDate) {
      setError(t('warehouse.expiryRequired', 'تاریخ انقضا را انتخاب کنید یا سوییچ را خاموش کنید.'))
      return
    }
    try {
      const product = await createProduct.mutateAsync({
        name: form.name.trim(),
        sku: form.sku.trim(),
        unit,
        ...(seeded ? {} : { unitLabel: chosenUnit?.nameFa ?? chosenUnit?.name ?? '' }),
        quantity: number(form.quantity),
        buyPrice: number(form.buyPrice),
        sellPrice: number(form.sellPrice),
        minStockLevel: number(form.minStock),
        category: 'general',
        isActive: true,
        warehouseId,
      })

      // The expiry belongs to THESE goods, so it is recorded as the batch this
      // opening stock is. Refused here rather than silently dropped: a product
      // saved with the expiry missing is how food goes out of date unnoticed.
      if (hasExpiry && product?.id) {
        await receiveBatch.mutateAsync({
          productId: product.id,
          // toIsoDay: the LOCAL calendar day. toISOString() is UTC, which in
          // Kabul (+4:30) is still yesterday at local midnight.
          batchNumber: `OPEN-${toIsoDay(new Date())}`,
          quantity: number(form.quantity),
          expiryDate: form.expiryDate,
          warehouseId,
        })
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(failed(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('warehouse.addToWarehouse', 'افزودن به انبار')}: {warehouseName}
          </DialogTitle>
          <DialogDescription>
            {t(
              'warehouse.addToWarehouseHint',
              'کالا ساخته می‌شود و موجودی اولیه‌اش در همین انبار ثبت می‌شود.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[hsl(var(--fg-secondary))]">{t('warehouse.name', 'نام')}</span>
            <input
              id="wh-product-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={field}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.productCode', 'کد جنس')}
            </span>
            <input
              id="wh-product-sku"
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              dir="ltr"
              placeholder={t('warehouse.productCodeHint', 'برای تشخیص کالاهای هم‌نام')}
              className={field}
            />
          </label>

          <div className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">{t('warehouse.unit', 'واحد')}</span>
            {newUnit === null ? (
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <UnitSelect t={t} value={form.unit} onChange={(next) => set('unit', next)} />
                </div>
                <button
                  type="button"
                  onClick={() => setNewUnit(blankUnit)}
                  aria-label={t('warehouse.addUnit', 'افزودن واحد دلخواه')}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--border-default))] text-[hsl(var(--color-primary))]"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-[hsl(var(--border-default))] p-2">
                <input
                  id="wh-new-unit"
                  autoFocus
                  value={newUnit.name}
                  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                  placeholder={t('warehouse.newUnitPlaceholder', 'مثلاً مثقال')}
                  className={field}
                />
                <SelectField
                  id="wh-new-unit-dimension"
                  value={newUnit.dimension}
                  onChange={(next) =>
                    setNewUnit({ ...newUnit, dimension: next as typeof newUnit.dimension })
                  }
                  options={DIMENSIONS.map((dimension) => ({
                    value: dimension.value,
                    label: t(dimension.labelKey, dimension.fallback),
                  }))}
                />
                {/* The conversion is what makes the unit usable in a total. */}
                <label className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 text-[hsl(var(--fg-secondary))]">
                    {t('warehouse.unitFactor', 'هر ۱ واحد برابر است با')}
                  </span>
                  <input
                    id="wh-new-unit-factor"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    dir="ltr"
                    value={newUnit.factor}
                    onChange={(e) => setNewUnit({ ...newUnit, factor: e.target.value })}
                    className={field}
                  />
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void addUnit()}
                    disabled={createUnit.isPending || newUnit.name.trim() === ''}
                    className={quiet}
                  >
                    {t('common.save', 'ذخیره')}
                  </button>
                  <button type="button" onClick={() => setNewUnit(null)} className={quiet}>
                    {t('common.cancel', 'انصراف')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.quantity', 'موجودی')}
            </span>
            <input
              id="wh-product-quantity"
              type="number"
              min={0}
              inputMode="decimal"
              dir="ltr"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              className={field}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.minStock', 'حداقل موجودی')}
            </span>
            <input
              id="wh-product-min"
              type="number"
              min={0}
              inputMode="decimal"
              dir="ltr"
              value={form.minStock}
              onChange={(e) => set('minStock', e.target.value)}
              className={field}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.buyPrice', 'قیمت خرید')}
            </span>
            <input
              id="wh-product-buy"
              type="number"
              min={0}
              inputMode="decimal"
              dir="ltr"
              value={form.buyPrice}
              onChange={(e) => set('buyPrice', e.target.value)}
              className={field}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.sellPrice', 'قیمت فروش')}
            </span>
            <input
              id="wh-product-sell"
              type="number"
              min={0}
              inputMode="decimal"
              dir="ltr"
              value={form.sellPrice}
              onChange={(e) => set('sellPrice', e.target.value)}
              className={field}
            />
          </label>
        </div>

        <div className="mt-1 space-y-2 rounded-lg border border-[hsl(var(--border-default))] p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[hsl(var(--fg-primary))]">
              {t('warehouse.hasExpiry', 'تاریخ انقضا دارد')}
            </span>
            <Switch
              id="wh-product-has-expiry"
              checked={hasExpiry}
              onCheckedChange={(next) => {
                setHasExpiry(next)
                if (!next) set('expiryDate', '')
              }}
            />
          </label>
          {hasExpiry ? (
            <div className="space-y-1 text-sm">
              <label htmlFor="wh-product-expiry" className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.expiryDate', 'تاریخ انقضا')}
              </label>
              <JalaliDatePicker
                value={form.expiryDate}
                onChange={(next) => set('expiryDate', next)}
                placeholder={t('warehouse.expiryDate', 'تاریخ انقضا')}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-2 text-sm text-[hsl(var(--color-destructive))]">
            {error}
          </p>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || createProduct.isPending || receiveBatch.isPending}
            className={primary}
          >
            {t('warehouse.addToWarehouse', 'افزودن به انبار')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
