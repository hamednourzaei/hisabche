'use client'

// ============================================
// packages/ui/src/components/ui/invoices/containers/sales-orders-container.tsx
//
// V60 Slice 6 — Sales Orders + Delivery Dispatch (?tab=orders & ?view=delivery)
// Mounted inside SalesHubContainer (/invoices). Reuses shared DataTable,
// SegmentedControl, Button, Input, SelectField and PaymentsService-backed COD settle.
// ============================================

import { memo, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toIsoDay } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useCancelSalesOrder,
  useConfirmSalesOrder,
  useCourierDeliveries,
  useCreateCourierDelivery,
  useCreateDeliveryNote,
  useCreateFreightTrip,
  useCreateSalesOrder,
  useDeliveryNotes,
  useFreightTrips,
  useFulfillSalesOrder,
  useInvoiceSalesOrder,
  useProgressCourierCod,
  useRecordDeliveryPod,
  useSalesOrders,
  useSettleCourierCod,
  type CourierDeliveryRecord,
  type DeliveryNoteRecord,
  type FreightTripRecord,
  type SalesOrderRow,
} from '@hisabche/api'

import { useHubSection } from '../../hub-tabs'
import { Button } from '../../button'
import { Input } from '../../input'
import { DataTable, type TableColumn } from '../../data-table'
import { SegmentedControl } from '../../segmented-control'
import { SelectField } from '../../select-field'
import { useToast } from '../../toast-provider'

export const ORDER_VIEWS = ['orders', 'delivery'] as const
export type OrderSubView = (typeof ORDER_VIEWS)[number]

export const SalesOrdersContainer = memo(function SalesOrdersContainer() {
  const translate = useTranslations()
  const toast = useToast()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    } catch {
      return fallback ?? key
    }
  }

  const [view, setView] = useHubSection(ORDER_VIEWS)
  const [statusFilter, setStatusFilter] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')

  // Delivery / dispatch state
  const [tripOrigin, setTripOrigin] = useState('')
  const [tripDestination, setTripDestination] = useState('')
  const [tripStartDate, setTripStartDate] = useState(() => toIsoDay(new Date()))
  const [courierTracking, setCourierTracking] = useState('')
  const [courierCustomer, setCourierCustomer] = useState('')
  const [courierAddress, setCourierAddress] = useState('')
  const [courierCodMinor, setCourierCodMinor] = useState('')
  const [podNoteId, setPodNoteId] = useState('')
  const [podRecipient, setPodRecipient] = useState('')
  const [settleInvoiceId, setSettleInvoiceId] = useState('')

  const ordersQuery = useSalesOrders(statusFilter ? { status: statusFilter } : undefined)
  const createOrder = useCreateSalesOrder()
  const confirmOrder = useConfirmSalesOrder()
  const cancelOrder = useCancelSalesOrder()
  const fulfillOrder = useFulfillSalesOrder()
  const invoiceOrder = useInvoiceSalesOrder()

  const tripsQuery = useFreightTrips()
  const createTrip = useCreateFreightTrip()
  const courierQuery = useCourierDeliveries()
  const createCourier = useCreateCourierDelivery()
  const progressCod = useProgressCourierCod()
  const settleCod = useSettleCourierCod()
  const notesQuery = useDeliveryNotes()
  const createNote = useCreateDeliveryNote()
  const recordPod = useRecordDeliveryPod()

  const orders = ordersQuery.data?.orders ?? []
  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(
      (o) =>
        (o.order_number ?? '').toLowerCase().includes(q) ||
        (o.customer_name ?? '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    )
  }, [orderSearch, orders])

  const onActionError = (err: unknown) =>
    toast.error(apiErrorMessage(err, t('common.failed', 'خطا')))

  const orderColumns: TableColumn<SalesOrderRow>[] = [
    {
      id: 'orderNumber',
      labelKey: 'salesHub.orders.number',
      labelFallback: 'سفارش',
      locked: true,
      render: (row) => (
        <span className="font-medium">{row.order_number ?? row.id.slice(0, 8)}</span>
      ),
    },
    {
      id: 'customer',
      labelKey: 'common.customer',
      labelFallback: 'مشتری',
      render: (row) => <span>{row.customer_name ?? '—'}</span>,
    },
    {
      id: 'status',
      labelKey: 'common.status',
      labelFallback: 'وضعیت',
      render: (row) => <span className="text-xs">{row.status}</span>,
    },
    {
      id: 'total',
      labelKey: 'common.total',
      labelFallback: 'جمع',
      align: 'end',
      render: (row) => (
        <span dir="ltr" className="tabular-nums">
          {String(row.total)} {row.currency ?? ''}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'common.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          {row.status === 'pending' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={confirmOrder.isPending}
              onClick={() => confirmOrder.mutate(row.id, { onError: onActionError })}
            >
              {t('salesHub.orders.confirm', 'تایید')}
            </Button>
          ) : null}
          {row.status === 'confirmed' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={fulfillOrder.isPending}
              onClick={() => fulfillOrder.mutate(row.id, { onError: onActionError })}
            >
              {t('salesHub.orders.fulfill', 'ارسال')}
            </Button>
          ) : null}
          {(row.status === 'confirmed' || row.status === 'fulfilled') && !row.invoice_id ? (
            <Button
              type="button"
              size="sm"
              disabled={invoiceOrder.isPending}
              onClick={() => invoiceOrder.mutate({ id: row.id }, { onError: onActionError })}
            >
              {t('salesHub.orders.invoice', 'صدور فاکتور')}
            </Button>
          ) : null}
          {row.status !== 'cancelled' && !row.invoice_id ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={cancelOrder.isPending}
              onClick={() => cancelOrder.mutate({ id: row.id }, { onError: onActionError })}
            >
              {t('common.cancel', 'لغو')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const tripColumns: TableColumn<FreightTripRecord>[] = [
    {
      id: 'route',
      labelKey: 'salesHub.delivery.route',
      labelFallback: 'مسیر',
      locked: true,
      render: (trip) => (
        <span>
          {trip.origin} → {trip.destination}
        </span>
      ),
    },
    {
      id: 'startDate',
      labelKey: 'common.date',
      labelFallback: 'تاریخ',
      render: (trip) => <span dir="ltr">{trip.startDate}</span>,
    },
  ]

  const courierColumns: TableColumn<CourierDeliveryRecord>[] = [
    {
      id: 'tracking',
      labelKey: 'salesHub.delivery.tracking',
      labelFallback: 'کد پیگیری',
      locked: true,
      render: (item) => <span className="font-mono text-xs">{item.trackingNumber}</span>,
    },
    {
      id: 'customer',
      labelKey: 'common.customer',
      labelFallback: 'گیرنده',
      render: (item) => <span>{item.customerName}</span>,
    },
    {
      id: 'cod',
      labelKey: 'salesHub.delivery.cod',
      labelFallback: 'پرداخت در محل',
      render: (item) => (
        <span dir="ltr" className="tabular-nums">
          {item.codAmountMinor ?? 0}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'common.actions',
      labelFallback: 'عملیات',
      align: 'end',
      locked: true,
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={progressCod.isPending}
            onClick={() => progressCod.mutate(item.id, { onError: onActionError })}
          >
            {t('salesHub.delivery.progressCod', 'به‌روزرسانی COD')}
          </Button>
          {settleInvoiceId.trim() ? (
            <Button
              type="button"
              size="sm"
              disabled={settleCod.isPending}
              onClick={() =>
                settleCod.mutate(
                  { deliveryId: item.id, invoiceId: settleInvoiceId.trim(), method: 'cash' },
                  { onError: onActionError },
                )
              }
            >
              {t('salesHub.delivery.settleCod', 'تسویه COD')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const noteColumns: TableColumn<DeliveryNoteRecord>[] = [
    {
      id: 'noteNumber',
      labelKey: 'salesHub.delivery.noteNumber',
      labelFallback: 'رسید تحویل',
      locked: true,
      render: (note) => <span className="font-medium">{note.noteNumber}</span>,
    },
    {
      id: 'date',
      labelKey: 'common.date',
      labelFallback: 'تاریخ',
      render: (note) => <span dir="ltr">{note.deliveryDate}</span>,
    },
    {
      id: 'pod',
      labelKey: 'salesHub.delivery.pod',
      labelFallback: 'تایید تحویل',
      align: 'end',
      locked: true,
      render: (note) => (
        <Button type="button" size="sm" variant="outline" onClick={() => setPodNoteId(note.id)}>
          {t('salesHub.delivery.recordPod', 'ثبت تحویل')}
        </Button>
      ),
    },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label={t('salesHub.orders.viewLabel', 'بخش سفارش و ارسال')}
          value={view}
          onChange={setView}
          options={[
            { value: 'orders', label: t('salesHub.tabs.orders', 'سفارش‌ها') },
            { value: 'delivery', label: t('salesHub.tabs.delivery', 'تحویل و لجستیک') },
          ]}
        />
      </div>

      {view === 'orders' ? (
        <div className="space-y-4">
          <form
            className="grid gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault()
              const qty = Number(quantity)
              const price = Number(unitPrice)
              if (
                !productName.trim() ||
                !Number.isFinite(qty) ||
                qty <= 0 ||
                !Number.isFinite(price)
              ) {
                return
              }
              createOrder.mutate(
                {
                  customerName: customerName.trim() || undefined,
                  items: [{ productName: productName.trim(), quantity: qty, unitPrice: price }],
                },
                {
                  onSuccess: () => {
                    setCustomerName('')
                    setProductName('')
                    setQuantity('1')
                    setUnitPrice('')
                  },
                  onError: onActionError,
                },
              )
            }}
          >
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('common.customer', 'نام مشتری')}
            />
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t('common.product', 'قلم یا خدمت')}
            />
            <Input
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={t('common.quantity', 'تعداد')}
            />
            <Input
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder={t('common.price', 'قیمت واحد')}
            />
            <Button type="submit" size="sm" disabled={createOrder.isPending}>
              {t('salesHub.orders.create', 'ثبت سفارش')}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: t('common.all', 'همه') },
                { value: 'pending', label: t('salesHub.orders.pending', 'در انتظار') },
                { value: 'confirmed', label: t('salesHub.orders.confirmed', 'تاییدشده') },
                { value: 'fulfilled', label: t('salesHub.orders.fulfilled', 'تحویل‌شده') },
                { value: 'cancelled', label: t('salesHub.orders.cancelled', 'لغوشده') },
              ]}
              className="w-40"
            />
          </div>

          {ordersQuery.isError ? (
            <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
              {t('salesHub.orders.loadFailed', 'سفارش‌ها خوانده نشدند')}
            </p>
          ) : null}

          <DataTable<SalesOrderRow>
            tableId="sales-orders"
            t={t}
            rows={filteredOrders}
            columns={orderColumns}
            rowKey={(r) => r.id}
            searchValue={orderSearch}
            onSearchChange={setOrderSearch}
            emptyState={
              <p className="p-4 text-xs text-[hsl(var(--fg-tertiary))]">
                {ordersQuery.isLoading
                  ? t('common.loading', 'در حال بارگذاری…')
                  : t('salesHub.orders.empty', 'سفارشی ثبت نشده است.')}
              </p>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <form
            className="grid gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!tripOrigin.trim() || !tripDestination.trim()) return
              createTrip.mutate(
                {
                  origin: tripOrigin.trim(),
                  destination: tripDestination.trim(),
                  startDate: tripStartDate,
                },
                {
                  onSuccess: () => {
                    setTripOrigin('')
                    setTripDestination('')
                  },
                  onError: onActionError,
                },
              )
            }}
          >
            <Input
              value={tripOrigin}
              onChange={(e) => setTripOrigin(e.target.value)}
              placeholder={t('salesHub.delivery.origin', 'مبدا')}
            />
            <Input
              value={tripDestination}
              onChange={(e) => setTripDestination(e.target.value)}
              placeholder={t('salesHub.delivery.destination', 'مقصد')}
            />
            <Input
              type="date"
              value={tripStartDate}
              onChange={(e) => setTripStartDate(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={createTrip.isPending}>
              {t('salesHub.delivery.createTrip', 'ثبت سفر بار')}
            </Button>
          </form>

          <DataTable<FreightTripRecord>
            tableId="freight-trips"
            t={t}
            rows={tripsQuery.data ?? []}
            columns={tripColumns}
            rowKey={(r) => r.id}
            emptyState={
              <p className="p-4 text-xs text-[hsl(var(--fg-tertiary))]">
                {tripsQuery.isLoading
                  ? t('common.loading', 'در حال بارگذاری…')
                  : t('common.noData', 'موردی ثبت نشده است')}
              </p>
            }
          />

          <form
            className="grid gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!courierTracking.trim() || !courierCustomer.trim() || !courierAddress.trim())
                return
              const cod = courierCodMinor.trim() ? Number(courierCodMinor) : 0
              createCourier.mutate(
                {
                  trackingNumber: courierTracking.trim(),
                  customerName: courierCustomer.trim(),
                  destinationAddress: courierAddress.trim(),
                  codAmountMinor: Number.isFinite(cod) ? Math.trunc(cod) : 0,
                },
                {
                  onSuccess: () => {
                    setCourierTracking('')
                    setCourierCustomer('')
                    setCourierAddress('')
                    setCourierCodMinor('')
                  },
                  onError: onActionError,
                },
              )
            }}
          >
            <Input
              value={courierTracking}
              onChange={(e) => setCourierTracking(e.target.value)}
              placeholder={t('salesHub.delivery.tracking', 'کد پیگیری')}
            />
            <Input
              value={courierCustomer}
              onChange={(e) => setCourierCustomer(e.target.value)}
              placeholder={t('common.customer', 'گیرنده')}
            />
            <Input
              value={courierAddress}
              onChange={(e) => setCourierAddress(e.target.value)}
              placeholder={t('common.address', 'آدرس')}
            />
            <Input
              inputMode="numeric"
              value={courierCodMinor}
              onChange={(e) => setCourierCodMinor(e.target.value)}
              placeholder={t('salesHub.delivery.codMinor', 'مبلغ COD (جزء)')}
            />
            <Button type="submit" size="sm" disabled={createCourier.isPending}>
              {t('salesHub.delivery.createCourier', 'ثبت مرسوله')}
            </Button>
          </form>

          <Input
            value={settleInvoiceId}
            onChange={(e) => setSettleInvoiceId(e.target.value)}
            placeholder={t('salesHub.delivery.settleInvoiceId', 'شناسه فاکتور برای تسویه COD')}
            className="max-w-sm"
          />

          <DataTable<CourierDeliveryRecord>
            tableId="courier-deliveries"
            t={t}
            rows={courierQuery.data ?? []}
            columns={courierColumns}
            rowKey={(r) => r.id}
            emptyState={
              <p className="p-4 text-xs text-[hsl(var(--fg-tertiary))]">
                {courierQuery.isLoading
                  ? t('common.loading', 'در حال بارگذاری…')
                  : t('common.noData', 'موردی ثبت نشده است')}
              </p>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!settleInvoiceId.trim() || createNote.isPending}
              onClick={() => {
                if (!settleInvoiceId.trim()) return
                createNote.mutate(
                  {
                    invoiceId: settleInvoiceId.trim(),
                    noteNumber: `DN-${Date.now().toString().slice(-6)}`,
                    deliveryDate: toIsoDay(new Date()),
                    lines: [],
                  },
                  { onError: onActionError },
                )
              }}
            >
              {t('salesHub.delivery.createNote', 'ایجاد رسید تحویل')}
            </Button>
            {podNoteId ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!podRecipient.trim()) return
                  recordPod.mutate(
                    { noteId: podNoteId, recipientName: podRecipient.trim() },
                    {
                      onSuccess: () => {
                        setPodNoteId('')
                        setPodRecipient('')
                      },
                      onError: onActionError,
                    },
                  )
                }}
              >
                <Input
                  value={podRecipient}
                  onChange={(e) => setPodRecipient(e.target.value)}
                  placeholder={t('salesHub.delivery.podRecipient', 'نام تحویل‌گیرنده')}
                />
                <Button type="submit" size="sm" disabled={recordPod.isPending}>
                  {t('salesHub.delivery.confirmPod', 'ثبت تایید تحویل')}
                </Button>
              </form>
            ) : null}
          </div>

          <DataTable<DeliveryNoteRecord>
            tableId="delivery-notes"
            t={t}
            rows={notesQuery.data ?? []}
            columns={noteColumns}
            rowKey={(r) => r.id}
            emptyState={
              <p className="p-4 text-xs text-[hsl(var(--fg-tertiary))]">
                {notesQuery.isLoading
                  ? t('common.loading', 'در حال بارگذاری…')
                  : t('common.noData', 'موردی ثبت نشده است')}
              </p>
            }
          />
        </div>
      )}
    </section>
  )
})

SalesOrdersContainer.displayName = 'SalesOrdersContainer'
