'use client'

// ============================================
// «ثبت ضایعات» on the product page (QA report, Weighted Retail DNA; 10 Nov 2026).
//
// Goods that left without a sale — spoiled, damaged, expired, lost — leave
// the stock with their reason, from one warehouse, instead of the stock
// figure being overwritten on the edit form (which erased the WHY). The
// server refuses more than the warehouse holds; the record shows in the
// product's «افزایش و کاهش موجودی» like any other movement.
// ============================================

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRecordWaste } from '@hisabche/api'
import { STOCK_WASTE_REASONS, type StockWasteReason } from '@hisabche/validation'

import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'
import { refusalText } from '../../../lib/refusal-text'

type Translate = (key: string, fallback?: string) => string

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

export function ProductWastePanel({
  t,
  productId,
  unitLabel,
  warehouses,
}: {
  t: Translate
  productId: string
  /** The product's own unit, shown beside the quantity (kg, عدد …). */
  unitLabel: string
  /** With several, the person names the one the goods left. */
  warehouses: Array<{ id: string; name: string }>
}) {
  const record = useRecordWaste(productId)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<StockWasteReason>('spoiled')
  const [note, setNote] = useState('')
  const [warehouseId, setWarehouseId] = useState<string | null>(
    warehouses.length === 1 ? (warehouses[0]?.id ?? null) : null,
  )

  const amount = typedNumber(quantity)
  const needsWarehouse = warehouses.length > 1 && !warehouseId
  const ready = amount !== null && amount > 0 && !needsWarehouse

  const submit = () => {
    if (!ready || amount === null) return
    record.mutate(
      {
        quantity: amount,
        reason,
        ...(warehouseId ? { warehouseId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('productWaste.saved', 'ضایعات ثبت شد و از موجودی کم شد'))
          setQuantity('')
          setNote('')
          setOpen(false)
        },
        onError: (error) =>
          toast.error(
            refusalText(
              error,
              t,
              'productWaste',
              ['WASTE_MORE_THAN_STOCK', 'WASTE_NOT_STOCKED'],
              t('productWaste.failed', 'ضایعات ثبت نشد'),
            ),
          ),
      },
    )
  }

  return (
    <section className={card} data-guide="product-waste">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('productWaste.title', 'ضایعات')}
          </h3>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t(
              'productWaste.hint',
              'کالایی که بدون فروش از دست رفت (خراب، شکسته، تاریخ‌گذشته، گم‌شده) با دلیلش از موجودی کم می‌شود.',
            )}
          </p>
        </div>
        {open ? null : (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            {t('productWaste.open', 'ثبت ضایعات')}
          </Button>
        )}
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('productWaste.quantity', 'مقدار')} ({unitLabel})
            </span>
            <Input
              name="quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('productWaste.reason', 'دلیل')}
            </span>
            <SelectField
              name="reason"
              value={reason}
              onChange={(value) => setReason(value as StockWasteReason)}
              options={STOCK_WASTE_REASONS.map((value) => ({
                value,
                label: t(`productWaste.reasons.${value}`),
              }))}
            />
          </label>
          {warehouses.length > 1 ? (
            <label className="space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('productWaste.warehouse', 'از انبار')}
              </span>
              <SelectField
                name="warehouseId"
                value={warehouseId ?? ''}
                placeholder={t('productWaste.pickWarehouse', 'انبار را انتخاب کنید')}
                onChange={(value) => setWarehouseId(value || null)}
                options={warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: warehouse.name,
                }))}
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('productWaste.note', 'توضیح (اختیاری)')}
            </span>
            <Input
              name="note"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={submit} disabled={!ready} loading={record.isPending}>
              {t('productWaste.submit', 'کم کردن از موجودی')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel', 'انصراف')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
