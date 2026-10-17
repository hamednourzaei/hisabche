'use client'

// ============================================
// «قفسه‌ها» — which shelf of each warehouse holds this product, and moving it
// to another shelf, from the product page (owner, 17 October 2026).
//
// A view over the warehouse map's own tables (`/products/:id/storage-locations`)
// and a change through the map's ONE placing path (`storage_place_stock`, via
// `useMoveProductPlacement`). It never changes how much stock there is — only
// which shelf it is recorded on; the server caps that at what the warehouse holds.
// ============================================

import { useMemo, useState } from 'react'

import {
  apiErrorMessage,
  useMoveProductPlacement,
  useProductStorageLocations,
  type ProductStorageWarehouse,
} from '@hisabche/api'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

type T = (key: string, fallback?: string) => string

const label = (code: string, name: string | null) => (name ? `${code} · ${name}` : code)

export function ProductShelfLocations({
  t,
  productId,
  fmt,
}: {
  t: T
  productId: string
  fmt: (v: number) => string
}) {
  const shelves = useProductStorageLocations(productId)
  const [moving, setMoving] = useState<ProductStorageWarehouse | null>(null)

  // Not configured (map migration absent), loading, or failed: say nothing
  // here — the warehouse line above already carries the product's position,
  // and a failed shelf read must not hide it.
  if (!shelves.data || shelves.data.configured === false) return null
  const warehouses = shelves.data.warehouses.filter((w) => w.choices.length > 0)
  if (warehouses.length === 0) return null

  return (
    <span className="flex flex-col gap-1.5" data-product-shelves>
      {warehouses.map((warehouse) => {
        const placed = warehouse.placed.reduce((sum, row) => sum + row.quantity, 0)
        const unplaced = Math.max(0, warehouse.onHand - placed)
        return (
          <span key={warehouse.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-[hsl(var(--fg-secondary))]">{warehouse.name}:</span>
            {warehouse.placed.length === 0 ? (
              <span className="text-[hsl(var(--fg-tertiary))]">
                {t('warehouse.shelves.none', 'روی هیچ قفسه‌ای ثبت نشده')}
              </span>
            ) : (
              warehouse.placed.map((row) => (
                <span
                  key={row.locationId}
                  className="rounded-md bg-[hsl(var(--surface-muted))] px-1.5 py-0.5 font-medium"
                >
                  {label(row.code, row.name)}{' '}
                  <span dir="ltr" className="tabular-nums">
                    {fmt(row.quantity)}
                  </span>
                </span>
              ))
            )}
            {unplaced > 0 && warehouse.placed.length > 0 ? (
              <span className="text-[hsl(var(--fg-tertiary))]">
                {t('warehouse.shelves.unplaced', 'بدون قفسه')}{' '}
                <span dir="ltr" className="tabular-nums">
                  {fmt(unplaced)}
                </span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setMoving(warehouse)}
              className="rounded-md px-1.5 py-0.5 font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
            >
              {t('warehouse.shelves.change', 'تغییر موقعیت')}
            </button>
          </span>
        )
      })}
      {moving ? (
        <MoveDialog
          t={t}
          fmt={fmt}
          productId={productId}
          warehouse={moving}
          onClose={() => setMoving(null)}
        />
      ) : null}
    </span>
  )
}

/** «از این قفسه، این تعداد، به آن قفسه» — or place unplaced units on a shelf. */
function MoveDialog({
  t,
  fmt,
  productId,
  warehouse,
  onClose,
}: {
  t: T
  fmt: (v: number) => string
  productId: string
  warehouse: ProductStorageWarehouse
  onClose: () => void
}) {
  const toast = useToast()
  const move = useMoveProductPlacement()
  const UNPLACED = 'unplaced'
  const placed = warehouse.placed.reduce((sum, row) => sum + row.quantity, 0)
  const unplaced = Math.max(0, warehouse.onHand - placed)

  const sources = useMemo(
    () => [
      ...warehouse.placed.map((row) => ({
        value: row.locationId,
        label: `${label(row.code, row.name)} — ${fmt(row.quantity)}`,
        quantity: row.quantity,
      })),
      ...(unplaced > 0
        ? [
            {
              value: UNPLACED,
              label: `${t('warehouse.shelves.unplaced', 'بدون قفسه')} — ${fmt(unplaced)}`,
              quantity: unplaced,
            },
          ]
        : []),
    ],
    [warehouse.placed, unplaced, fmt, t],
  )
  const [from, setFrom] = useState(sources[0]?.value ?? '')
  const [to, setTo] = useState('')
  const source = sources.find((s) => s.value === from)
  const [quantity, setQuantity] = useState(source ? String(source.quantity) : '')
  const amount = Number(quantity)
  const targets = warehouse.choices.filter((c) => c.id !== from)
  const valid =
    !!source && !!to && Number.isFinite(amount) && amount > 0 && amount <= source.quantity

  const submit = () => {
    if (!valid || !source) return
    const already = warehouse.placed.find((row) => row.locationId === to)?.quantity ?? 0
    move.mutate(
      {
        productId,
        fromLocationId: from === UNPLACED ? null : from,
        fromQuantityAfter: source.quantity - amount,
        toLocationId: to,
        toQuantityAfter: already + amount,
      },
      {
        onSuccess: () => {
          toast.success(t('warehouse.shelves.moved', 'موقعیت کالا تغییر کرد'))
          onClose()
        },
        onError: (error) =>
          toast.error(
            apiErrorMessage(error, t('warehouse.shelves.moveFailed', 'تغییر موقعیت انجام نشد')),
          ),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('warehouse.shelves.change', 'تغییر موقعیت')}: {warehouse.name}
          </DialogTitle>
          <DialogDescription>
            {t(
              'warehouse.shelves.changeHint',
              'فقط جای کالا روی قفسه عوض می‌شود؛ موجودی انبار تغییر نمی‌کند.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.shelves.from', 'از')}
            </span>
            <SelectField
              value={from}
              onChange={(next) => {
                setFrom(next)
                const s = sources.find((x) => x.value === next)
                setQuantity(s ? String(s.quantity) : '')
              }}
              options={sources.map(({ value, label: text }) => ({ value, label: text }))}
              aria-label={t('warehouse.shelves.from', 'از')}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.shelves.to', 'به قفسه')}
            </span>
            <SelectField
              value={to}
              onChange={setTo}
              placeholder={t('warehouse.shelves.pick', 'انتخاب قفسه')}
              options={targets.map((c) => ({ value: c.id, label: label(c.code, c.name) }))}
              aria-label={t('warehouse.shelves.to', 'به قفسه')}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.quantity', 'مقدار')}
            </span>
            <input
              name="quantity"
              type="number"
              min={0}
              max={source?.quantity}
              inputMode="decimal"
              dir="ltr"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm"
            />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button type="button" onClick={submit} disabled={!valid} loading={move.isPending}>
            {t('warehouse.shelves.confirm', 'ثبت موقعیت')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
