'use client'

// ============================================
// Multi-warehouse (request #90) — «افزودن انبار» and «افزودن کالا به انبار».
//
// Assigning takes stock that is in NO warehouse and puts it into this one; the
// product total does not change (warehouse.service#assignStock). New stock
// arrives through a purchase invoice that names the warehouse — one path for
// goods coming in, not a second one here.
// ============================================

import { useEffect, useState } from 'react'
import type { WarehouseProduct } from '@hisabche/api'

import { SelectField } from '../select-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'

type T = (key: string, fallback?: string) => string

const input =
  'min-h-10 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]'
const primary =
  'inline-flex min-h-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50'
const quiet =
  'inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border-default))] px-4 text-sm text-[hsl(var(--fg-secondary))]'

const errorText = (t: T, err: unknown) => {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? ''
  return code === 'WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED'
    ? t('warehouse.assignExceeds', 'این مقدار بیشتر از موجودی بدون انبار این کالاست')
    : t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.')
}

export function AddWarehouseDialog({
  t,
  open,
  onClose,
  onCreate,
  isPending,
  initial,
}: {
  t: T
  open: boolean
  onClose: () => void
  onCreate: (input: { name: string; location: string }) => Promise<unknown>
  isPending: boolean
  /** Set when editing an existing warehouse: the form starts from its values. */
  initial?: { name: string; location: string } | null | undefined
}) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setLocation(initial?.location ?? '')
      setError(null)
    }
  }, [open, initial])

  const submit = async () => {
    try {
      await onCreate({ name: name.trim(), location: location.trim() })
      onClose()
    } catch (err) {
      setError(errorText(t, err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? t('warehouse.editWarehouse', 'ویرایش انبار')
              : t('warehouse.addWarehouse', 'افزودن انبار')}
          </DialogTitle>
          <DialogDescription>
            {t('warehouse.addWarehouseHint', 'نام انبار یا شعبه‌ای که کالا در آن نگهداری می‌شود.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.warehouseName', 'انبار')}
            </span>
            <input
              id="warehouse-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.location', 'محل')}
            </span>
            <input
              id="warehouse-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={input}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || name.trim() === ''}
            className={primary}
          >
            {t('common.save', 'ذخیره')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssignStockDialog({
  t,
  fmt,
  open,
  onClose,
  warehouseName,
  unassigned,
  isLoadingUnassigned,
  onAssign,
  isPending,
}: {
  t: T
  fmt: (v: number) => string
  open: boolean
  onClose: () => void
  warehouseName: string
  /** Products with stock in no warehouse, and how much of each. */
  unassigned: WarehouseProduct[]
  isLoadingUnassigned: boolean
  onAssign: (input: { productId: string; quantity: number }) => Promise<unknown>
  isPending: boolean
}) {
  const available = unassigned.filter((product) => product.quantity > 0)
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setProductId('')
      setQuantity('')
      setError(null)
    }
  }, [open])

  const selected = available.find((product) => product.id === productId)
  const amount = Number(quantity)
  const valid = !!selected && Number.isFinite(amount) && amount > 0 && amount <= selected.quantity

  const submit = async () => {
    if (!selected) return
    try {
      await onAssign({ productId: selected.id, quantity: amount })
      onClose()
    } catch (err) {
      setError(errorText(t, err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('warehouse.assignTitle', 'افزودن کالا به انبار')}: {warehouseName}
          </DialogTitle>
          <DialogDescription>
            {t(
              'warehouse.assignHint',
              'موجودی‌ای که در هیچ انباری نیست به این انبار منتقل می‌شود؛ کل موجودی کالا تغییر نمی‌کند. کالای تازه را با فاکتور خرید همین انبار ثبت کنید.',
            )}
          </DialogDescription>
        </DialogHeader>
        {isLoadingUnassigned ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('common.loading', 'در حال بارگذاری…')}
          </p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('warehouse.nothingUnassigned', 'موجودی بدون انبار وجود ندارد.')}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1 text-sm">
              <label htmlFor="warehouse-assign-product" className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.name', 'نام')}
              </label>
              <SelectField
                id="warehouse-assign-product"
                value={productId}
                onChange={setProductId}
                placeholder={t('warehouse.chooseProduct', 'انتخاب کالا')}
                options={available.map((product) => ({
                  value: product.id,
                  label: `${product.name} — ${fmt(product.quantity)} ${product.unit}`,
                }))}
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.quantity', 'مقدار')}
              </span>
              <input
                id="warehouse-assign-quantity"
                type="number"
                min={0}
                max={selected?.quantity}
                inputMode="decimal"
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={input}
              />
            </label>
            {selected ? (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouse.assignMax', 'حداکثر')}: {fmt(selected.quantity)} {selected.unit}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {error}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || !valid}
            className={primary}
          >
            {t('warehouse.assignAction', 'افزودن به انبار')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * «انتقال موجودی» — move a quantity of one product from the open warehouse to
 * another. The product total does not change; the server moves both sides in
 * one transaction and refuses more than the source holds.
 *
 * The quantity is in the product's own unit, shown beside the field — the same
 * unit the warehouse counts it in.
 */
export function TransferStockDialog({
  t,
  fmt,
  open,
  onClose,
  warehouseName,
  products,
  targets,
  onTransfer,
  isPending,
}: {
  t: T
  fmt: (v: number) => string
  open: boolean
  onClose: () => void
  /** The source: the warehouse that is open. */
  warehouseName: string
  /** What the source holds. */
  products: WarehouseProduct[]
  /** Every OTHER live warehouse. */
  targets: Array<{ id: string; name: string }>
  onTransfer: (input: {
    productId: string
    toWarehouseId: string
    quantity: number
    notes?: string | undefined
    idempotencyKey: string
  }) => Promise<unknown>
  isPending: boolean
}) {
  const available = products.filter((product) => product.quantity > 0)
  const [productId, setProductId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  // One key per opening of the dialog: pressing «انتقال» twice, or a retry after
  // a lost answer, is the same movement.
  const [requestKey, setRequestKey] = useState('')

  useEffect(() => {
    if (open) {
      setProductId('')
      setTargetId('')
      setQuantity('')
      setNotes('')
      setError(null)
      setRequestKey(crypto.randomUUID())
    }
  }, [open])

  const selected = available.find((product) => product.id === productId)
  const amount = Number(quantity)
  const valid =
    !!selected && !!targetId && Number.isFinite(amount) && amount > 0 && amount <= selected.quantity

  const submit = async () => {
    if (!selected || !targetId) return
    setError(null)
    try {
      await onTransfer({
        productId: selected.id,
        toWarehouseId: targetId,
        quantity: amount,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        idempotencyKey: requestKey,
      })
      onClose()
    } catch (err) {
      const body = (err as { response?: { data?: { code?: string; error?: string } } })?.response
        ?.data
      const code = `${body?.code ?? ''} ${body?.error ?? ''}`
      setError(
        code.includes('WAREHOUSE_INSUFFICIENT_STOCK')
          ? t(
              'warehouse.transferInsufficient',
              'این مقدار بیشتر از موجودی این کالا در انبار مبدأ است.',
            )
          : t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.'),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-md" data-transfer-stock="">
        <DialogHeader>
          <DialogTitle>
            {t('warehouse.transferStock', 'انتقال موجودی')}: {warehouseName}
          </DialogTitle>
          <DialogDescription>
            {t(
              'warehouse.transferHint',
              'کالا از این انبار کم و به انبار مقصد اضافه می‌شود؛ کل موجودی کالا تغییر نمی‌کند.',
            )}
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t(
              'warehouse.transferNoTarget',
              'انبار دیگری برای انتقال وجود ندارد. اول یک انبار اضافه کنید.',
            )}
          </p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('warehouse.transferNothing', 'در این انبار کالایی برای انتقال نیست.')}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1 text-sm">
              <label
                htmlFor="warehouse-transfer-product"
                className="text-[hsl(var(--fg-secondary))]"
              >
                {t('warehouse.name', 'نام')}
              </label>
              <SelectField
                id="warehouse-transfer-product"
                value={productId}
                onChange={setProductId}
                placeholder={t('warehouse.chooseProduct', 'انتخاب کالا')}
                options={available.map((product) => ({
                  value: product.id,
                  label: `${product.name} — ${fmt(product.quantity)} ${product.unit}`,
                }))}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label
                htmlFor="warehouse-transfer-target"
                className="text-[hsl(var(--fg-secondary))]"
              >
                {t('warehouse.toWarehouse', 'به انبار')}
              </label>
              <SelectField
                id="warehouse-transfer-target"
                value={targetId}
                onChange={setTargetId}
                placeholder={t('warehouse.toWarehouse', 'به انبار')}
                options={targets.map((target) => ({ value: target.id, label: target.name }))}
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.transferQuantity', 'مقدار انتقال')}
                {selected ? ` (${selected.unit})` : ''}
              </span>
              <input
                id="warehouse-transfer-quantity"
                name="quantity"
                type="number"
                min={0}
                max={selected?.quantity}
                inputMode="decimal"
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={input}
              />
            </label>
            {selected ? (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouse.assignMax', 'حداکثر')}: {fmt(selected.quantity)} {selected.unit}
              </p>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.transferNotes', 'توضیحات (اختیاری)')}
              </span>
              <input
                id="warehouse-transfer-notes"
                name="notes"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={input}
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {error}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || !valid}
            className={primary}
          >
            {t('warehouse.transferAction', 'انتقال')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
