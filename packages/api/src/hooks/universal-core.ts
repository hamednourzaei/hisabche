'use client'

// ============================================
// packages/api/src/hooks/universal-core.ts
//
// React Query hooks for the Universal Business Core:
// Variants, Pack Barcodes, Serials, Metal Rates, Auto Fitments,
// Vehicles, Warranties, Returns, Deposits, Appointments,
// Agriculture, Freight, Courier, Delivery Notes.
//
// Follows all repo invariants:
// - asList for all collection endpoints
// - useAuthReady gating
// - proper query key families
// - typed payloads without `any`
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { asList } from '../lib/as-list'
import { apiClient } from '../lib/client'
import { useIntentKey } from '../lib/intent-key'
import { useAuthReady } from './useAuthReady'
import { invoiceKeys } from './invoices'
import { paymentKeys } from './payments'
import { productKeys } from './products'

// ─── Query Key Families ──────────────────────────────────────────

export const universalCoreKeys = {
  all: ['universal-core'] as const,
  variants: (productId: string) => [...universalCoreKeys.all, 'variants', productId] as const,
  packBarcode: (barcode: string) => [...universalCoreKeys.all, 'pack-barcode', barcode] as const,
  serials: (productId: string) => [...universalCoreKeys.all, 'serials', productId] as const,
  metalRate: () => [...universalCoreKeys.all, 'metal-rate', 'latest'] as const,
  fitments: (productId: string) => [...universalCoreKeys.all, 'fitments', productId] as const,
  vehicles: () => [...universalCoreKeys.all, 'vehicles'] as const,
  warranties: () => [...universalCoreKeys.all, 'warranties'] as const,
  returns: (invoiceId: string) => [...universalCoreKeys.all, 'returns', invoiceId] as const,
  deposits: (orderId: string) => [...universalCoreKeys.all, 'deposits', orderId] as const,
  customerDeposits: (customerId: string) =>
    [...universalCoreKeys.all, 'customer-deposits', customerId] as const,
  appointments: () => [...universalCoreKeys.all, 'appointments'] as const,
  crops: () => [...universalCoreKeys.all, 'crops'] as const,
  trips: () => [...universalCoreKeys.all, 'trips'] as const,
  courier: () => [...universalCoreKeys.all, 'courier'] as const,
  deliveryNotes: (invoiceId?: string) =>
    [...universalCoreKeys.all, 'delivery-notes', invoiceId ?? 'all'] as const,
  packageCredits: (customerId?: string, productId?: string) =>
    [...universalCoreKeys.all, 'package-credits', customerId ?? 'all', productId ?? 'all'] as const,
  serviceDelivery: (filters?: Record<string, string | undefined>) =>
    [...universalCoreKeys.all, 'service-delivery', filters ?? {}] as const,
}

// ─── Types ───────────────────────────────────────────────────────

export interface ProductVariant {
  id: string
  templateProductId: string
  sku: string
  barcode?: string | null
  attributes: Array<{ name: string; value: string }>
  priceOverrideMinor?: number | null
  costOverrideMinor?: number | null
  isActive: boolean
}

export interface PackBarcodeResolved {
  productId: string
  barcode: string
  unitCode: string
  conversionFactor: number
  baseQuantity: number
}

export interface ProductSerialItem {
  id: string
  productId: string
  serialNumber: string
  status: 'in_stock' | 'sold' | 'defective' | 'returned'
  warehouseId?: string | null
  soldInvoiceId?: string | null
}

export interface MetalRateRecord {
  id: string
  rateDate: string
  rate24kMinorPerGram: number
}

export interface AutoFitmentRecord {
  id: string
  productId: string
  make: string
  model: string
  yearStart: number
  yearEnd: number
  notes?: string | null
}

export interface VehicleUnitRecord {
  id: string
  productId: string
  vin: string
  make: string
  model: string
  year: number
  colour: string
  odometer: number
  receivedDate: string
  basePurchaseCostMinor: number
  status: string
}

export interface WarrantyItem {
  id: string
  invoiceId: string
  productId: string
  serialNumber?: string | null
  startDate: string
  endDate: string
  warrantyMonths: number
  customerId?: string | null
}

export type ReturnRefundStatus = 'not_due' | 'pending' | 'partial' | 'refunded'

export interface InvoiceReturnDeductionRecord {
  reason: string
  mode: 'percent' | 'fixed'
  percent: number | null
  amountMinor: number
  note: string
}

export interface InvoiceReturnLineRecord {
  id: string
  originalLineId: string
  productId: string | null
  quantity: number
  restockChoice: 'restock' | 'scrap'
  reasonCode: string
  conditionCode: string | null
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  totalMinor: number
}

export interface InvoiceReturnRecord {
  id: string
  originalInvoiceId: string
  returnType: 'sale_return' | 'purchase_return'
  returnNumber: string
  returnDate: string
  reasonCode?: string | null
  notes?: string | null
  totalSubtotalMinor: number
  totalDiscountMinor: number
  totalTaxMinor: number
  /** What the shop kept (restocking fee, damage, agreed …), minor units. */
  deductionMinor?: number
  /** What the return CREDITS the customer: goods + tax - deductions, minor units. */
  grandTotalMinor: number
  /** Cash already paid back against the credit. */
  refundedMinor?: number
  /** Set aside for a refund that is being paid. */
  pendingRefundMinor?: number
  /** What can still be paid back in cash or by bank. */
  refundableMinor?: number
  refundStatus?: ReturnRefundStatus
  deductions?: InvoiceReturnDeductionRecord[]
  lines?: InvoiceReturnLineRecord[]
}

export interface CreateInvoiceReturnInput {
  returnType: 'sale_return' | 'purchase_return'
  returnNumber: string
  returnDate: string
  reasonCode?: string | undefined
  notes?: string | undefined
  deductions?: Array<{
    reason: string
    mode: 'percent' | 'fixed'
    percent?: number | undefined
    /** Major units of the invoice currency. */
    amount?: number | undefined
    note?: string | undefined
  }>
  lines: Array<{
    originalLineId: string
    quantity: number
    restockChoice?: 'restock' | 'scrap' | undefined
    reasonCode?: string | undefined
    conditionCode?: string | undefined
  }>
}

export interface RefundInvoiceReturnInput {
  /** Major units of the invoice currency. */
  amount: number
  method: 'cash' | 'bank'
  tillSessionId?: string | null | undefined
}

export interface OrderDepositRecord {
  id: string
  orderId: string
  customerId: string
  amountMinor: number
  paymentMethod?: string | null
  createdAt: string
}

/**
 * A deposit as the customer screen reads it: the row plus the balance the
 * database counts (`order_deposit_balance`), so what the screen shows is the
 * figure apply/refund will validate against.
 *
 * ⚠️ `currency: null` is UNKNOWN, not the books currency: the row predates the
 * column, so an amount cannot be converted and the action is refused.
 */
export interface CustomerDepositRecord {
  id: string
  orderId: string
  customerId: string
  amountMinor: number
  appliedMinor: number
  refundedMinor: number
  remainingMinor: number
  currency: string | null
  paymentMethod: string
  postingStatus: string | null
  journalEntryId: string | null
  status: 'pending_posting' | 'posting_unknown' | 'available' | 'partially_used' | 'fully_used'
  /** True while a change to this deposit is still waiting in the device's outbox. */
  pendingSync: boolean
  createdAt: string
}

/** What apply/refund answer: the movement and the balance after it. */
export interface DepositMovementResult {
  replayed: boolean
  depositId: string
  amountMinor: number
  currency: string
  paymentId: string
  journalEntryId: string | null
  balance: {
    amountMinor: number
    appliedMinor: number
    refundedMinor: number
    remainingMinor: number
  }
}

export interface AppointmentRecord {
  id: string
  customerId: string
  staffEmployeeId: string
  serviceProductId: string
  startTime: string
  endTime: string
  notes?: string | null
}

export interface CropCycleRecord {
  id: string
  landUnitId: string
  cropName: string
  plantingDate: string
  expectedHarvestDate?: string | null
}

export interface FreightTripRecord {
  id: string
  origin: string
  destination: string
  startDate: string
  vehicleAssetId?: string | null
  driverEmployeeId?: string | null
}

export interface CourierDeliveryRecord {
  id: string
  trackingNumber: string
  customerName: string
  destinationAddress: string
  codAmountMinor?: number | null
  status: string
  driverEmployeeId?: string | null
}

export interface DeliveryNoteRecord {
  id: string
  invoiceId: string
  noteNumber: string
  deliveryDate: string
  carrierNotes?: string | null
}

// ─── 1. Product Variants (G-05) ──────────────────────────────────

export function useProductVariants(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.variants(productId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: ProductVariant[] }>(
        `/products/${productId}/variants`,
      )
      return asList<ProductVariant>(data?.data, `/products/${productId}/variants`)
    },
    enabled: authReady && Boolean(productId),
  })
}

export function useCreateProductVariant(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      sku: string
      barcode?: string | undefined
      attributes: Array<{ name: string; value: string }>
      priceOverrideMinor?: number | undefined
      costOverrideMinor?: number | undefined
    }) => {
      const { data } = await apiClient.post<{ data: ProductVariant }>(
        `/products/${productId}/variants`,
        input,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.variants(productId) })
    },
  })
}

// ─── 4. Metal Rates (G-13) ───────────────────────────────────────

export function useLatestMetalRate() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.metalRate(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MetalRateRecord | null }>('/metal-rates/latest')
      return data.data
    },
    enabled: authReady,
  })
}

export function useRecordMetalRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { rateDate: string; rate24kMinorPerGram: number }) => {
      const { data } = await apiClient.post<{ data: MetalRateRecord }>('/metal-rates', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.metalRate() })
    },
  })
}

// ─── 5. Auto Fitments (G-15) ─────────────────────────────────────

export function useProductFitments(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.fitments(productId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: AutoFitmentRecord[] }>(
        `/products/${productId}/fitments`,
      )
      return asList<AutoFitmentRecord>(data?.data, `/products/${productId}/fitments`)
    },
    enabled: authReady && Boolean(productId),
  })
}

export function useAddProductFitment(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      make: string
      model: string
      yearStart: number
      yearEnd: number
      notes?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: AutoFitmentRecord }>(
        `/products/${productId}/fitments`,
        input,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.fitments(productId) })
    },
  })
}

// ─── 6. Vehicles (G-14) ──────────────────────────────────────────

export function useVehicles() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.vehicles(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: VehicleUnitRecord[] }>('/vehicles')
      return asList<VehicleUnitRecord>(data?.data, '/vehicles')
    },
    enabled: authReady,
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      productId: string
      vin: string
      make: string
      model: string
      year: number
      colour: string
      odometer: number
      receivedDate: string
      basePurchaseCostMinor: number
    }) => {
      const { data } = await apiClient.post<{ data: VehicleUnitRecord }>('/vehicles', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.vehicles() })
    },
  })
}

// ─── 7. Warranties (G-11) ────────────────────────────────────────

export function useWarranties() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.warranties(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: WarrantyItem[] }>('/warranties')
      return asList<WarrantyItem>(data?.data, '/warranties')
    },
    enabled: authReady,
  })
}

export function useRegisterWarranty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      invoiceId: string
      productId: string
      serialNumber?: string | undefined
      startDate: string
      warrantyMonths: number
      customerId?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: WarrantyItem }>('/warranties', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.warranties() })
    },
  })
}

// ─── 8. Invoice Returns (G-12) ───────────────────────────────────

export function useInvoiceReturns(invoiceId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.returns(invoiceId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: InvoiceReturnRecord[] }>(
        `/invoices/${invoiceId}/returns`,
      )
      return asList<InvoiceReturnRecord>(data?.data, `/invoices/${invoiceId}/returns`)
    },
    enabled: authReady && Boolean(invoiceId),
  })
}

export function useCreateInvoiceReturn(invoiceId: string) {
  const queryClient = useQueryClient()
  // The same key while the same return is retried after a lost response: the server then answers
  // with the return it already made instead of refusing the second as «already returned».
  const intent = useIntentKey('ret')
  return useMutation({
    mutationFn: async (input: CreateInvoiceReturnInput) => {
      const { data } = await apiClient.post<{ data: InvoiceReturnRecord }>(
        `/invoices/${invoiceId}/returns`,
        input,
        { headers: { 'Idempotency-Key': intent.current() } },
      )
      return data.data
    },
    onError: (error) => intent.settle(error),
    onSuccess: () => {
      intent.settle()
      invalidateAfterReturn(queryClient, invoiceId)
    },
  })
}

/** Money paid back against a return — its own event, recorded by the payment core. */
export function useRefundInvoiceReturn(invoiceId: string) {
  const queryClient = useQueryClient()
  // Money out: a retry after a timeout must be the SAME refund, never a second one.
  const intent = useIntentKey('refund')
  return useMutation({
    // The return is named when the refund is paid: the return that a form has just created
    // does not exist yet when the hook is mounted.
    mutationFn: async ({ returnId, ...body }: RefundInvoiceReturnInput & { returnId: string }) => {
      const { data } = await apiClient.post<{
        data: { refundId: string; paymentId: string; amountMinor: number }
      }>(`/invoices/${invoiceId}/returns/${returnId}/refunds`, body, {
        headers: { 'Idempotency-Key': intent.current() },
      })
      return data.data
    },
    onError: (error) => intent.settle(error),
    onSuccess: () => {
      intent.settle()
      invalidateAfterReturn(queryClient, invoiceId)
    },
  })
}

// The invoice page, the party balance, the books, the till and the dashboard all move with a
// return and with the cash paid back for it.
function invalidateAfterReturn(queryClient: ReturnType<typeof useQueryClient>, invoiceId: string) {
  queryClient.invalidateQueries({ queryKey: universalCoreKeys.returns(invoiceId) })
  queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
  queryClient.invalidateQueries({ queryKey: paymentKeys.all })
  queryClient.invalidateQueries({ queryKey: productKeys.all })
  queryClient.invalidateQueries({ queryKey: ['invoice-related'] })
  queryClient.invalidateQueries({ queryKey: ['customers'] })
  queryClient.invalidateQueries({ queryKey: ['ledger'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

// ─── 9. Order Deposits (G-17) ────────────────────────────────────

export function useOrderDeposits(orderId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.deposits(orderId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: OrderDepositRecord[] }>(
        `/orders/${orderId}/deposits`,
      )
      return asList<OrderDepositRecord>(data?.data, `/orders/${orderId}/deposits`)
    },
    enabled: authReady && Boolean(orderId),
  })
}

export function useCreateOrderDeposit(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      amountMinor: number
      paymentMethod?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: OrderDepositRecord }>(
        `/orders/${orderId}/deposits`,
        input,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.deposits(orderId) })
    },
  })
}

/** Every deposit this customer paid, with what is left of each. */
export function useCustomerDeposits(customerId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.customerDeposits(customerId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: CustomerDepositRecord[] }>(
        `/customers/${customerId}/deposits`,
      )
      return asList<CustomerDepositRecord>(data?.data, `/customers/${customerId}/deposits`)
    },
    enabled: authReady && Boolean(customerId),
  })
}

/**
 * Apply part of a deposit to a final invoice.
 *
 * The key travels in the BODY (the server's contract): the same key on a retry
 * returns the first application instead of settling the invoice twice, and the
 * same key with another amount is refused as a conflict.
 */
export function useApplyOrderDeposit() {
  const queryClient = useQueryClient()
  const intent = useIntentKey('dep_apply')
  return useMutation({
    mutationFn: async (input: {
      orderId: string
      depositId: string
      customerId: string
      invoiceId: string
      amountMinor: number
      date?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: DepositMovementResult }>(
        `/orders/${input.orderId}/deposits/${input.depositId}/apply`,
        {
          invoiceId: input.invoiceId,
          amountMinor: input.amountMinor,
          idempotencyKey: intent.current(),
          ...(input.date ? { date: input.date } : {}),
        },
      )
      return data.data
    },
    onError: (error) => intent.settle(error),
    onSuccess: (result, input) => {
      intent.settle()
      invalidateAfterDeposit(queryClient, input.orderId, input.customerId)
      return result
    },
  })
}

/**
 * Give part (or all) of an unused deposit back.
 *
 * Money OUT: the reason is mandatory and trimmed here as well as on the
 * server — an empty explanation is refused before a request is wasted, and the
 * server refuses it again if the screen ever stops doing so.
 */
export function useRefundOrderDeposit() {
  const queryClient = useQueryClient()
  const intent = useIntentKey('dep_refund')
  return useMutation({
    mutationFn: async (input: {
      orderId: string
      depositId: string
      customerId: string
      amountMinor: number
      reason: string
      method?: string | undefined
      date?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: DepositMovementResult }>(
        `/orders/${input.orderId}/deposits/${input.depositId}/refund`,
        {
          amountMinor: input.amountMinor,
          reason: input.reason.trim(),
          idempotencyKey: intent.current(),
          ...(input.method ? { method: input.method } : {}),
          ...(input.date ? { date: input.date } : {}),
        },
      )
      return data.data
    },
    onError: (error) => intent.settle(error),
    onSuccess: (result, input) => {
      intent.settle()
      invalidateAfterDeposit(queryClient, input.orderId, input.customerId)
      return result
    },
  })
}

/**
 * Re-book the receipt of a deposit recorded while the chart of accounts could
 * not express it. Idempotent on the server: an already-booked deposit returns
 * its entry and writes nothing.
 */
export function usePostOrderDepositReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orderId: string; depositId: string; customerId: string }) => {
      const { data } = await apiClient.post<{ data: OrderDepositRecord }>(
        `/orders/${input.orderId}/deposits/${input.depositId}/post`,
        {},
      )
      return data.data
    },
    onSuccess: (_result, input) => {
      invalidateAfterDeposit(queryClient, input.orderId, input.customerId)
    },
  })
}

// A deposit that moves changes the invoice it settled, the customer's balance,
// the books and the dashboard — all four, or the next screen contradicts this one.
function invalidateAfterDeposit(
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string,
  customerId: string,
) {
  queryClient.invalidateQueries({ queryKey: universalCoreKeys.deposits(orderId) })
  queryClient.invalidateQueries({ queryKey: universalCoreKeys.customerDeposits(customerId) })
  queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
  queryClient.invalidateQueries({ queryKey: paymentKeys.all })
  queryClient.invalidateQueries({ queryKey: ['invoice-related'] })
  queryClient.invalidateQueries({ queryKey: ['customers'] })
  queryClient.invalidateQueries({ queryKey: ['ledger'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

// ─── 10. Appointments (G-17) ────────────────────────────────────

export function useAppointments() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.appointments(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: AppointmentRecord[] }>('/appointments')
      return asList<AppointmentRecord>(data?.data, '/appointments')
    },
    enabled: authReady,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      staffEmployeeId: string
      serviceProductId: string
      startTime: string
      endTime: string
      notes?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: AppointmentRecord }>('/appointments', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.appointments() })
    },
  })
}

// ─── 11. Agriculture (G-17) ─────────────────────────────────────

export function useCropCycles() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.crops(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: CropCycleRecord[] }>('/agriculture/crops')
      return asList<CropCycleRecord>(data?.data, '/agriculture/crops')
    },
    enabled: authReady,
  })
}

export function useCreateCropCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      landUnitId: string
      cropName: string
      plantingDate: string
      expectedHarvestDate?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: CropCycleRecord }>('/agriculture/crops', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.crops() })
    },
  })
}

// ─── 12. Freight Trips (G-14) ───────────────────────────────────

export function useFreightTrips() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.trips(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: FreightTripRecord[] }>('/transport/trips')
      return asList<FreightTripRecord>(data?.data, '/transport/trips')
    },
    enabled: authReady,
  })
}

export function useCreateFreightTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      origin: string
      destination: string
      startDate: string
      vehicleAssetId?: string | undefined
      driverEmployeeId?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: FreightTripRecord }>('/transport/trips', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.trips() })
    },
  })
}

// ─── 13. Courier (G-14) ─────────────────────────────────────────

export function useCourierDeliveries() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.courier(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: CourierDeliveryRecord[] }>(
        '/deliveries/courier',
      )
      return asList<CourierDeliveryRecord>(data?.data, '/deliveries/courier')
    },
    enabled: authReady,
  })
}

export function useCreateCourierDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      trackingNumber: string
      customerName: string
      destinationAddress: string
      codAmountMinor?: number | undefined
      driverEmployeeId?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: CourierDeliveryRecord }>(
        '/deliveries/courier',
        input,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.courier() })
    },
  })
}

export function useProgressCourierCod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const { data } = await apiClient.post<{ data: CourierDeliveryRecord }>(
        `/deliveries/courier/${deliveryId}/progress-cod`,
        {},
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.courier() })
    },
  })
}

// ─── 14. Delivery Notes (G-14) ──────────────────────────────────

export function useDeliveryNotes(invoiceId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.deliveryNotes(invoiceId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: DeliveryNoteRecord[] }>('/deliveries/notes', {
        params: invoiceId ? { invoiceId } : undefined,
      })
      return asList<DeliveryNoteRecord>(data?.data, '/deliveries/notes')
    },
    enabled: authReady,
  })
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      invoiceId: string
      noteNumber: string
      deliveryDate: string
      carrierNotes?: string | undefined
      lines: Array<{ lineId: string; quantity: number }>
    }) => {
      const { data } = await apiClient.post<{ data: DeliveryNoteRecord }>(
        '/deliveries/notes',
        input,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.deliveryNotes() })
    },
  })
}

// ─── 15. Package Credit & Entitlement Ledger (M3) ───────────────────

export interface PackageCreditBalanceResponse {
  readonly customerId: string
  readonly packageProductId?: string | undefined
  readonly balance?: number | undefined
  readonly balances?: Array<{ packageProductId: string; balance: number }> | undefined
}

export interface PackageCreditLedgerItem {
  readonly id: string
  readonly workspaceId: string
  readonly customerId: string
  readonly packageProductId: string
  readonly entryType: 'GRANT' | 'CONSUME' | 'REVERSAL' | 'EXPIRE' | 'ADJUSTMENT'
  readonly quantity: number
  readonly unit?: string | null | undefined
  readonly sourceDocumentType?: string | undefined
  readonly sourceDocumentId?: string | null | undefined
  readonly sourceLineId?: string | null | undefined
  readonly referenceEntryId?: string | null | undefined
  readonly idempotencyKey?: string | null | undefined
  readonly notes?: string | null | undefined
  readonly expiresAt?: string | null | undefined
  readonly effectiveDate: string
  readonly createdAt: string
}

export function usePackageCreditBalance(customerId?: string, packageProductId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.packageCredits(customerId, packageProductId),
    queryFn: async () => {
      const { data } = await apiClient.get<PackageCreditBalanceResponse>(
        '/package-credits/balance',
        {
          params: { customerId, packageProductId },
        },
      )
      return data
    },
    enabled: authReady && Boolean(customerId),
  })
}

export function usePackageCreditLedger(customerId?: string, packageProductId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...universalCoreKeys.packageCredits(customerId, packageProductId), 'ledger'],
    queryFn: async () => {
      const { data } = await apiClient.get<PackageCreditLedgerItem[]>('/package-credits/ledger', {
        params: { customerId, packageProductId },
      })
      return asList<PackageCreditLedgerItem>(data, '/package-credits/ledger')
    },
    enabled: authReady && Boolean(customerId),
  })
}

/** One GRANT of a customer's package, as the server (or the device) derives it today. */
export interface PackageGrantStatusItem {
  readonly id: string
  readonly customerId: string
  readonly packageProductId: string
  readonly soldOn: string
  readonly quantity: number
  readonly remaining: number
  readonly termMonths: number | null
  /** null = never used: the term has not started (SOLD != ACTIVATED). */
  readonly activatedOn: string | null
  readonly endsOn: string | null
  readonly state: 'not_started' | 'active' | 'expired' | 'suspended'
  readonly deferredAmount: number | null
}

export function usePackageGrants(customerId?: string, packageProductId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...universalCoreKeys.packageCredits(customerId, packageProductId), 'grants'],
    queryFn: async () => {
      const { data } = await apiClient.get<PackageGrantStatusItem[]>('/package-credits/grants', {
        params: { customerId, packageProductId },
      })
      return asList<PackageGrantStatusItem>(data, '/package-credits/grants')
    },
    enabled: authReady && Boolean(customerId),
  })
}

/** SUSPEND or RESUME ONE GRANT (append-only events; never the whole customer). */
export function useRecordGrantSuspension() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      grantId: string
      customerId: string
      kind: 'SUSPEND' | 'RESUME'
      reason: string
      effectiveOn?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ id: string }>(
        `/package-credits/grants/${input.grantId}/suspension`,
        { kind: input.kind, reason: input.reason, effectiveOn: input.effectiveOn },
      )
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: universalCoreKeys.packageCredits(variables.customerId),
      })
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.all })
    },
  })
}

export function useConsumePackageCredit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      packageProductId: string
      quantity: number
      unit?: string | undefined
      sourceDocumentType?: string | undefined
      sourceDocumentId?: string | undefined
      idempotencyKey?: string | undefined
      notes?: string | undefined
      effectiveDate?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ entry: PackageCreditLedgerItem; balance: number }>(
        '/package-credits/consume',
        input,
      )
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: universalCoreKeys.packageCredits(
          variables.customerId,
          variables.packageProductId,
        ),
      })
    },
  })
}

export function useReversePackageCredit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      referenceEntryId: string
      quantity?: number | undefined
      idempotencyKey?: string | undefined
      notes?: string | undefined
      effectiveDate?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ entry: PackageCreditLedgerItem; balance: number }>(
        '/package-credits/reverse',
        input,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: universalCoreKeys.all,
      })
    },
  })
}

export function useExpirePackageCredit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      packageProductId: string
      notes?: string | undefined
      effectiveDate?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ entry: PackageCreditLedgerItem; balance: number }>(
        '/package-credits/expire',
        input,
      )
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: universalCoreKeys.packageCredits(
          variables.customerId,
          variables.packageProductId,
        ),
      })
    },
  })
}

// ─── Service Delivery Hooks (M4) ─────────────────────────────────

export interface ServiceDeliverySessionItem {
  id: string
  workspaceId: string
  customerId: string
  serviceOfferingId: string
  practitionerId?: string | null | undefined
  branchId?: string | null | undefined
  sessionDate: string
  startTime: string
  endTime: string
  durationMinutes: number
  status: string
  settlementMethod: string
  packageCreditId?: string | null | undefined
  invoiceId?: string | null | undefined
  /** Why a complementary session was free. */
  settlementReason?: string | null | undefined
  /** Why the session was cancelled. */
  cancellationReason?: string | null | undefined
  clientNotes?: string | null | undefined
  internalNotes?: string | null | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
}

export function useServiceDeliverySessions(filters?: {
  date?: string | undefined
  customerId?: string | undefined
  practitionerId?: string | undefined
  status?: string | undefined
}) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: universalCoreKeys.serviceDelivery(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ServiceDeliverySessionItem[] }>(
        '/service-delivery/sessions',
        { params: filters },
      )
      return asList<ServiceDeliverySessionItem>(data.data)
    },
    enabled: authReady,
  })
}

export function useCreateServiceDeliverySession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      customerId: string
      serviceOfferingId: string
      practitionerId?: string | null | undefined
      branchId?: string | null | undefined
      sessionDate: string
      startTime: string
      endTime: string
      settlementMethod?: string | undefined
      clientNotes?: string | null | undefined
      internalNotes?: string | null | undefined
    }) => {
      const { data } = await apiClient.post<ServiceDeliverySessionItem>(
        '/service-delivery/sessions',
        input,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.all })
    },
  })
}
export function useDeliverServiceDeliverySession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      /** package_credit: the package whose credit is consumed. Required for that settlement. */
      packageProductId?: string | undefined
      /** package_credit | invoice | complementary - CHOSEN, never inferred; a delivery that cannot honour it is refused. */
      settlementMethod?: string | undefined
      quantity?: number | undefined
      /** invoice: the existing invoice of this customer that bills the session. */
      invoiceId?: string | undefined
      /** complementary: why the session is free. Required for that settlement. */
      reason?: string | undefined
      /** Refuse when the session changed since it was read. */
      expectedUpdatedAt?: string | undefined
    }) => {
      const { data } = await apiClient.post<{
        session: ServiceDeliverySessionItem
        consumptionEntry: unknown | null
      }>(`/service-delivery/sessions/${id}/deliver`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.all })
    },
  })
}
export function useCancelServiceDeliverySession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await apiClient.post<{
        session: ServiceDeliverySessionItem
        reversalEntry: unknown | null
      }>(`/service-delivery/sessions/${id}/cancel`, { reason })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.all })
    },
  })
}
