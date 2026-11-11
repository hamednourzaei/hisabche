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
  FxAgentSettleInput,
  FxCashboxReconcileInput,
  FxRateBoardInput,
  FxSettingsInput,
  FxTradeCreateInput,
  FxTradeResolveReviewInput,
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

export interface VariantReservationHold {
  variantId: string
  warehouseId: string
  quantity: number
  status: 'active' | 'settled' | 'released' | 'expired'
}

export interface VariantStockView {
  ready: boolean
  productOnHand: number
  unassigned: number
  variants: VariantStockLine[]
  reservations: VariantReservationHold[]
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
        reservations: asList<VariantReservationHold>(data?.data?.reservations),
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
      receivedLines?: Array<{
        lineId: string
        receivedQuantity: number
        reason?: string | undefined
      }>
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

export interface RepairTicketPart {
  id: string
  ticketId: string
  warehouseId: string
  productId: string
  quantity: number
  unitPriceMinor: number
  unitCostMinor: number | null
  currency: string
  reservationId: string | null
  status: 'reserved' | 'consumed' | 'released'
  consumedAt: string | null
  createdAt: string
}

export interface RepairTicketDetail extends RepairTicket {
  customerApproved?: boolean
  events: Array<{
    id: string
    fromStatus: RepairStatus | null
    toStatus: RepairStatus
    note: string | null
    createdAt: string
  }>
  parts?: RepairTicketPart[]
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
        parts: asList<RepairTicketPart>(data.data?.parts),
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

export function useApproveRepairTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { data } = await apiClient.post<{ data: RepairTicketDetail }>(
        `/repair-tickets/${encodeURIComponent(ticketId)}/approve`,
        {},
      )
      return data.data
    },
    onSuccess: (_d, ticketId) => {
      void queryClient.invalidateQueries({ queryKey: ['business-packs', 'repairs'] })
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.repair(ticketId) })
    },
  })
}

export function useAddRepairPart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      ...body
    }: {
      ticketId: string
      warehouseId: string
      productId: string
      quantity: number
      unitPriceMinor?: number | undefined
      currency?: string | undefined
      customerApproved?: boolean | undefined
    }) => {
      const { data } = await apiClient.post<{ data: RepairTicketPart }>(
        `/repair-tickets/${encodeURIComponent(ticketId)}/parts`,
        body,
      )
      return data.data
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.repair(v.ticketId) })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })
}

export function useConsumeRepairPart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, partId }: { ticketId: string; partId: string }) => {
      const { data } = await apiClient.post<{ data: RepairTicketPart }>(
        `/repair-tickets/${encodeURIComponent(ticketId)}/parts/${encodeURIComponent(partId)}/consume`,
        {},
      )
      return data.data
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.repair(v.ticketId) })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useReleaseRepairPart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, partId }: { ticketId: string; partId: string }) => {
      const { data } = await apiClient.post<{ data: RepairTicketPart }>(
        `/repair-tickets/${encodeURIComponent(ticketId)}/parts/${encodeURIComponent(partId)}/release`,
        {},
      )
      return data.data
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.repair(v.ticketId) })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
  })
}

export function useCreateRepairBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      ...body
    }: {
      ticketId: string
      warehouseId?: string | undefined
      laborFeeMinor?: number | undefined
      laborProductId?: string | undefined
      paymentMethod?: 'cash' | 'bank' | 'credit' | undefined
      paidAmount?: number | undefined
      markDelivered?: boolean | undefined
    }) => {
      const { data } = await apiClient.post<{
        data: {
          invoice: { id: string; invoiceNumber?: string }
          revenueSplit: {
            partsRevenueMinor: number
            laborRevenueMinor: number
            totalRevenueMinor: number
          }
          ticket: RepairTicketDetail
        }
      }>(`/repair-tickets/${encodeURIComponent(ticketId)}/bill`, body)
      return data.data
    },
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: ['business-packs', 'repairs'] })
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.repair(v.ticketId) })
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useSerialHolds(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: businessPackKeys.serialHolds(productId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<
        Array<{ serialId: string; customerId: string; reservedUntil?: string | null }>
      >('/operations/serials/holds', { params: { productId } })
      return asList<{ serialId: string; customerId: string; reservedUntil?: string | null }>(data)
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
      holdMinutes,
      expiresAt,
    }: {
      serialId: string
      customerId: string | null
      holdMinutes?: number | null | undefined
      expiresAt?: string | null | undefined
    }) => {
      const { data } = await apiClient.post(
        `/operations/serials/${encodeURIComponent(serialId)}/hold`,
        {
          customerId,
          ...(holdMinutes !== undefined ? { holdMinutes } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        },
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

export function useReleaseExpiredSerialHolds(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ releasedCount: number; releasedIds: string[] }>(
        '/operations/serials/holds/release-expired',
        {},
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

export function useReturnSerial(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      serialId,
      conditionCode,
      restockChoice,
      reasonCode,
      notes,
      returnDate,
      returnNumber,
      refundMethod,
      refundAmount,
    }: {
      serialId: string
      conditionCode: 'sealed' | 'opened' | 'used' | 'damaged' | 'defective' | 'incomplete'
      restockChoice?: 'restock' | 'scrap' | undefined
      reasonCode?:
        | 'defective'
        | 'wrong_item'
        | 'customer_change_of_mind'
        | 'damaged_in_transit'
        | 'expired'
        | 'other'
        | undefined
      notes?: string | undefined
      returnDate?: string | undefined
      returnNumber?: string | undefined
      refundMethod?: 'cash' | 'bank' | undefined
      refundAmount?: number | undefined
    }) => {
      const { data } = await apiClient.post(
        `/operations/serials/${encodeURIComponent(serialId)}/return`,
        {
          conditionCode,
          ...(restockChoice !== undefined ? { restockChoice } : {}),
          ...(reasonCode !== undefined ? { reasonCode } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(returnDate !== undefined ? { returnDate } : {}),
          ...(returnNumber !== undefined ? { returnNumber } : {}),
          ...(refundMethod !== undefined ? { refundMethod } : {}),
          ...(refundAmount !== undefined ? { refundAmount } : {}),
        },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessPackKeys.serialHolds(productId) })
      void queryClient.invalidateQueries({ queryKey: ['traceability'] })
      void queryClient.invalidateQueries({ queryKey: ['serials'] })
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
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
  costBasisMinor?: number | null
  customerId: string | null
  identityName: string | null
  status: 'posted' | 'voided' | 'pending_review'
  voidReason: string | null
  journalEntryId?: string | null
  voidJournalEntryId?: string | null
  note: string | null
  createdAt: string
}
export interface FxAgentSettlement {
  id: string
  counterparty: string
  direction: 'collect' | 'pay'
  currency: string
  amountMinor: number
  rate: string
  bookCurrency: string
  bookAmountMinor: number
  journalEntryId: string | null
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
export interface FxCashboxReconciliation {
  id: string
  currency: string
  expectedMinor: number
  countedMinor: number
  varianceMinor: number
  status: 'matched' | 'over' | 'short'
  note: string | null
  reconciledAt: string
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
export const useResolveFxTradeReview = () =>
  useFxWrite(
    async ({ id, ...body }: FxTradeResolveReviewInput & { id: string }) =>
      (await apiClient.post(`/fx/trades/${encodeURIComponent(id)}/resolve-review`, body)).data,
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
export const useFxAgentSettlements = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/remittances/settlements'),
    (d) => ({
      ready: d?.ready === true,
      settlements: asList<FxAgentSettlement>(d?.settlements),
    }),
    'settlements',
  )
export const useSettleFxAgent = () =>
  useFxWrite(async ({ requestId, ...input }: FxAgentSettleInput & { requestId: string }) => {
    const { data } = await apiClient.post<{ data: FxAgentSettlement }>(
      '/fx/remittances/settle',
      input,
      { headers: { 'Idempotency-Key': requestId } },
    )
    return data.data
  })
export const useFxReconciliations = () =>
  useFxRead(
    () => apiClient.get<Wrapped>('/fx/reconciliations'),
    (d) => ({
      ready: d?.ready === true,
      reconciliations: asList<FxCashboxReconciliation>(d?.reconciliations),
    }),
    'reconciliations',
  )
export const useReconcileFxCashbox = () =>
  useFxWrite(async ({ requestId, ...input }: FxCashboxReconcileInput & { requestId: string }) => {
    const { data } = await apiClient.post<{ data: FxCashboxReconciliation }>(
      '/fx/reconciliations',
      input,
      { headers: { 'Idempotency-Key': requestId } },
    )
    return data.data
  })

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
export function useCommissionReport(from: string, to: string, options?: { enabled?: boolean }) {
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
    enabled: authReady && Boolean(from && to) && (options?.enabled ?? true),
    staleTime: 0,
  })
}
export function useMyCommissionReport(from: string, to: string, options?: { enabled?: boolean }) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.salon, 'commission', 'my', from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: { ready?: boolean; lines?: unknown } }>(
        '/provider-commissions/my',
        { params: { from, to } },
      )
      return { ready: data?.data?.ready === true, lines: asList<CommissionLine>(data?.data?.lines) }
    },
    enabled: authReady && Boolean(from && to) && (options?.enabled ?? true),
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

export interface ResourceBookingRow {
  id: string
  resourceId: string
  startAt: string | null
  endAt: string | null
  sourceType: string
  sourceId: string | null
  status: string
  notes: string | null
  createdAt: string
  releasedAt: string | null
}

export function useResourceBookings(resourceId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.salon, 'bookings', resourceId ?? 'all'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { ready: boolean; bookings: ResourceBookingRow[] }
      }>('/resource-bookings', { params: resourceId ? { resourceId } : undefined })
      return data.data
    },
    enabled: authReady,
  })
}

export const useBookResource = () =>
  useSalonWrite(
    async (input: {
      resourceId: string
      startAt: string
      endAt: string
      sourceType?: 'session' | 'appointment' | 'rental' | 'table' | 'maintenance' | undefined
      sourceId?: string | undefined
      notes?: string | undefined
    }) => (await apiClient.post('/resource-bookings', input)).data,
  )

export const useReleaseResourceBooking = () =>
  useSalonWrite(
    async (bookingId: string) =>
      (await apiClient.post(`/resource-bookings/${bookingId}/release`, {})).data,
  )

export function useResourceSlots(
  resourceId: string | undefined,
  params?: { startAt?: string; endAt?: string; slotMinutes?: number },
) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: [...businessPackKeys.salon, 'slots', resourceId ?? '', params] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: {
          resourceId: string
          window: { startAt: string; endAt: string }
          slotMinutes: number
          freeSlots: Array<{ startAt: string; endAt: string }>
          utilization: { bookedMinutes: number; totalMinutes: number; ratio: number | null }
        }
      }>(`/service-resources/${resourceId}/slots`, { params })
      return data.data
    },
    enabled: authReady && Boolean(resourceId),
  })
}
