'use client'

// ============================================
// Stock in NO warehouse, moved into one (BUG-080).
//
// Reported: the product page said «موجودی ۲۰» while the warehouse said
// «تمام شده −۱۰» for the same item. Both were right: the other 30 sat in NO
// warehouse — a refill from this page used to be recorded without one, while
// every sale subtracts from the warehouse it sells from.
//
// ⚠️ THE LIST THIS PANEL USED TO DRAW («موجودی در هر انبار» with its total) is
// gone on the owner's instruction (17 October 2026): the parts are now one line
// under the cards («موقعیت در انبار», `product-stock-position.tsx`) and the
// total is not repeated a third time. What stays here is the ACTION: stock in
// no warehouse can be moved into one, through the same assign path as
// «افزودن کالا به انبار». Nothing is moved by guess. The form is unchanged —
// the owner asked for exactly that.
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

export function ProductWarehouseStockPanel({ t, productId }: { t: T; productId: string }) {
  const breakdown = useProductWarehouseBreakdown(productId)
  const toast = useToast()
  const [target, setTarget] = useState('')
  const [quantity, setQuantity] = useState('')
  const assign = useAssignWarehouseStock(target)

  const data = breakdown.data
  const free = data?.unassigned ?? 0
  const amount = Number(quantity || free)
  const canMove = !!target && Number.isFinite(amount) && amount > 0 && amount <= free

  // Shows itself only when there is something to do: stock in no warehouse AND
  // a warehouse to move it into. No warehouses: the total IS the only place
  // stock can be — nothing to explain, nothing to move.
  if (!data || free <= 0 || data.warehouses.length === 0) return null

  return (
    <section
      data-product-warehouse-stock=""
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <div className="flex items-center gap-2">
        <Warehouse className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h2 className="font-semibold text-[hsl(var(--fg-primary))]">
          {t('warehouse.assignTitle', 'جای‌دادن موجودیِ بی‌انبار')}
        </h2>
      </div>

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
    </section>
  )
}
