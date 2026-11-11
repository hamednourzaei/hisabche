'use client'

// ============================================
// «رزروها» — the warehouse hub section for stock reservations / ATP (V58).
//
// A reservation is a promise: «این تعداد برای این کار کنار گذاشته شده». The
// writes go through the Postgres functions of
// docs/stock-reservations-01-migration.sql (atomic, idempotent on the
// caller's key, workspace-bound); the hooks in
// packages/api/src/hooks/inventory-reservations.ts carry the shape. Nothing
// is modelled twice here (G2).
//
// ATP = on hand − active, unexpired reservations. Settle moves NO stock — the
// sale that honours the promise decrements warehouse_stock on its own
// existing path. Nothing is deleted: release and settle leave the row, the
// actor and the timestamp.
// ============================================

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useAvailableToPromise,
  useReleaseReservation,
  useReservations,
  useReserveStock,
  useSettleReservation,
  type ReservationStatus,
  type StockReservation,
} from '@hisabche/api'

import { Button } from '../button'
import { Input } from '../input'
import { DataTable, type TableColumn } from '../data-table'
import { TableFilterSelect } from '../data-table/table-filter-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'
import { refusalText } from '../../../lib/refusal-text'
import { useDateFormat } from '../../../hooks/use-date-format'
import {
  LabeledSelect,
  labelOf,
  packCard,
  usePackT,
  useProductOptions,
  useWarehouseOptions,
} from '../business-packs/pack-shared'

const FILTERS = ['active', 'settled', 'released', 'expired'] as const

/** The server names its refusals; the screen turns each into a sentence. */
const KNOWN = [
  'RESERVATION_INSUFFICIENT',
  'RESERVATION_NO_STOCK',
  'RESERVATION_NOT_ACTIVE',
  'RESERVATION_INVALID_QUANTITY',
  'WAREHOUSE_MAP_SCHEMA_REQUIRED',
]

const STATUS_TONE: Record<ReservationStatus, string> = {
  active: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  settled: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  released: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
  expired: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
}

export function HoldsSection() {
  const t = usePackT()
  const toast = useToast()
  const { date } = useDateFormat()
  const warehouses = useWarehouseOptions()
  const products = useProductOptions('goods')

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('active')
  const list = useReservations({ status: filter, limit: 100 })
  const reserve = useReserveStock()
  const release = useReleaseReservation()
  const settle = useSettleReservation()

  const fail = (fallback: string) => (error: unknown) =>
    toast.error(refusalText(error, t, 'holds', KNOWN, fallback))

  const productName = useMemo(() => {
    const map = new Map(products.map((p) => [p.value, p.label]))
    return (id: string) => map.get(id) ?? id.slice(0, 8)
  }, [products])
  const warehouseName = (id: string) => labelOf(warehouses, id)

  const [open, setOpen] = useState(false)
  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')

  // The free-to-promise figure for the chosen pair, shown in the dialog so a
  // number is never typed against stock that is not there.
  const atp = useAvailableToPromise(warehouseId || null, productId || null)

  const amount = typedNumber(quantity)
  const ready = !!warehouseId && !!productId && (amount ?? 0) > 0

  const submit = () => {
    if (!ready) return
    reserve.mutate(
      {
        warehouseId,
        productId,
        quantity: amount ?? 0,
        // The caller's own idempotency key: a double-click or a retried save
        // returns the hold already made instead of a second one.
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: () => {
          toast.success(t('holds.reserved', 'رزرو ثبت شد'))
          setOpen(false)
          setQuantity('')
        },
        onError: fail(t('holds.reserveFailed', 'رزرو ثبت نشد')),
      },
    )
  }

  const act = (
    row: StockReservation,
    action: 'release' | 'settle',
  ) => {
    const mutation = action === 'release' ? release : settle
    mutation.mutate(
      { reservationId: row.id },
      {
        onSuccess: () =>
          toast.success(
            action === 'release'
              ? t('holds.released', 'رزرو آزاد شد')
              : t('holds.settled', 'رزرو تسویه شد'),
          ),
        onError: fail(t('holds.actionFailed', 'انجام نشد')),
      },
    )
  }

  const columns: TableColumn<StockReservation>[] = [
    {
      id: 'product',
      labelKey: 'holds.product',
      labelFallback: 'کالا',
      locked: true,
      render: (row) => productName(row.productId),
    },
    {
      id: 'warehouse',
      labelKey: 'holds.warehouse',
      labelFallback: 'انبار',
      render: (row) => warehouseName(row.warehouseId),
    },
    {
      id: 'quantity',
      labelKey: 'holds.quantity',
      labelFallback: 'تعداد',
      sortValue: (row) => row.quantity,
      render: (row) => (
        <span dir="ltr" className="tabular-nums">
          {row.quantity}
        </span>
      ),
    },
    {
      id: 'status',
      labelKey: 'holds.statusLabel',
      labelFallback: 'وضعیت',
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[row.status] ?? ''}`}
        >
          {t(`holds.status.${row.status}`, row.status)}
        </span>
      ),
    },
    {
      id: 'createdAt',
      labelKey: 'holds.createdAt',
      labelFallback: 'تاریخ رزرو',
      showFrom: 'md',
      sortValue: (row) => row.createdAt,
      render: (row) => (row.createdAt ? date(row.createdAt) : '—'),
    },
    {
      id: 'actions',
      labelKey: 'holds.actions',
      labelFallback: 'کار',
      locked: true,
      render: (row) =>
        row.status === 'active' ? (
          <span className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => act(row, 'settle')}
              loading={settle.isPending}
            >
              {t('holds.settle', 'تسویه')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => act(row, 'release')}
              loading={release.isPending}
            >
              {t('holds.release', 'آزادسازی')}
            </Button>
          </span>
        ) : null,
    },
  ]

  return (
    <div className={packCard} data-holds-section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TableFilterSelect
          label={t('holds.filterLabel', 'وضعیت')}
          value={filter}
          onChange={(next) => setFilter((next as (typeof FILTERS)[number]) ?? 'active')}
          options={FILTERS.map((value) => ({
            value,
            label: t(`holds.status.${value}`, value),
          }))}
        />
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('holds.reserve', 'رزرو موجودی')}
        </Button>
      </div>

      {list.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ) : (list.data?.reservations ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-[hsl(var(--fg-secondary))]">
          {t('holds.none', 'هیچ رزروی در این وضعیت ثبت نشده')}
        </p>
      ) : (
        <DataTable
          tableId="holds"
          t={t}
          rows={list.data?.reservations ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          emptyState={
            <p className="py-8 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('holds.none', 'هیچ رزروی در این وضعیت ثبت نشده')}
            </p>
          }
        />
      )}

      {open ? (
        <Dialog open onOpenChange={(next) => !next && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('holds.reserveTitle', 'رزرو موجودی')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <LabeledSelect
                label={t('holds.warehouse', 'انبار')}
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder={t('holds.pickWarehouse', 'انتخاب انبار')}
                options={warehouses}
              />
              <LabeledSelect
                label={t('holds.product', 'کالا')}
                value={productId}
                onChange={setProductId}
                placeholder={t('holds.pickProduct', 'انتخاب کالا')}
                options={products}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('holds.quantity', 'تعداد')}
                </span>
                <Input
                  name="quantity"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  dir="ltr"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              {warehouseId && productId ? (
                <p className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('holds.availableNow', 'موجود در دسترس: {available} از {onHand}').replace(
                    '{available}',
                    String(atp.data?.available ?? '—'),
                  ).replace('{onHand}', String(atp.data?.onHand ?? '—'))}
                </p>
              ) : null}
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t(
                  'holds.reserveHint',
                  'رزرو یک قول است: تعداد رزروشده از «موجود در دسترس» کم می‌شود، اما جابه‌جایی انبار با فروش واقعی انجام می‌شود، نه با رزرو.',
                )}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('action.cancel', 'انصراف')}
              </Button>
              <Button type="button" onClick={submit} disabled={!ready} loading={reserve.isPending}>
                {t('holds.reserveConfirm', 'ثبت رزرو')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
