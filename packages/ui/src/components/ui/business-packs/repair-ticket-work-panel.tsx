'use client'

import { useMemo, useState } from 'react'
import {
  useAddRepairPart,
  useApproveRepairTicket,
  useConsumeRepairPart,
  useCreateRepairBill,
  useMyCapabilities,
  useQualityEvents,
  useRecordQualityEvent,
  useReleaseRepairPart,
  useRepairTicket,
} from '@hisabche/api'
import { splitRepairInvoiceRevenue } from '@hisabche/validation'

import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'
import { refusalText } from '../../../lib/refusal-text'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import {
  LabeledSelect,
  labelOf,
  packCard,
  typedMinor,
  useMoneyText,
  usePackT,
  useProductOptions,
  useWarehouseOptions,
} from './pack-shared'

const PART_KNOWN = [
  'REPAIR_APPROVAL_REQUIRED',
  'REPAIR_TICKET_CLOSED',
  'REPAIR_ALREADY_BILLED',
  'REPAIR_BILL_NO_CHARGEABLE_LINES',
  'REPAIR_PART_NOT_RESERVED',
  'INSUFFICIENT_AVAILABLE_STOCK',
]

export function RepairTicketWorkPanel({
  ticketId,
  onClose,
}: {
  ticketId: string
  onClose: () => void
}) {
  const t = usePackT()
  const toast = useToast()
  const money = useMoneyText()
  const bookCurrency = useBookCurrency()
  const detail = useRepairTicket(ticketId)
  const approve = useApproveRepairTicket()
  const addPart = useAddRepairPart()
  const consumePart = useConsumeRepairPart()
  const releasePart = useReleaseRepairPart()
  const createBill = useCreateRepairBill()
  const capabilities = useMyCapabilities()
  const canInspect = capabilities.can('inventory.configure') === true
  const qualityEvents = useQualityEvents({ sourceType: 'repair', sourceId: ticketId })
  const recordQuality = useRecordQualityEvent()
  const warehouses = useWarehouseOptions()
  const goods = useProductOptions('goods')

  const [warehouseId, setWarehouseId] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [laborFee, setLaborFee] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit'>('cash')

  const ticket = detail.data
  const currency = ticket?.currency ?? bookCurrency ?? ''
  const qtyNum = Number(quantity)
  const partPriceMinor = unitPrice.trim() && currency ? typedMinor(unitPrice, currency) : undefined
  const laborMinor = laborFee.trim() && currency ? typedMinor(laborFee, currency) : undefined

  const splitPreview = useMemo(() => {
    const parts = ticket?.parts ?? []
    const lines: Array<{ offeringType: 'goods' | 'service' | 'package'; lineTotalMinor: number }> =
      parts
        .filter((p) => p.status === 'consumed' && p.unitPriceMinor > 0)
        .map((p) => ({
          offeringType: 'goods' as const,
          lineTotalMinor: Math.round(p.unitPriceMinor * p.quantity),
        }))
    const fallbackLabor = !ticket?.underWarranty ? (ticket?.estimateMinor ?? 0) : 0
    const effectiveLabor = laborMinor ?? fallbackLabor
    if (effectiveLabor > 0) {
      lines.push({ offeringType: 'service', lineTotalMinor: effectiveLabor })
    }
    return splitRepairInvoiceRevenue(lines)
  }, [ticket?.parts, ticket?.underWarranty, ticket?.estimateMinor, laborMinor])

  const fail = (fallback: string) => (error: unknown) =>
    toast.error(refusalText(error, t, 'repairs', PART_KNOWN, fallback))

  if (detail.isLoading) {
    return (
      <div className={packCard}>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('common.loading', 'در حال بارگذاری...')}
        </p>
      </div>
    )
  }

  if (detail.isError || !ticket) {
    return (
      <div className={packCard} role="alert">
        <p className="text-sm text-[hsl(var(--color-destructive))]">
          {t('repairs.loadFailed', 'رسید تعمیر خوانده نشد.')}
        </p>
      </div>
    )
  }

  const closed = ticket.status === 'delivered' || ticket.status === 'cancelled'
  const canReserve = Boolean(warehouseId && productId && Number.isFinite(qtyNum) && qtyNum > 0)

  return (
    <div className={`${packCard} space-y-4`} data-guide="repair-parts-work">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            #{ticket.number} — {ticket.deviceLabel}
          </h4>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {ticket.customerApproved
              ? t('repairs.approvedBadge', 'تایید مشتری ثبت شده است')
              : t('repairs.unapprovedBadge', 'نیاز به تایید مشتری پیش از مصرف قطعه')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!closed && !ticket.customerApproved ? (
            <Button
              size="sm"
              variant="outline"
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(ticket.id, {
                  onSuccess: () => toast.success(t('repairs.approved', 'تایید مشتری ثبت شد')),
                  onError: fail(t('repairs.moveFailed', 'انجام نشد')),
                })
              }
            >
              {t('repairs.approveAction', 'تایید مشتری')}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('common.close', 'بستن')}
          </Button>
        </div>
      </div>

      {!closed ? (
        <div className="grid gap-2 sm:grid-cols-5">
          <LabeledSelect
            name="partWarehouseId"
            label={t('warehouse.label', 'انبار')}
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses}
          />
          <LabeledSelect
            name="partProductId"
            label={t('repairs.partProduct', 'قطعه یدکی')}
            value={productId}
            onChange={setProductId}
            options={goods}
          />
          <Input
            name="partQuantity"
            inputMode="decimal"
            value={quantity}
            placeholder={t('common.quantity', 'تعداد')}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            name="partPrice"
            inputMode="decimal"
            value={unitPrice}
            placeholder={`${t('repairs.partUnitPrice', 'قیمت واحد')} (${currency})`}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!canReserve || addPart.isPending}
            onClick={() => {
              if (!canReserve) return
              addPart.mutate(
                {
                  ticketId: ticket.id,
                  warehouseId,
                  productId,
                  quantity: qtyNum,
                  ...(partPriceMinor !== undefined && partPriceMinor !== null
                    ? { unitPriceMinor: partPriceMinor }
                    : {}),
                  ...(currency ? { currency } : {}),
                },
                {
                  onSuccess: () => {
                    toast.success(t('repairs.partReserved', 'قطعه از موجودی آزاد رزرو شد'))
                    setProductId('')
                    setQuantity('1')
                    setUnitPrice('')
                  },
                  onError: fail(t('repairs.partReserveFailed', 'رزرو قطعه انجام نشد')),
                },
              )
            }}
          >
            {t('repairs.reservePart', 'رزرو قطعه')}
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
          {t('repairs.partsTitle', 'قطعات یدکی این تعمیر')}
        </p>
        {(ticket.parts ?? []).length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('repairs.partsEmpty', 'هنوز قطعه‌ای برای این تعمیر ثبت نشده است.')}
          </p>
        ) : (
          <ul className="space-y-2">
            {(ticket.parts ?? []).map((part) => (
              <li
                key={part.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border-default))] px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium">{labelOf(goods, part.productId)}</span> ·{' '}
                  <span className="tabular-nums">{part.quantity}</span> ·{' '}
                  <span>{money(part.unitPriceMinor, part.currency)}</span> ·{' '}
                  <span>{part.status}</span>
                </div>
                {part.status === 'reserved' && !closed ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      disabled={consumePart.isPending}
                      onClick={() =>
                        consumePart.mutate(
                          { ticketId: ticket.id, partId: part.id },
                          {
                            onSuccess: () =>
                              toast.success(
                                t('repairs.partConsumed', 'قطعه مصرف و از انبار کسر شد'),
                              ),
                            onError: fail(t('repairs.partConsumeFailed', 'مصرف قطعه مجاز نیست')),
                          },
                        )
                      }
                    >
                      {t('repairs.consumePart', 'مصرف قطعه')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={releasePart.isPending}
                      onClick={() =>
                        releasePart.mutate(
                          { ticketId: ticket.id, partId: part.id },
                          {
                            onSuccess: () =>
                              toast.success(t('repairs.partReleased', 'رزرو قطعه آزاد شد')),
                            onError: fail(t('repairs.moveFailed', 'انجام نشد')),
                          },
                        )
                      }
                    >
                      {t('repairs.releasePart', 'آزادسازی')}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[hsl(var(--border-default))] pt-3">
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-[hsl(var(--fg-secondary))]">
          <span>
            {t('repairs.partsRevenue', 'سهم قطعات')}:{' '}
            <b>{currency ? money(splitPreview.partsRevenueMinor, currency) : '—'}</b>
          </span>
          <span>
            {t('repairs.laborRevenue', 'سهم اجرت')}:{' '}
            <b>{currency ? money(splitPreview.laborRevenueMinor, currency) : '—'}</b>
          </span>
          <span>
            {t('repairs.totalBill', 'جمع صورت‌حساب')}:{' '}
            <b>{currency ? money(splitPreview.totalRevenueMinor, currency) : '—'}</b>
          </span>
        </div>
        {!ticket.invoiceId && ticket.status !== 'cancelled' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              name="laborFee"
              inputMode="decimal"
              value={laborFee}
              placeholder={`${t('repairs.laborFee', 'اجرت تعمیر')} (${currency})`}
              onChange={(e) => setLaborFee(e.target.value)}
            />
            <SelectField
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as 'cash' | 'bank' | 'credit')}
              options={[
                { value: 'cash', label: t('paymentMethod.cash', 'نقد') },
                { value: 'bank', label: t('paymentMethod.bank', 'بانک') },
                { value: 'credit', label: t('paymentMethod.credit', 'نسیه') },
              ]}
              className="w-36"
            />
            <Button
              size="sm"
              disabled={splitPreview.totalRevenueMinor <= 0 || createBill.isPending}
              onClick={() =>
                createBill.mutate(
                  {
                    ticketId: ticket.id,
                    ...(laborMinor !== undefined && laborMinor !== null
                      ? { laborFeeMinor: laborMinor }
                      : {}),
                    paymentMethod,
                    ...(paymentMethod === 'credit' ? { paidAmount: 0 } : {}),
                  },
                  {
                    onSuccess: () =>
                      toast.success(
                        t('repairs.billCreated', 'صورت‌حساب نهایی تعمیر در سیستم فاکتور صادر شد'),
                      ),
                    onError: fail(t('repairs.billFailed', 'صدور صورت‌حساب انجام نشد')),
                  },
                )
              }
            >
              {t('repairs.createFinalBill', 'صدور صورت‌حساب نهایی')}
            </Button>
          </div>
        ) : ticket.invoiceId ? (
          <p className="text-xs text-[hsl(var(--color-success))]">
            {t('repairs.billedInvoice', 'فاکتور صادر شده')}:{' '}
            <span className="font-mono">{ticket.invoiceId}</span>
          </p>
        ) : null}
      </div>

      <div className="border-t border-[hsl(var(--border-default))] pt-3 space-y-2">
        <h5 className="text-xs font-semibold text-[hsl(var(--fg-primary))]">
          {t('repairs.qualityTestingTitle', 'آزمایش و کنترل کیفیت تعمیر')}
        </h5>
        {qualityEvents.isError ? (
          <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
            {t('repairs.loadFailed', 'رسید تعمیر خوانده نشد.')}
          </p>
        ) : (qualityEvents.data ?? []).length === 0 ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('repairs.qualityEmpty', 'هنوز آزمایشی ثبت نشده است.')}
          </p>
        ) : (
          <ul className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
            {(qualityEvents.data ?? []).slice(0, 5).map((ev) => (
              <li key={ev.id}>
                {ev.event_kind}
                {ev.notes ? ` — ${ev.notes}` : ''}
              </li>
            ))}
          </ul>
        )}
        {!closed && canInspect ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={recordQuality.isPending}
              onClick={() =>
                recordQuality.mutate(
                  {
                    sourceType: 'repair',
                    sourceId: ticket.id,
                    eventKind: 'pass',
                  },
                  {
                    onSuccess: () =>
                      toast.success(t('repairs.qualityPassed', 'آزمایش کیفیت تایید شد')),
                    onError: fail(t('repairs.moveFailed', 'انجام نشد')),
                  },
                )
              }
            >
              {t('repairs.qualityPass', 'تایید آزمایش')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={recordQuality.isPending}
              onClick={() =>
                recordQuality.mutate(
                  {
                    sourceType: 'repair',
                    sourceId: ticket.id,
                    eventKind: 'rework',
                  },
                  {
                    onSuccess: () =>
                      toast.success(t('repairs.qualityRework', 'نیاز به بازکاری ثبت شد')),
                    onError: fail(t('repairs.moveFailed', 'انجام نشد')),
                  },
                )
              }
            >
              {t('repairs.qualityFailRework', 'رد و بازکاری')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
