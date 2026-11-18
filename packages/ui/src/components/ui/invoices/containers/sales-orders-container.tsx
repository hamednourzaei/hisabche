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
  useAcceptSalesOrderQuote,
  useCancelSalesOrder,
  useConfirmSalesOrder,
  useCourierDeliveries,
  useAssignCourierDelivery,
  useCloseCourierDelivery,
  useCreateCourierDelivery,
  useCreateDeliveryNote,
  useCreateDeliveryVehicle,
  useCreateFreightTrip,
  useCreateSalesOrder,
  useDeliverSalesOrder,
  useDeliveryFleet,
  useDeliveryNotes,
  useFreightTrips,
  useFulfillSalesOrder,
  useInvoiceSalesOrder,
  useProgressCourierCod,
  useRecordDeliveryPod,
  useRecordVehicleService,
  useSalesOrders,
  useSettleCourierCod,
  type CourierDeliveryRecord,
  type DeliveryNoteRecord,
  type DeliveryVehicleRecord,
  type FreightTripRecord,
  type SalesOrderRow,
} from '@hisabche/api'

import { deriveOrderLineQuantities } from '@hisabche/validation'
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
  const [podMethod, setPodMethod] = useState<'signature' | 'photo' | 'code'>('signature')
  const [podCode, setPodCode] = useState('')
  const [podPhotoRef, setPodPhotoRef] = useState('')
  // WP-19 dispatch & closing state
  const [dispatchDay, setDispatchDay] = useState(() => toIsoDay(new Date()))
  const [vehicleName, setVehicleName] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleCapacity, setVehicleCapacity] = useState('')
  const [closeDeliveryId, setCloseDeliveryId] = useState('')
  const [closeOutcome, setCloseOutcome] = useState<'delivered' | 'failed'>('delivered')
  const [closeRecipient, setCloseRecipient] = useState('')
  const [closeMethod, setCloseMethod] = useState<'signature' | 'photo' | 'code'>('signature')
  const [closeCode, setCloseCode] = useState('')
  const [closePhotoRef, setClosePhotoRef] = useState('')
  const [closeCollected, setCloseCollected] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [assignVehicleId, setAssignVehicleId] = useState('')
  const [assignSelectedVehicle, setAssignSelectedVehicle] = useState('')
  const [settleInvoiceId, setSettleInvoiceId] = useState('')

  const ordersQuery = useSalesOrders(statusFilter ? { status: statusFilter } : undefined)
  const createOrder = useCreateSalesOrder()
  const confirmOrder = useConfirmSalesOrder()
  const acceptQuote = useAcceptSalesOrderQuote()
  const deliverOrder = useDeliverSalesOrder()
  const cancelOrder = useCancelSalesOrder()
  const fulfillOrder = useFulfillSalesOrder()
  const invoiceOrder = useInvoiceSalesOrder()

  const tripsQuery = useFreightTrips()
  const createTrip = useCreateFreightTrip()
  const courierQuery = useCourierDeliveries()
  const createCourier = useCreateCourierDelivery()
  const progressCod = useProgressCourierCod()
  const settleCod = useSettleCourierCod()
  const fleetQuery = useDeliveryFleet(dispatchDay)
  const createVehicle = useCreateDeliveryVehicle()
  const recordService = useRecordVehicleService()
  const assignDelivery = useAssignCourierDelivery()
  const closeDelivery = useCloseCourierDelivery()
  const notesQuery = useDeliveryNotes()
  const createNote = useCreateDeliveryNote()
  const recordPod = useRecordDeliveryPod()

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data])
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
      render: (row) => {
        const backorderTotal = (row.items ?? []).reduce(
          (sum, line) =>
            sum +
            deriveOrderLineQuantities({
              orderedQuantity: Number(line.quantity ?? 0),
              reservedQuantity: Number(line.reserved_quantity ?? 0),
              deliveredQuantity: Number(line.delivered_quantity ?? 0),
            }).backorderedQuantity,
          0,
        )
        return (
          <span className="text-xs">
            {row.status}
            {backorderTotal > 0
              ? ` (${t('salesHub.orders.backordered', 'کسری')}: ${backorderTotal})`
              : ''}
          </span>
        )
      },
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
          {row.status === 'quoted' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={acceptQuote.isPending}
              onClick={() => acceptQuote.mutate({ id: row.id }, { onError: onActionError })}
            >
              {t('salesHub.orders.acceptQuote', 'تایید پیش‌فاکتور')}
            </Button>
          ) : null}
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
          {(row.status === 'confirmed' || row.status === 'partially_fulfilled') &&
          row.warehouse_id &&
          (row.items ?? []).some(
            (l) => l.id && Number(l.quantity) > Number(l.delivered_quantity ?? 0),
          ) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={deliverOrder.isPending}
              onClick={() => {
                const lines = (row.items ?? [])
                  .filter((l) => l.id && Number(l.quantity) > Number(l.delivered_quantity ?? 0))
                  .map((l) => ({
                    orderItemId: l.id!,
                    quantity: Number(l.quantity) - Number(l.delivered_quantity ?? 0),
                  }))
                if (lines.length === 0 || !row.warehouse_id) return
                deliverOrder.mutate(
                  {
                    id: row.id,
                    warehouseId: row.warehouse_id,
                    idempotencyKey: `ui-del-${row.id}-${Date.now()}`,
                    lines,
                  },
                  { onError: onActionError },
                )
              }}
            >
              {t('salesHub.orders.deliver', 'تحویل')}
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
      id: 'status',
      labelKey: 'common.status',
      labelFallback: 'وضعیت',
      render: (item) => <span>{item.status}</span>,
    },
    {
      id: 'cod',
      labelKey: 'salesHub.delivery.cod',
      labelFallback: 'پرداخت در محل',
      render: (item) => (
        <span dir="ltr" className="tabular-nums">
          {item.codAmountMinor ?? 0}
          {item.codShortfallMinor ? ` (−${item.codShortfallMinor})` : ''}
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
          {(item.status === 'unassigned' || item.status === 'assigned') &&
          (fleetQuery.data?.length ?? 0) > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAssignVehicleId(item.id)
                setCloseDeliveryId('')
              }}
            >
              {t('salesHub.delivery.assign', 'تخصیص خودرو')}
            </Button>
          ) : null}
          {item.status !== 'delivered' && item.status !== 'failed' && item.status !== 'returned' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCloseDeliveryId(item.id)
                setAssignVehicleId('')
              }}
            >
              {t('salesHub.delivery.close', 'بستن تحویل')}
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

          {/* WP-19 — Fleet & dispatch */}
          <div className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3">
            <h3 className="text-sm font-medium">
              {t('salesHub.delivery.fleetTitle', 'ناوگان تحویل')}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={dispatchDay}
                onChange={(e) => setDispatchDay(e.target.value)}
              />
            </div>
            <form
              className="grid gap-2 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!vehicleName.trim()) return
                const capacity = vehicleCapacity.trim() ? Number(vehicleCapacity) : undefined
                createVehicle.mutate(
                  {
                    name: vehicleName.trim(),
                    ...(vehiclePlate.trim() ? { plateNumber: vehiclePlate.trim() } : {}),
                    ...(capacity !== undefined && Number.isFinite(capacity)
                      ? { capacityParcels: Math.trunc(capacity) }
                      : {}),
                  },
                  {
                    onSuccess: () => {
                      setVehicleName('')
                      setVehiclePlate('')
                      setVehicleCapacity('')
                    },
                    onError: onActionError,
                  },
                )
              }}
            >
              <Input
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder={t('salesHub.delivery.vehicleName', 'نام خودرو')}
              />
              <Input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                placeholder={t('salesHub.delivery.vehiclePlate', 'پلاک')}
              />
              <Input
                inputMode="numeric"
                value={vehicleCapacity}
                onChange={(e) => setVehicleCapacity(e.target.value)}
                placeholder={t('salesHub.delivery.vehicleCapacity', 'ظرفیت بسته در روز')}
              />
              <Button type="submit" size="sm" disabled={createVehicle.isPending}>
                {t('salesHub.delivery.addVehicle', 'افزودن خودرو')}
              </Button>
            </form>
            <DataTable<DeliveryVehicleRecord>
              tableId="delivery-fleet"
              t={t}
              rows={fleetQuery.data ?? []}
              rowKey={(r) => r.id}
              columns={[
                {
                  id: 'name',
                  labelKey: 'salesHub.delivery.vehicleName',
                  labelFallback: 'نام خودرو',
                  locked: true,
                  render: (v) => <span>{v.name}</span>,
                },
                {
                  id: 'plate',
                  labelKey: 'salesHub.delivery.vehiclePlate',
                  labelFallback: 'پلاک',
                  render: (v) => <span dir="ltr">{v.plateNumber ?? '—'}</span>,
                },
                {
                  id: 'service',
                  labelKey: 'salesHub.delivery.serviceState',
                  labelFallback: 'وضعیت سرویس',
                  render: (v) => <span>{v.serviceState ?? 'unknown'}</span>,
                },
                {
                  id: 'assigned',
                  labelKey: 'salesHub.delivery.assignedOnDate',
                  labelFallback: 'تخصیص امروز',
                  render: (v) => (
                    <span dir="ltr" className="tabular-nums">
                      {v.assignedOnDate ?? 0}
                      {v.capacityParcels ? ` / ${v.capacityParcels}` : ''}
                    </span>
                  ),
                },
                {
                  id: 'serviceAction',
                  labelKey: 'common.actions',
                  labelFallback: 'عملیات',
                  align: 'end',
                  render: (v) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={recordService.isPending}
                      onClick={() =>
                        recordService.mutate(
                          { vehicleId: v.id, serviceOn: dispatchDay },
                          { onError: onActionError },
                        )
                      }
                    >
                      {t('salesHub.delivery.recordService', 'ثبت سرویس')}
                    </Button>
                  ),
                },
              ]}
              emptyState={
                <p className="p-4 text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('common.noData', 'موردی ثبت نشده است')}
                </p>
              }
            />
          </div>

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

          {assignVehicleId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3">
              <span className="text-xs">{t('salesHub.delivery.assignTitle', 'تخصیص خودرو')}</span>
              <div className="w-48">
                <SelectField
                  value={assignSelectedVehicle}
                  onChange={setAssignSelectedVehicle}
                  placeholder={t('salesHub.delivery.selectVehicle', 'انتخاب خودرو')}
                  options={(fleetQuery.data ?? []).map((v) => ({
                    value: v.id,
                    label: v.plateNumber ? `${v.name} (${v.plateNumber})` : v.name,
                  }))}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!assignSelectedVehicle || assignDelivery.isPending}
                onClick={() =>
                  assignDelivery.mutate(
                    {
                      deliveryId: assignVehicleId,
                      vehicleId: assignSelectedVehicle,
                      plannedOn: dispatchDay,
                    },
                    {
                      onSuccess: () => {
                        setAssignVehicleId('')
                        setAssignSelectedVehicle('')
                      },
                      onError: onActionError,
                    },
                  )
                }
              >
                {t('common.save', 'ذخیره')}
              </Button>
            </div>
          ) : null}

          {closeDeliveryId ? (
            <form
              className="grid gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (closeOutcome === 'delivered') {
                  if (!closeRecipient.trim()) return
                  closeDelivery.mutate(
                    {
                      deliveryId: closeDeliveryId,
                      outcome: 'delivered',
                      pod: {
                        method: closeMethod,
                        recipientName: closeRecipient.trim(),
                        ...(closeCode.trim() ? { code: closeCode.trim() } : {}),
                        ...(closePhotoRef.trim() ? { photoRef: closePhotoRef.trim() } : {}),
                      },
                      ...(closeCollected.trim()
                        ? { collectedMinor: Math.trunc(Number(closeCollected)) }
                        : {}),
                    },
                    {
                      onSuccess: () => {
                        setCloseDeliveryId('')
                        setCloseRecipient('')
                        setCloseCode('')
                        setClosePhotoRef('')
                        setCloseCollected('')
                      },
                      onError: onActionError,
                    },
                  )
                } else {
                  if (!closeReason.trim()) return
                  closeDelivery.mutate(
                    {
                      deliveryId: closeDeliveryId,
                      outcome: 'failed',
                      failureReason: closeReason.trim(),
                    },
                    {
                      onSuccess: () => {
                        setCloseDeliveryId('')
                        setCloseReason('')
                      },
                      onError: onActionError,
                    },
                  )
                }
              }}
            >
              <SelectField
                value={closeOutcome}
                onChange={(value) => setCloseOutcome(value as 'delivered' | 'failed')}
                options={[
                  { value: 'delivered', label: t('salesHub.delivery.delivered', 'تحویل شد') },
                  { value: 'failed', label: t('salesHub.delivery.failed', 'تحویل ناموفق') },
                ]}
              />
              {closeOutcome === 'delivered' ? (
                <>
                  <Input
                    value={closeRecipient}
                    onChange={(e) => setCloseRecipient(e.target.value)}
                    placeholder={t('salesHub.delivery.podRecipient', 'نام تحویلگیرنده')}
                  />
                  <SelectField
                    value={closeMethod}
                    onChange={(value) => setCloseMethod(value as 'signature' | 'photo' | 'code')}
                    options={[
                      { value: 'signature', label: t('salesHub.delivery.signature', 'امضا') },
                      { value: 'photo', label: t('salesHub.delivery.photo', 'عکس') },
                      { value: 'code', label: t('salesHub.delivery.code', 'کد') },
                    ]}
                  />
                  {closeMethod === 'code' ? (
                    <Input
                      value={closeCode}
                      onChange={(e) => setCloseCode(e.target.value)}
                      placeholder={t('salesHub.delivery.podCode', 'کد تحویل')}
                    />
                  ) : null}
                  {closeMethod === 'photo' ? (
                    <Input
                      value={closePhotoRef}
                      onChange={(e) => setClosePhotoRef(e.target.value)}
                      placeholder={t('salesHub.delivery.podPhotoRef', 'مرجع عکس')}
                    />
                  ) : null}
                  <Input
                    inputMode="numeric"
                    value={closeCollected}
                    onChange={(e) => setCloseCollected(e.target.value)}
                    placeholder={t('salesHub.delivery.collectedMinor', 'مبلغ دریافت شده (جزء)')}
                  />
                </>
              ) : (
                <Input
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder={t('salesHub.delivery.failureReason', 'دلیل عدم تحویل')}
                />
              )}
              <Button type="submit" size="sm" disabled={closeDelivery.isPending}>
                {t('salesHub.delivery.confirmClose', 'ثبت نتیجه')}
              </Button>
            </form>
          ) : null}

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
                    {
                      noteId: podNoteId,
                      recipientName: podRecipient.trim(),
                      method: podMethod,
                      ...(podCode.trim() ? { code: podCode.trim() } : {}),
                      ...(podPhotoRef.trim() ? { photoRef: podPhotoRef.trim() } : {}),
                    },
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
                <div className="w-36">
                  <SelectField
                    value={podMethod}
                    onChange={(value) => setPodMethod(value as 'signature' | 'photo' | 'code')}
                    options={[
                      { value: 'signature', label: t('salesHub.delivery.signature', 'امضا') },
                      { value: 'photo', label: t('salesHub.delivery.photo', 'عکس') },
                      { value: 'code', label: t('salesHub.delivery.code', 'کد') },
                    ]}
                  />
                </div>
                {podMethod === 'code' ? (
                  <Input
                    value={podCode}
                    onChange={(e) => setPodCode(e.target.value)}
                    placeholder={t('salesHub.delivery.podCode', 'کد تحویل')}
                  />
                ) : null}
                {podMethod === 'photo' ? (
                  <Input
                    value={podPhotoRef}
                    onChange={(e) => setPodPhotoRef(e.target.value)}
                    placeholder={t('salesHub.delivery.podPhotoRef', 'مرجع عکس')}
                  />
                ) : null}
                <Input
                  value={podRecipient}
                  onChange={(e) => setPodRecipient(e.target.value)}
                  placeholder={t('salesHub.delivery.podRecipient', 'نام تحویلگیرنده')}
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
