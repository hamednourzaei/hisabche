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
  appointments: () => [...universalCoreKeys.all, 'appointments'] as const,
  crops: () => [...universalCoreKeys.all, 'crops'] as const,
  trips: () => [...universalCoreKeys.all, 'trips'] as const,
  courier: () => [...universalCoreKeys.all, 'courier'] as const,
  deliveryNotes: (invoiceId?: string) =>
    [...universalCoreKeys.all, 'delivery-notes', invoiceId ?? 'all'] as const,
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

export interface InvoiceReturnRecord {
  id: string
  originalInvoiceId: string
  returnType: 'sale_return' | 'purchase_return'
  returnNumber: string
  returnDate: string
  totalSubtotalMinor: number
  totalDiscountMinor: number
  totalTaxMinor: number
  grandTotalMinor: number
}

export interface OrderDepositRecord {
  id: string
  orderId: string
  customerId: string
  amountMinor: number
  paymentMethod?: string | null
  createdAt: string
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
  return useMutation({
    mutationFn: async (input: {
      returnType: 'sale_return' | 'purchase_return'
      returnNumber: string
      returnDate: string
      lines: Array<{
        originalLineId: string
        quantity: number
        restockChoice?: 'restock' | 'scrap'
        reasonCode?: string
      }>
    }) => {
      const { data } = await apiClient.post<{ data: InvoiceReturnRecord }>(
        `/invoices/${invoiceId}/returns`,
        input,
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: universalCoreKeys.returns(invoiceId) })
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
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
