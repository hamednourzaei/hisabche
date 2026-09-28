'use client'

// ============================================
// Where this product's stock is (BUG-080).
//
// Reported: the product page said «موجودی ۲۰» while the warehouse said
// «تمام شده −۱۰» for the same item. Both were right: 20 is the product total
// (every movement), −10 is what that warehouse recorded, and the other 30 sat
// in NO warehouse — a refill from this page used to be recorded without one,
// while every sale subtracts from the warehouse it sells from.
//
// So the total is shown WITH its parts, a negative warehouse says what it
// means, and stock in no warehouse can be moved into one from here — through
// the same assign path as «افزودن کالا به انبار». Nothing is moved by guess.
// ============================================

import { useState } from 'react'
import { Warehouse } from 'lucide-react'
import {
  apiErrorMessage,
  useAssignWarehouseStock,
  useProductWarehouseBreakdown,
} from '@hisabche/api'

import { Button } from '../button'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

type T = (key: string, fallback?: string) => string

export function ProductWarehouseStockPanel({
  t,
  productId,
  fmt,
}: {
  t: T
  productId: string
  fmt: (v: number) => string
}) {
  const breakdown = useProductWarehouseBreakdown(productId)
  const toast = useToast()
  const [target, setTarget] = useState('')
  const [quantity, setQuantity] = useState('')
  const assign = useAssignWarehouseStock(target)

  const data = breakdown.data
  // No warehouses: the total IS the only place stock can be — nothing to explain.
  if (!breakdown.isLoading && !breakdown.error && (!data || data.warehouses.length === 0))
    return null

  const free = data?.unassigned ?? 0
  const amount = Number(quantity || free)
  const canMove = !!target && Number.isFinite(amount) && amount > 0 && amount <= free

  return (
    <section
      data-product-warehouse-stock=""
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <div className="flex items-center gap-2">
        <Warehouse className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">
          {t('warehouse.byWarehouse.title')}
        </h2>
      </div>
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('warehouse.byWarehouse.help')}</p>

      {breakdown.isLoading && (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('warehouse.byWarehouse.loading')}
        </p>
      )}
      {breakdown.error && (
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(breakdown.error, t('warehouse.byWarehouse.loadError'))}
        </p>
      )}

      {data && (
        <>
          <ul className="divide-y divide-[hsl(var(--border-default))] text-sm">
            {data.warehouses.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                <span>{w.name}</span>
                <span
                  className={
                    w.quantity < 0
                      ? 'font-semibold tabular-nums text-[hsl(var(--color-destructive))]'
                      : 'font-semibold tabular-nums'
                  }
                >
                  {fmt(w.quantity)}
                </span>
              </li>
            ))}
            {data.unassigned !== 0 && (
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('warehouse.byWarehouse.unassigned')}
                </span>
                <span className="font-semibold tabular-nums">{fmt(data.unassigned)}</span>
              </li>
            )}
            <li className="flex items-center justify-between gap-3 py-2 font-semibold">
              <span>{t('warehouse.byWarehouse.total')}</span>
              <span className="tabular-nums">{fmt(data.total)}</span>
            </li>
          </ul>

          {data.warehouses.some((w) => w.quantity < 0) && (
            <p className="rounded-lg bg-[hsl(var(--color-destructive)/0.08)] p-2 text-xs text-[hsl(var(--fg-primary))]">
              {t('warehouse.byWarehouse.negativeHelp')}
            </p>
          )}

          {free > 0 && (
            <form
              className="space-y-2 rounded-lg bg-[hsl(var(--surface-muted))] p-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (!canMove) return
                assign.mutate(
                  { productId, quantity: amount },
                  {
                    onSuccess: () => {
                      toast.success(t('warehouse.byWarehouse.moved'))
                      setQuantity('')
                    },
                    onError: (error) =>
                      toast.error(apiErrorMessage(error, t('warehouse.byWarehouse.moveFailed'))),
                  },
                )
              }}
            >
              <p className="text-sm">{t('warehouse.byWarehouse.moveHelp')}</p>
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                <SelectField
                  name="warehouseId"
                  value={target}
                  onChange={setTarget}
                  placeholder={t('warehouse.byWarehouse.pickWarehouse')}
                  options={data.warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={free}
                  dir="ltr"
                  value={quantity}
                  placeholder={String(free)}
                  aria-label={t('warehouse.byWarehouse.quantity')}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" loading={assign.isPending} disabled={!canMove}>
                  {t('warehouse.byWarehouse.move')}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
