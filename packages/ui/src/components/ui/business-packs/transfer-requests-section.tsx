'use client'

// ============================================
// «درخواست انتقال» — the warehouse hub section for Smart Location's Pick
// Request + storekeeper task (QA document §6, P0, 10 Nov 2026).
//
// The shop asks the store for goods; the store approves, picks, ships; the
// shop receives — and only then does stock move, through the same engine as
// a direct transfer (TransferService). Open requests are the storekeeper's
// task list. A request can be cancelled only before it is shipped.
// ============================================

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useAdvanceTransferRequest,
  useCreateTransferRequest,
  useTransferRequests,
  type TransferAction,
  type TransferRequestRow,
  type TransferStatus,
} from '@hisabche/api'

import { Button } from '../button'
import { Input } from '../input'
import { DataTable, type TableColumn } from '../data-table'
import { TableFilterSelect } from '../data-table/table-filter-select'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'
import { refusalText } from '../../../lib/refusal-text'
import { useDateFormat } from '../../../hooks/use-date-format'
import {
  labelOf,
  packCard,
  usePackT,
  useProductOptions,
  useWarehouseOptions,
  LabeledSelect,
} from './pack-shared'

/** The next step each status offers — the same table as transfer.domain. */
const NEXT: Partial<Record<TransferStatus, TransferAction>> = {
  requested: 'approve',
  approved: 'pick',
  picking: 'ship',
  shipped: 'receive',
  in_transit: 'receive',
}
const CANCELLABLE: readonly TransferStatus[] = ['requested', 'approved', 'picking']
const FILTERS = [
  'open',
  'requested',
  'approved',
  'picking',
  'shipped',
  'received',
  'cancelled',
] as const

const KNOWN = [
  'TRANSFER_SAME_WAREHOUSE',
  'TRANSFER_DUPLICATE_PRODUCT',
  'TRANSFER_CANCEL_REASON_REQUIRED',
  'TRANSFER_CONCURRENT_UPDATE',
  'TRANSFER_UNIT_NOT_SUPPORTED',
  'WAREHOUSE_INSUFFICIENT_STOCK',
]

export function TransferRequestsSection() {
  const t = usePackT()
  const toast = useToast()
  const { date } = useDateFormat()
  const warehouses = useWarehouseOptions()
  const products = useProductOptions('goods')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open')
  const list = useTransferRequests()
  const create = useCreateTransferRequest()
  const advance = useAdvanceTransferRequest()

  const rows = useMemo(() => {
    const all = list.data ?? []
    if (filter === 'open')
      return all.filter((r) => r.status !== 'received' && r.status !== 'cancelled')
    return all.filter((r) => r.status === filter)
  }, [list.data, filter])

  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ key: number; productId: string; quantity: string }>>([
    { key: 1, productId: '', quantity: '' },
  ])

  const fail = (fallback: string) => (error: unknown) =>
    toast.error(refusalText(error, t, 'transferRequests', KNOWN, fallback))

  const ready =
    from &&
    to &&
    from !== to &&
    lines.every((l) => l.productId && (typedNumber(l.quantity) ?? 0) > 0)

  const submit = () => {
    if (!ready) return
    create.mutate(
      {
        fromWarehouseId: from,
        toWarehouseId: to,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: typedNumber(l.quantity) ?? 0,
        })),
      },
      {
        onSuccess: () => {
          toast.success(t('transferRequests.created', 'درخواست ثبت شد'))
          setOpen(false)
          setLines([{ key: 1, productId: '', quantity: '' }])
          setNotes('')
        },
        onError: fail(t('transferRequests.createFailed', 'درخواست ثبت نشد')),
      },
    )
  }

  // A cancel asks its reason inline (window.prompt does not exist in the desktop app).
  const [cancelFor, setCancelFor] = useState<TransferRequestRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const step = (row: TransferRequestRow, action: TransferAction, reason?: string) => {
    if (action === 'cancel' && !reason?.trim()) {
      setCancelFor(row)
      return
    }
    advance.mutate(
      { id: row.id, action, ...(reason ? { reason: reason.trim() } : {}) },
      {
        onSuccess: () => {
          setCancelFor(null)
          setCancelReason('')
          toast.success(
            action === 'receive'
              ? t('transferRequests.received', 'رسید؛ موجودی به انبار مقصد رفت')
              : t('transferRequests.moved', 'وضعیت عوض شد'),
          )
        },
        onError: fail(t('transferRequests.moveFailed', 'انجام نشد')),
      },
    )
  }

  const columns: TableColumn<TransferRequestRow>[] = [
    {
      id: 'number',
      labelKey: 'transferRequests.number',
      labelFallback: 'شماره',
      locked: true,
      render: (row) => row.transfer_number ?? row.id.slice(0, 8),
    },
    {
      id: 'route',
      labelKey: 'transferRequests.route',
      labelFallback: 'از ← به',
      render: (row) => (
        <span className="whitespace-nowrap">
          {labelOf(warehouses, row.from_warehouse_id)} ← {labelOf(warehouses, row.to_warehouse_id)}
        </span>
      ),
    },
    {
      id: 'status',
      labelKey: 'transferRequests.statusLabel',
      labelFallback: 'وضعیت',
      render: (row) => t(`transferRequests.status.${row.status}`, row.status),
    },
    {
      id: 'requested',
      labelKey: 'transferRequests.requestedAt',
      labelFallback: 'تاریخ درخواست',
      showFrom: 'md',
      sortValue: (row) => row.requested_at,
      render: (row) => date(row.requested_at),
    },
    {
      id: 'actions',
      labelKey: 'transferRequests.actions',
      labelFallback: 'کار',
      locked: true,
      render: (row) => {
        const next = NEXT[row.status]
        return (
          <div className="flex flex-wrap gap-1">
            {next ? (
              <Button size="sm" onClick={() => step(row, next)} disabled={advance.isPending}>
                {t(`transferRequests.actionsLabel.${next}`, next)}
              </Button>
            ) : null}
            {CANCELLABLE.includes(row.status) ? (
              <Button size="sm" variant="ghost" onClick={() => step(row, 'cancel')}>
                {t('transferRequests.actionsLabel.cancel', 'لغو')}
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <section className="space-y-3" data-guide="transfer-requests">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t(
          'transferRequests.hint',
          'فروشگاه کالا را از انبار می‌خواهد؛ انباردار تأیید، جمع‌آوری و ارسال می‌کند. موجودی فقط با «رسید» جابه‌جا می‌شود و تا آن لحظه در انبار مبدأ شمرده می‌شود.',
        )}
      </p>

      {open ? (
        <div className={`${packCard} grid gap-3 sm:grid-cols-2`}>
          <LabeledSelect
            name="fromWarehouseId"
            label={t('transferRequests.from', 'از انبار')}
            value={from}
            onChange={setFrom}
            options={warehouses}
          />
          <LabeledSelect
            name="toWarehouseId"
            label={t('transferRequests.to', 'به انبار')}
            value={to}
            onChange={setTo}
            options={warehouses}
          />
          {lines.map((line, index) => (
            <div key={line.key} className="sm:col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <LabeledSelect
                  name={`lines.${index}.productId`}
                  label={index === 0 ? t('transferRequests.product', 'کالا') : undefined}
                  value={line.productId}
                  onChange={(v) =>
                    setLines((all) =>
                      all.map((l) => (l.key === line.key ? { ...l, productId: v } : l)),
                    )
                  }
                  options={products}
                />
              </div>
              <Input
                className="w-28"
                name={`lines.${index}.quantity`}
                inputMode="decimal"
                value={line.quantity}
                placeholder={t('transferRequests.quantity', 'تعداد')}
                onChange={(e) =>
                  setLines((all) =>
                    all.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)),
                  )
                }
              />
              {lines.length > 1 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('transferRequests.removeLine', 'حذف ردیف')}
                  onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((all) => [...all, { key: Date.now(), productId: '', quantity: '' }])
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('transferRequests.addLine', 'کالای دیگر')}
            </Button>
            <Input
              className="flex-1"
              name="notes"
              value={notes}
              placeholder={t('transferRequests.notes', 'یادداشت (اختیاری)')}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button size="sm" onClick={submit} disabled={!ready || create.isPending}>
              {t('transferRequests.submit', 'ثبت درخواست')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t('transferRequests.close', 'انصراف')}
            </Button>
          </div>
        </div>
      ) : null}

      {cancelFor ? (
        <div className={`${packCard} flex flex-wrap items-center gap-2`}>
          <Input
            className="flex-1"
            name="reason"
            value={cancelReason}
            placeholder={t('transferRequests.cancelReason', 'دلیل لغو؟')}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={!cancelReason.trim() || advance.isPending}
            onClick={() => step(cancelFor, 'cancel', cancelReason)}
          >
            {t('transferRequests.actionsLabel.cancel', 'لغو')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCancelFor(null)}>
            {t('transferRequests.close', 'انصراف')}
          </Button>
        </div>
      ) : null}

      {list.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {t('transferRequests.loadFailed', 'درخواست‌ها خوانده نشد؛ این «خالی» نیست.')}
        </p>
      ) : (
        <DataTable
          tableId="transfer-requests"
          t={t}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          actions={
            <div className="flex items-center gap-2">
              <TableFilterSelect
                label={t('transferRequests.filter', 'وضعیت')}
                value={filter}
                allValue="open"
                onChange={(v) => setFilter(v as (typeof FILTERS)[number])}
                options={FILTERS.map((value) => ({
                  value,
                  label:
                    value === 'open'
                      ? t('transferRequests.open', 'باز')
                      : t(`transferRequests.status.${value}`, value),
                }))}
              />
              {open ? null : (
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('transferRequests.new', 'درخواست تازه')}
                </Button>
              )}
            </div>
          }
          emptyState={
            <p className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
              {t('transferRequests.empty', 'درخواستی در این وضعیت نیست.')}
            </p>
          }
        />
      )}
    </section>
  )
}
