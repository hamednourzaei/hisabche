'use client'

// ============================================
// «تعمیرات» — repair slips (mobile shop, QA document §9, 10 Nov 2026).
//
// Received → diagnosing → waiting for parts → repairing → ready → delivered.
// «Under warranty» is decided by the server from the unit's warranty record;
// the charge, if any, is an ordinary sale invoice linked on delivery — the
// slip itself moves no money and no stock.
// ============================================

import { useMemo, useState } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import {
  useCreateRepairTicket,
  useInvoices,
  useMoveRepairTicket,
  useRepairTickets,
  useSerials,
  type RepairTicket,
} from '@hisabche/api'
import {
  REPAIR_MOVES,
  REPAIR_STATUSES,
  summarizeRepairMetrics,
  type RepairStatus,
} from '@hisabche/validation'

import { Button } from '../button'
import { Input } from '../input'
import { DataTable, type TableColumn } from '../data-table'
import { TableFilterSelect } from '../data-table/table-filter-select'
import { useToast } from '../toast-provider'
import { refusalText } from '../../../lib/refusal-text'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useDateFormat } from '../../../hooks/use-date-format'
import { RepairTicketWorkPanel } from './repair-ticket-work-panel'
import {
  labelOf,
  NotReady,
  packCard,
  typedMinor,
  useCustomerOptions,
  useEmployeeOptions,
  useMoneyText,
  usePackT,
  useProductOptions,
  LabeledSelect,
} from './pack-shared'

const KNOWN = [
  'REPAIR_MOVE_NOT_ALLOWED',
  'REPAIR_CANCEL_NOTE_REQUIRED',
  'REPAIR_INVOICE_ONLY_ON_DELIVERY',
  'REPAIR_INVOICE_NOT_THIS_CUSTOMER',
  'REPAIR_ESTIMATE_CURRENCY_REQUIRED',
  'REPAIR_TICKET_CHANGED',
  'REPAIR_CUSTOMER_NOT_FOUND',
  'REPAIR_SERIAL_NOT_FOUND',
  'REPAIR_NOT_READY',
]

/** The customer's sale invoices, to link the one that charged for the repair. */
function DeliverWithInvoice({
  ticket,
  onDone,
}: {
  ticket: RepairTicket
  onDone: (invoiceId: string | null) => void
}) {
  const t = usePackT()
  const invoices = useInvoices({
    page: 1,
    limit: 20,
    sortDirection: 'desc',
    type: 'sale',
    customerId: ticket.customerId,
  })
  const [invoiceId, setInvoiceId] = useState('')
  const options = useMemo(() => {
    const list = (
      invoices.data as { invoices?: Array<{ id?: string; invoiceNumber?: string }> } | undefined
    )?.invoices
    return (list ?? [])
      .filter((i): i is { id: string; invoiceNumber?: string } => Boolean(i.id))
      .map((i) => ({ value: i.id, label: i.invoiceNumber ?? i.id.slice(0, 8) }))
  }, [invoices.data])
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <LabeledSelect
          name="invoiceId"
          label={t('repairs.invoice', 'فاکتور فروش این تعمیر (اختیاری)')}
          value={invoiceId}
          placeholder={
            ticket.underWarranty
              ? t('repairs.noInvoiceWarranty', 'گارانتی — بدون فاکتور')
              : t('repairs.pickInvoice', 'انتخاب فاکتور')
          }
          onChange={setInvoiceId}
          options={options}
        />
      </div>
      <Button size="sm" onClick={() => onDone(invoiceId || null)}>
        {t('repairs.status.delivered', 'تحویل شد')}
      </Button>
    </div>
  )
}

export function RepairTicketsSection() {
  const t = usePackT()
  const toast = useToast()
  const { date } = useDateFormat()
  const money = useMoneyText()
  const bookCurrency = useBookCurrency()
  const [filter, setFilter] = useState<RepairStatus | 'open'>('open')
  const list = useRepairTickets(filter)
  const create = useCreateRepairTicket()
  const move = useMoveRepairTicket()
  const customers = useCustomerOptions()
  const staff = useEmployeeOptions()
  const goods = useProductOptions('goods')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    customerId: '',
    deviceLabel: '',
    problem: '',
    estimate: '',
    technicianEmployeeId: '',
    promisedOn: '',
    productId: '',
    serialId: '',
  })
  const serials = useSerials(form.productId || undefined, 'all')
  const serialOptions = useMemo(
    () =>
      ((serials.data ?? []) as Array<{ id: string; serialNumber: string }>).map((s) => ({
        value: s.id,
        label: s.serialNumber,
      })),
    [serials.data],
  )
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const [delivering, setDelivering] = useState<string | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<{ id: string; status: RepairStatus } | null>(null)
  const [note, setNote] = useState('')

  const fail = (fallback: string) => (error: unknown) =>
    toast.error(refusalText(error, t, 'repairs', KNOWN, fallback))

  const estimateMinor =
    form.estimate.trim() && bookCurrency ? typedMinor(form.estimate, bookCurrency) : null
  const ready = form.customerId && form.deviceLabel.trim() && form.problem.trim()

  const submit = () => {
    if (!ready) return
    create.mutate(
      {
        customerId: form.customerId,
        deviceLabel: form.deviceLabel.trim(),
        problem: form.problem.trim(),
        ...(estimateMinor !== null && bookCurrency
          ? { estimateMinor, currency: bookCurrency }
          : {}),
        ...(form.technicianEmployeeId ? { technicianEmployeeId: form.technicianEmployeeId } : {}),
        ...(form.promisedOn ? { promisedOn: form.promisedOn } : {}),
        ...(form.serialId ? { serialId: form.serialId } : {}),
      },
      {
        onSuccess: (ticket) => {
          toast.success(
            ticket.underWarranty
              ? t('repairs.createdWarranty', 'رسید تعمیر ثبت شد — دستگاه گارانتی دارد')
              : t('repairs.created', 'رسید تعمیر ثبت شد'),
          )
          setOpen(false)
          setForm((f) => ({ ...f, deviceLabel: '', problem: '', estimate: '', serialId: '' }))
        },
        onError: fail(t('repairs.createFailed', 'رسید تعمیر ثبت نشد')),
      },
    )
  }

  const go = (
    id: string,
    status: RepairStatus,
    extra: { note?: string; invoiceId?: string | null } = {},
  ) => {
    if (status === 'cancelled' && !extra.note) {
      setNoteFor({ id, status })
      return
    }
    move.mutate(
      {
        id,
        status,
        ...(extra.note ? { note: extra.note } : {}),
        ...(extra.invoiceId ? { invoiceId: extra.invoiceId } : {}),
      },
      {
        onSuccess: () => {
          setDelivering(null)
          setNoteFor(null)
          setNote('')
          toast.success(t('repairs.moved', 'وضعیت عوض شد'))
        },
        onError: fail(t('repairs.moveFailed', 'انجام نشد')),
      },
    )
  }

  const columns: TableColumn<RepairTicket>[] = [
    {
      id: 'number',
      labelKey: 'repairs.number',
      labelFallback: 'شماره',
      locked: true,
      sortValue: (row) => row.number,
      render: (row) => (
        <span className="inline-flex items-center gap-1">
          #{row.number}
          {row.underWarranty ? (
            <ShieldCheck
              className="h-4 w-4 text-[hsl(var(--color-success))]"
              aria-label={t('repairs.underWarranty', 'گارانتی')}
            />
          ) : null}
        </span>
      ),
    },
    {
      id: 'customer',
      labelKey: 'repairs.customer',
      labelFallback: 'مشتری',
      render: (row) => labelOf(customers, row.customerId),
    },
    {
      id: 'device',
      labelKey: 'repairs.device',
      labelFallback: 'دستگاه',
      render: (row) => row.deviceLabel,
    },
    {
      id: 'problem',
      labelKey: 'repairs.problem',
      labelFallback: 'ایراد',
      showFrom: 'md',
      render: (row) => row.problem,
    },
    {
      id: 'status',
      labelKey: 'repairs.statusLabel',
      labelFallback: 'وضعیت',
      render: (row) => t(`repairs.status.${row.status}`, row.status),
    },
    {
      id: 'estimate',
      labelKey: 'repairs.estimate',
      labelFallback: 'برآورد',
      showFrom: 'md',
      align: 'end',
      render: (row) =>
        row.estimateMinor !== null && row.currency ? money(row.estimateMinor, row.currency) : '—',
    },
    {
      id: 'promised',
      labelKey: 'repairs.promisedOn',
      labelFallback: 'قول تحویل',
      showFrom: 'lg',
      render: (row) => (row.promisedOn ? date(row.promisedOn) : '—'),
    },
    {
      id: 'actions',
      labelKey: 'repairs.actions',
      labelFallback: 'کار',
      locked: true,
      render: (row) =>
        delivering === row.id ? (
          <DeliverWithInvoice
            ticket={row}
            onDone={(invoiceId) => go(row.id, 'delivered', { invoiceId })}
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            {REPAIR_MOVES[row.status].map((to) => (
              <Button
                key={to}
                size="sm"
                variant={to === 'cancelled' ? 'ghost' : 'outline'}
                disabled={move.isPending}
                onClick={() => (to === 'delivered' ? setDelivering(row.id) : go(row.id, to))}
              >
                {t(`repairs.status.${to}`, to)}
              </Button>
            ))}
            <Button
              size="sm"
              variant={selectedTicketId === row.id ? 'default' : 'ghost'}
              onClick={() => setSelectedTicketId((cur) => (cur === row.id ? null : row.id))}
            >
              {t('repairs.partsAndBill', 'قطعات و فاکتور')}
            </Button>
          </div>
        ),
    },
  ]

  if (list.data && !list.data.ready) return <NotReady t={t} migration="retail-ops-01" />

  return (
    <section className="space-y-3" data-guide="repair-tickets">
      {open ? (
        <div className={`${packCard} grid gap-3 sm:grid-cols-2`}>
          <LabeledSelect
            name="customerId"
            label={t('repairs.customer', 'مشتری')}
            value={form.customerId}
            onChange={set('customerId')}
            options={customers}
          />
          <Input
            name="deviceLabel"
            value={form.deviceLabel}
            placeholder={t('repairs.devicePlaceholder', 'مثلاً سامسونگ A54 آبی')}
            onChange={(e) => set('deviceLabel')(e.target.value)}
          />
          <Input
            className="sm:col-span-2"
            name="problem"
            value={form.problem}
            placeholder={t('repairs.problemPlaceholder', 'ایراد به گفته‌ی مشتری')}
            onChange={(e) => set('problem')(e.target.value)}
          />
          <LabeledSelect
            name="productId"
            label={t('repairs.registeredModel', 'مدل ثبت‌شده در فروشگاه (اختیاری)')}
            value={form.productId}
            onChange={(v) => setForm((f) => ({ ...f, productId: v, serialId: '' }))}
            options={goods}
          />
          <LabeledSelect
            name="serialId"
            label={t('repairs.serial', 'شماره سریال / IMEI')}
            value={form.serialId}
            onChange={set('serialId')}
            options={serialOptions}
            disabled={!form.productId}
          />
          <Input
            name="estimate"
            inputMode="decimal"
            value={form.estimate}
            placeholder={`${t('repairs.estimate', 'برآورد')} (${bookCurrency ?? ''})`}
            onChange={(e) => set('estimate')(e.target.value)}
          />
          <LabeledSelect
            name="technicianEmployeeId"
            label={t('repairs.technician', 'تعمیرکار')}
            value={form.technicianEmployeeId}
            onChange={set('technicianEmployeeId')}
            options={staff}
          />
          <label className="space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('repairs.promisedOn', 'قول تحویل')}
            </span>
            <Input
              type="date"
              name="promisedOn"
              value={form.promisedOn}
              onChange={(e) => set('promisedOn')(e.target.value)}
            />
          </label>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={submit} disabled={!ready || create.isPending}>
              {t('repairs.submit', 'ثبت رسید تعمیر')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t('repairs.close', 'انصراف')}
            </Button>
          </div>
        </div>
      ) : null}

      {noteFor ? (
        <div className={`${packCard} flex flex-wrap items-center gap-2`}>
          <Input
            className="flex-1"
            name="note"
            value={note}
            placeholder={t('repairs.cancelNote', 'چرا لغو می‌شود؟')}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={!note.trim() || move.isPending}
            onClick={() => go(noteFor.id, noteFor.status, { note: note.trim() })}
          >
            {t('repairs.status.cancelled', 'لغو')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>
            {t('repairs.close', 'انصراف')}
          </Button>
        </div>
      ) : null}

      {selectedTicketId ? (
        <RepairTicketWorkPanel
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      ) : null}

      {list.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {t('repairs.loadFailed', 'رسیدهای تعمیر خوانده نشد؛ این «خالی» نیست.')}
        </p>
      ) : (
        <div className="space-y-2">
          {(list.data?.tickets.length ?? 0) > 0
            ? (() => {
                const metrics = summarizeRepairMetrics(
                  (list.data?.tickets ?? []).map((ticket) => ({
                    status: ticket.status,
                    underWarranty: ticket.underWarranty,
                    createdAt: ticket.createdAt,
                    closedAt: ticket.closedAt,
                  })),
                )
                return (
                  <div className="flex flex-wrap gap-3 rounded-xl bg-[hsl(var(--surface-muted))] px-3 py-2 text-xs text-[hsl(var(--fg-secondary))]">
                    <span>
                      {t('repairs.open', 'باز')}: <b>{metrics.openTickets}</b>
                    </span>
                    <span>
                      {t('repairs.status.waiting_parts', 'منتظر قطعه')}:{' '}
                      <b>{metrics.waitingPartsTickets}</b>
                    </span>
                    <span>
                      {t('repairs.status.delivered', 'تحویل شد')}: <b>{metrics.deliveredTickets}</b>
                    </span>
                  </div>
                )
              })()
            : null}
          <DataTable
            tableId="repair-tickets"
            t={t}
            rows={list.data?.tickets ?? []}
            columns={columns}
            rowKey={(row) => row.id}
            actions={
              <div className="flex items-center gap-2">
                <TableFilterSelect
                  label={t('repairs.filter', 'وضعیت')}
                  value={filter}
                  allValue="open"
                  onChange={(v) => setFilter(v as RepairStatus | 'open')}
                  options={[
                    { value: 'open', label: t('repairs.open', 'باز') },
                    ...REPAIR_STATUSES.map((value) => ({
                      value,
                      label: t(`repairs.status.${value}`, value),
                    })),
                  ]}
                />
                {open ? null : (
                  <Button size="sm" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    {t('repairs.new', 'رسید تعمیر تازه')}
                  </Button>
                )}
              </div>
            }
            emptyState={
              <p className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                {t('repairs.empty', 'رسید تعمیری در این وضعیت نیست.')}
              </p>
            }
          />
        </div>
      )}
    </section>
  )
}
