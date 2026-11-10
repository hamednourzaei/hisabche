// ============================================
// packages/api/src/hooks/business-packs.ts
//
// The hooks for the QA document's business packs (10 Nov 2026). Each pack is
// a part of the ONE core a kind of business uses — not a module of its own:
//
//   clothing      variant stock, the size × colour grid      (variant-stock-01)
//   stock places  transfer requests: ask, pick, ship, receive (phase-k-01)
//   mobile        repair slips; holding a unit for a customer (retail-ops-01)
//   exchange      rate board, trades, positions, hawala       (exchange-01)
//   salon         resources, service catalog, commission      (salon-01)
//
// Every list read answers `ready: false` until its migration has run, so a
// screen can say «not set up yet» instead of showing an empty list (§7.6).
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CommissionLine,
  CommissionRateInput,
  FxRateBoardInput,
  FxSettingsInput,
  FxTradeCreateInput,
  RemittanceCreateInput,
  RemittanceDirection,
  RemittanceMoveInput,
  RemittanceStatus,
  RepairStatus,
  RepairTicketCreateInput,
  RepairTicketMoveInput,
  ServiceCatalogInput,
  ServiceResourceInput,
  ServiceResourcePatch,
  VariantMatrixInput,
  VariantStockLine,
  VariantStockMoveInput,
} from '@hisabche/validation'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export const businessPackKeys = {
  variantStock: (productId: string) => ['business-packs', 'variant-stock', productId] as const,
  transfers: (status?: string) => ['business-packs', 'transfers', status ?? 'all'] as const,
  repairs: (filter?: string) => ['business-packs', 'repairs', filter ?? 'all'] as const,
  repair: (id: string) => ['business-packs', 'repair', id] as const,
  serialHolds: (productId: string) => ['business-packs', 'serial-holds', productId] as const,
  fx: ['business-packs', 'fx'] as const,
  salon: ['business-packs', 'salon'] as const,
}

const fresh = (data: { ready?: unknown } | undefined) => data?.ready === true

// ─── Clothing: variant stock ─────────────────────────────────────────────────

export interface VariantStockView {
  ready: boolean
  productOnHand: number
  unassigned: number
  variants: VariantStockLine[]
}

export function useVariantStock(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: businessPackKeys.variantStock(productId ?? ''),
    queryFn: async (): Promise<VariantStockView> => {
      const { data } = await apiClient.get<{ data?: Partial<VariantStockView> }>(
        `/products/${encodeURIComponent(productId ?? '')}/variants/stock`,
      )
      return {
        ready: fresh(data?.data),
        productOnHand: Number(data?.data?.productOnHand) || 0,
        unassigned: Number(data?.data?.unassigned) || 0,
        variants: asList<VariantStockLine>(data?.data?.variants),
      }
    },
    enabled: authReady && Boolean(productId),
    staleTime: 0,
  })
}

function invalidateVariantStock(queryClient: ReturnType<typeof useQueryClient>, productId: string) {
  void queryClient.invalidateQueries({ queryKey: businessPackKeys.variantStock(productId) })
  void queryClient.invalidateQueries({ queryKey: ['universal-core', 'variants', productId] })
  void queryClient.invalidateQueries({ queryKey: ['products'] })
  void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
}

export function useCreateVariantMatrix(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: VariantMatrixInput) => {
      const { data } = await apiClient.post<{ data: { created: unknown[]; skipped: number } }>(
        `/products/${encodeURIComponent(productId)}/variants/matrix`,
        input,
      )
      return {
        created: asList(data?.data?.created).length,
        skipped: Number(data?.data?.skipped) || 0,
      }
    },
    onSuccess: () => invalidateVariantStock(queryClient, productId),
  })
}

export function useMoveVariantStock(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ variantId, ...input }: VariantStockMoveInput & { variantId: string }) => {
      const { data } = await apiClient.post(
        `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/stock`,
        input,
      )
      return data
    },
    onSuccess: () => invalidateVariantStock(queryClient, productId),
  })
}

// ─── Stock places: transfer requests ─────────────────────────────────────────

export type TransferStatus =
  'requested' | 'approved' | 'picking' | 'shipped' | 'in_transit' | 'received' | 'cancelled'
export type TransferAction = 'approve' | 'pick' | 'ship' | 'mark_in_transit' | 'receive' | 'cancel'

export interface TransferRequestRow {
  id: string
  transfer_number: string | null
  status: TransferStatus
  from_warehouse_id: string
  to_warehouse_id: string
  requested_at: string
  shipped_at: string | null
  received_at: string | null
  lines?: Array<{
    id: string
    product_id: string
    quantity: number | string
    received_quantity: number | string | null
  }>
}

export function useTransferRequests(status?: TransferStatus) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: businessPackKeys.transfers(status),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: TransferRequestRow[] }>('/transfer-requests', {
        params: status ? { status } : {},
      })
      return asList<TransferRequestRow>(data?.data)
    },
    enabled: authReady,
    staleTime: 0,
  })
}

export function useTransferRequest(id: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.transfers('one'), id ?? ''],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: TransferRequestRow }>(
        `/transfer-requests/${encodeURIComponent(String(id))}`,
      )
      return data.data
    },
    enabled: authReady && Boolean(id),
  })
}

export function useCreateTransferRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      fromWarehouseId: string
      toWarehouseId: string
      notes?: string | undefined
      lines: Array<{ productId: string; quantity: number }>
    }) => {
      const { data } = await apiClient.post<{ data: TransferRequestRow }>(
        '/transfer-requests',
        input,
      )
      return data.data
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['business-packs', 'transfers'] }),
  })
}

export function useAdvanceTransferRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      action: TransferAction
      reason?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: TransferRequestRow }>(
        `/transfer-requests/${encodeURIComponent(id)}/action`,
        body,
      )
      return data.data
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['business-packs', 'transfers'] })
      if (variables.action === 'receive') {
        void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
        void queryClient.invalidateQueries({ queryKey: ['products'] })
      }
    },
  })
}

// ─── Mobile: repair slips and held units ─────────────────────────────────────

export interface RepairTicket {
  id: string
  number: number
  customerId: string
  serialId: string | null
  deviceLabel: string
  problem: string
  status: RepairStatus
  underWarranty: boolean
  estimateMinor: number | null
  currency: string | null
  technicianEmployeeId: string | null
  promisedOn: string | null
  invoiceId: string | null
  createdAt: string
  closedAt: string | null
}

export interface RepairTicketDetail extends RepairTicket {
  events: Array<{
    id: string
    fromStatus: RepairStatus | null
    toStatus: RepairStatus
    note: string | null
    createdAt: string
  }>
}

export function useRepairTickets(filter: RepairStatus | 'open' | undefined = 'open') {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: businessPackKeys.repairs(filter),
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data?: { ready?: boolean; tickets?: RepairTicket[] }
      }>('/repair-tickets', { params: filter ? { status: filter } : {} })
      return { ready: fresh(data?.data), tickets: asList<RepairTicket>(data?.data?.tickets) }
    },
    enabled: authReady,
    staleTime: 0,
  })
}

export function useRepairTicket(id: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: businessPackKeys.repair(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RepairTicketDetail }>(
        `/repair-tickets/${encodeURIComponent(String(id))}`,
      )
      return {
        ...data.data,
        events: asList<RepairTicketDetail['events'][number]>(data.data?.events),
      }
    },
    enabled: authReady && Boolean(id),
  })
}

export function useCreateRepairTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RepairTicketCreateInput) => {
      const { data } = await apiClient.post<{ data: RepairTicket & { warranty: string } }>(
        '/repair-tickets',
        input,
      )
      return data.data
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['business-packs', 'repairs'] }),
  })
}

export function useMoveRepairTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: RepairTicketMoveInput & { id: string }) => {
      const { data } = await apiClient.post<{ data: RepairTicketDetail }>(
        `/repair-tickets/${encodeURIComponent(id)}/status`,
        body,
      )
      return data.data
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: ['business-packs', 'repairs'] })
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.repair(v.id) })
    },
  })
}

export function useSerialHolds(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: businessPackKeys.serialHolds(productId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<Array<{ serialId: string; customerId: string }>>(
        '/operations/serials/holds',
        { params: { productId } },
      )
      return asList<{ serialId: string; customerId: string }>(data)
    },
    enabled: authReady && Boolean(productId),
  })
}

export function useHoldSerial(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      serialId,
      customerId,
    }: {
      serialId: string
      customerId: string | null
    }) => {
      const { data } = await apiClient.post(
        `/operations/serials/${encodeURIComponent(serialId)}/hold`,
        { customerId },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.serialHolds(productId) })
      void queryClient.invalidateQueries({ queryKey: ['traceability'] })
      void queryClient.invalidateQueries({ queryKey: ['serials'] })
    },
  })
}

// ─── Money changer ───────────────────────────────────────────────────────────

export interface FxSettings {
  ready: boolean
  bookCurrency: string
  kycThresholdMinor: number | null
}
export interface FxRate {
  currency: string
  buyRate: string
  sellRate: string
  setAt: string
}
export interface FxTrade {
  id: string
  number: number
  side: 'buy' | 'sell' | 'opening'
  currency: string
  amountMinor: number
  rate: string
  bookCurrency: string
  bookAmountMinor: number
  customerId: string | null
  identityName: string | null
  status: 'posted' | 'voided'
  voidReason: string | null
  note: string | null
  createdAt: string
}
export interface FxPosition {
  currency: string
  heldMinor: number
  averageRate: string | null
  costMinor: number
  realizedMinor: number
  bought: number
  sold: number
  shortMinor: number
}
export interface Remittance {
  id: string
  number: number
  direction: RemittanceDirection
  counterparty: string
  senderName: string
  senderPhone: string | null
  receiverName: string
  receiverPhone: string | null
  destination: string | null
  currency: string
  amountMinor: number
  feeMinor: number
  status: RemittanceStatus
  cancelReason: string | null
  createdAt: string
  paidAt: string | null
}

type Wrapped = { data?: Record<string, unknown> }
type Load = () => Promise<{ data: Wrapped }>

/** Each caller names its own path in its own apiClient.get (the offline-matrix guard reads them). */
function useFxRead<T>(
  load: Load,
  pick: (data: Record<string, unknown> | undefined) => T,
  extra: string,
) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.fx, extra],
    queryFn: async () => pick((await load()).data?.data),
    enabled: authReady,
    staleTime: 0,
  })
}

export const useFxSettings = () =>
  useFxRead<FxSettings>(
    () => apiClient.get<Wrapped>('/fx/settings'),
    (d) => ({
      ready: d?.ready === true,
      bookCurrency: String(d?.bookCurrency ?? ''),
      kycThresholdMinor: d?.kycThresholdMinor == null ? null : Number(d.kycThresholdMinor),
    }),
    'settings',
  )
export const useFxRates = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/rates'),
    (d) => ({ ready: d?.ready === true, rates: asList<FxRate>(d?.rates) }),
    'rates',
  )
export const useFxTrades = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/trades'),
    (d) => ({ ready: d?.ready === true, trades: asList<FxTrade>(d?.trades) }),
    'trades',
  )
export const useFxPositions = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/positions'),
    (d) => ({
      ready: d?.ready === true,
      bookCurrency: String(d?.bookCurrency ?? ''),
      bookCashMinor: Number(d?.bookCashMinor) || 0,
      positions: asList<FxPosition>(d?.positions),
    }),
    'positions',
  )
export const useRemittances = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/remittances'),
    (d) => ({ ready: d?.ready === true, remittances: asList<Remittance>(d?.remittances) }),
    'remittances',
  )
export const usePartnerBalances = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/remittances/balances'),
    (d) => ({
      ready: d?.ready === true,
      balances: asList<{ counterparty: string; currency: string; balanceMinor: number }>(
        d?.balances,
      ),
    }),
    'balances',
  )

function useFxWrite<I, O>(run: (input: I) => Promise<O>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: businessPackKeys.fx }),
  })
}

export const useSaveFxSettings = () =>
  useFxWrite(async (input: FxSettingsInput) => (await apiClient.put('/fx/settings', input)).data)
export const useSetFxRate = () =>
  useFxWrite(async (input: FxRateBoardInput) => (await apiClient.post('/fx/rates', input)).data)
export const useCreateFxTrade = () =>
  useFxWrite(async ({ requestId, ...input }: FxTradeCreateInput & { requestId: string }) => {
    const { data } = await apiClient.post<{ data: FxTrade }>('/fx/trades', input, {
      headers: { 'Idempotency-Key': requestId },
    })
    return data.data
  })
export const useVoidFxTrade = () =>
  useFxWrite(
    async ({ id, reason }: { id: string; reason: string }) =>
      (await apiClient.post(`/fx/trades/${encodeURIComponent(id)}/void`, { reason })).data,
  )
export const useCreateRemittance = () =>
  useFxWrite(async ({ requestId, ...input }: RemittanceCreateInput & { requestId: string }) => {
    const { data } = await apiClient.post<{
      data: { id: string; number: number; payoutCode?: string }
    }>('/fx/remittances', input, { headers: { 'Idempotency-Key': requestId } })
    return data.data
  })
export const useMoveRemittance = () =>
  useFxWrite(
    async ({ id, ...body }: RemittanceMoveInput & { id: string }) =>
      (await apiClient.post(`/fx/remittances/${encodeURIComponent(id)}/status`, body)).data,
  )

// ─── Salon ───────────────────────────────────────────────────────────────────

/** HR departments — a salon's departments (hair, nails, skin) are these. */
export function useDepartments() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: ['departments', 'list'],
    queryFn: async () => {
      const { data } = await apiClient.get<unknown>('/departments')
      const raw = data as { data?: unknown } | unknown[]
      return asList<{ id?: string; name?: string }>(Array.isArray(raw) ? raw : raw?.data)
    },
    enabled: authReady,
    staleTime: 60_000,
  })
}

export interface ServiceResource {
  id: string
  name: string
  kind: string
  branchId: string | null
  departmentId: string | null
  isActive: boolean
}
export interface ServiceCatalogEntry {
  productId: string
  durationMinutes: number
  departmentId: string | null
  resourceKind: string | null
  warehouseId: string | null
  consumables: Array<{ productId: string; quantity: number }>
}

function useSalonRead<T>(
  load: Load,
  pick: (d: Record<string, unknown> | undefined) => T,
  extra: readonly unknown[],
  enabled = true,
) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.salon, ...extra],
    queryFn: async () => pick((await load()).data?.data),
    enabled: authReady && enabled,
    staleTime: 0,
  })
}

export const useServiceResources = () =>
  useSalonRead(
    () => apiClient.get<Wrapped>('/service-resources'),
    (d) => ({ ready: d?.ready === true, resources: asList<ServiceResource>(d?.resources) }),
    ['resources'],
  )
export const useServiceCatalog = () =>
  useSalonRead(
    () => apiClient.get<Wrapped>('/service-catalog'),
    (d) => ({ ready: d?.ready === true, services: asList<ServiceCatalogEntry>(d?.services) }),
    ['catalog'],
  )
export const useCommissionRates = () =>
  useSalonRead(
    () => apiClient.get<Wrapped>('/provider-commissions/rates'),
    (d) => ({
      ready: d?.ready === true,
      rates: asList<{ employeeId: string; rateBp: number }>(d?.rates),
    }),
    ['commission-rates'],
  )
export function useCommissionReport(from: string, to: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.salon, 'commission', from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: { ready?: boolean; lines?: unknown } }>(
        '/provider-commissions',
        { params: { from, to } },
      )
      return { ready: data?.data?.ready === true, lines: asList<CommissionLine>(data?.data?.lines) }
    },
    enabled: authReady && Boolean(from && to),
    staleTime: 0,
  })
}

function useSalonWrite<I, O>(run: (input: I) => Promise<O>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: businessPackKeys.salon }),
  })
}

export const useCreateServiceResource = () =>
  useSalonWrite(
    async (input: ServiceResourceInput) => (await apiClient.post('/service-resources', input)).data,
  )
export const useUpdateServiceResource = () =>
  useSalonWrite(
    async ({ id, ...input }: ServiceResourcePatch & { id: string }) =>
      (await apiClient.patch(`/service-resources/${encodeURIComponent(id)}`, input)).data,
  )
export const useSaveServiceCatalog = () =>
  useSalonWrite(
    async ({ productId, ...input }: ServiceCatalogInput & { productId: string }) =>
      (await apiClient.put(`/service-catalog/${encodeURIComponent(productId)}`, input)).data,
  )
export const useSetCommissionRate = () =>
  useSalonWrite(
    async (input: CommissionRateInput) =>
      (await apiClient.put('/provider-commissions/rates', input)).data,
  )
