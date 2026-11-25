// ============================================
// packages/api/src/hooks/extended-capabilities.ts
//
// Typed React Query hooks for the STEP-A..STEP-D Single-Core endpoints:
//   - Table-service bill split/tip & Layaway schedule (Orders Hub)
//   - Trade-in quote & FX KYC evaluation (Exchange / POS Hub)
//   - ZPL/HTML Barcode label, Quality inspection, RMA/IMEI/VIN diagnostics (Warehouse / Repair Hub)
//   - COD batch reconcile, Fleet compliance, Supplier score & Landed cost allocation
//   - Multi-currency VAT summary, Bank feed auto-match & Multi-company consolidation
//   - Contract subscriptions, guarantees, e-sign & Project change orders
//   - Appointment waitlist, no-show fee, TCO estimator, SLA tickets, Integration health & Export bundle
// ============================================

import { useMutation, useQuery } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface TableBillSummaryResult {
  subtotalMinor: number
  serviceChargeMinor: number
  tipMinor: number
  grandTotalMinor: number
  tipPool: Record<string, number> | null
  seatSplit: number[] | null
}

export interface LayawayScheduleResult {
  mode: 'layaway'
  orderId: string | null
  currency: string
  totalMinor: number
  depositMinor: number
  remainingMinor: number
  installments: ReadonlyArray<{ sequence: number; amountMinor: number }>
}

export interface TradeInQuoteResult {
  currency: string
  newItemPriceMinor: number
  tradeInAppraisedMinor: number
  conditionDeductionMinor: number
  netTradeInCreditMinor: number
  customerPayableMinor: number
  storeCreditOverpaymentMinor: number
}

export interface BarcodeLabelResult {
  productId: string
  zpl: string
  html: string
}

export interface QualityInspectResult {
  batchId: string
  inspectedQty: number
  defectiveQty: number
  defectBps: number
  passed: boolean
  disposition: 'release' | 'quarantine'
}

export interface IntegrationHealthResult {
  status: string
  slaTargetUptimePct: number
  channels: ReadonlyArray<{
    key: string
    status: string
    avgLatencyMs?: number
    retryPolicy?: string
    mode?: string
  }>
}

export interface SupportTicketResult {
  ticketCode: string
  workspaceId: string
  priority: string
  category: string
  slaHours: number
  responseDueAt: string
  status: string
}

export interface TcoEstimateResult {
  currency: string
  monthlyTotalMinor: number
  annualGrossMinor: number
  annualDiscountMinor: number
  annualNetMinor: number
}

export interface WorkspaceExportBundleResult {
  workspaceId: string
  exportedAt: string
  formats: string[]
  markdownBytes: number
  backup: unknown
}

export function useTableBillSummary() {
  return useMutation({
    mutationFn: async (input: {
      subtotalMinor: number
      serviceChargeBps: number
      tipMinor: number
      staffIds?: string[] | undefined
      seatAmountsMinor?: number[] | undefined
    }) => {
      const { data } = await apiClient.post<{ data: TableBillSummaryResult }>(
        '/orders/table-service/bill-summary',
        input,
      )
      return data.data
    },
  })
}

export function useCreateLayaway() {
  return useMutation({
    mutationFn: async (input: {
      orderId?: string | undefined
      totalMinor: number
      depositMinor: number
      installmentCount: number
      currency: string
    }) => {
      const { data } = await apiClient.post<{ data: LayawayScheduleResult }>(
        '/orders/layaway',
        input,
      )
      return data.data
    },
  })
}

export function useTradeInQuote() {
  return useMutation({
    mutationFn: async (input: {
      newItemPriceMinor: number
      tradeInAppraisedMinor: number
      conditionDeductionMinor: number
      currency: string
    }) => {
      const { data } = await apiClient.post<{ data: TradeInQuoteResult }>(
        '/exchange/trade-in/quote',
        input,
      )
      return data.data
    },
  })
}

export function useGenerateBarcodeLabel() {
  return useMutation({
    mutationFn: async ({
      productId,
      ...body
    }: {
      productId: string
      title: string
      barcode: string
      priceLabel: string
      sku?: string | undefined
      variantLabel?: string | undefined
      expiryDate?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: BarcodeLabelResult }>(
        `/products/${productId}/barcode-label`,
        body,
      )
      return data.data
    },
  })
}

export function useInspectQualityBatch() {
  return useMutation({
    mutationFn: async (input: {
      batchId: string
      inspectedQty: number
      defectiveQty: number
      maxDefectBps: number
    }) => {
      const { data } = await apiClient.post<{ data: QualityInspectResult }>(
        '/quality-events/inspect',
        input,
      )
      return data.data
    },
  })
}

export function useRmaDisposition() {
  return useMutation({
    mutationFn: async (input: {
      condition: 'defective_doa' | 'repairable' | 'damaged_customer' | 'sealed_resellable'
      underWarranty: boolean
    }) => {
      const { data } = await apiClient.post<{ data: { resolution: string } }>(
        '/warranties/rma/disposition',
        input,
      )
      return data.data
    },
  })
}

export function useCheckImei() {
  return useMutation({
    mutationFn: async (input: {
      imei: string
      blacklist?: ReadonlyArray<{ imei: string; reason: string; reportedAt: string }> | undefined
    }) => {
      const { data } = await apiClient.post<{
        data: { blocked: boolean; validLuhn: boolean; entry: { reason: string } | null }
      }>('/repair-tickets/imei/check', input)
      return data.data
    },
  })
}

export function useDecodeVin() {
  return useMutation({
    mutationFn: async (vin: string) => {
      const { data } = await apiClient.post<{ data: { valid: boolean; vin: string } }>(
        '/vehicles/vin/decode',
        { vin },
      )
      return data.data
    },
  })
}

export function useReconcileCodBatch() {
  return useMutation({
    mutationFn: async (
      parcels: ReadonlyArray<{
        parcelId: string
        collectedMinor: number
        courierFeeMinor: number
        delivered: boolean
      }>,
    ) => {
      const { data } = await apiClient.post<{
        data: {
          deliveredCount: number
          returnedCount: number
          grossCollectedMinor: number
          totalFeesMinor: number
          netMerchantPayoutMinor: number
        }
      }>('/deliveries/cod/reconcile-batch', { parcels })
      return data.data
    },
  })
}

export function useEvaluateFleetCompliance() {
  return useMutation({
    mutationFn: async (input: {
      currentKm: number
      nextServiceKm: number
      insuranceExpiresAt: string
      asOfIso: string
    }) => {
      const { data } = await apiClient.post<{
        data: { serviceDue: boolean; insuranceExpired: boolean; compliant: boolean }
      }>('/transport/fleet/compliance', input)
      return data.data
    },
  })
}

export function useScoreSupplier() {
  return useMutation({
    mutationFn: async (input: {
      totalOrders: number
      onTimeOrders: number
      defectiveOrders: number
    }) => {
      const { data } = await apiClient.post<{
        data: { score: number | null; tier: 'A' | 'B' | 'C' | 'UNKNOWN' }
      }>('/purchase-orders/supplier-score', input)
      return data.data
    },
  })
}

export function useAllocateLandedCost() {
  return useMutation({
    mutationFn: async (input: {
      freightMinor: number
      customsMinor: number
      insuranceMinor: number
      lines: ReadonlyArray<{ lineId: string; quantity: number; lineValueMinor: number }>
    }) => {
      const { data } = await apiClient.post<{
        data: {
          totalExtraMinor: number
          totalValueMinor: number
          allocations: ReadonlyArray<{
            lineId: string
            allocatedExtraMinor: number
            landedLineTotalMinor: number
            landedUnitMinor: number
          }>
        }
      }>('/purchase-orders/landed-cost-allocate', input)
      return data.data
    },
  })
}

export function useVatCurrencySummary() {
  return useMutation({
    mutationFn: async (
      lines: ReadonlyArray<{
        currency: string
        kind: 'sale' | 'purchase'
        netMinor: number
        vatMinor: number
      }>,
    ) => {
      const { data } = await apiClient.post<{
        data: ReadonlyArray<{
          currency: string
          outputVatMinor: number
          inputVatMinor: number
          netPayableMinor: number
        }>
      }>('/tax/return/currency-summary', { lines })
      return data.data
    },
  })
}

export function useMatchBankTransactions() {
  return useMutation({
    mutationFn: async (input: {
      maxDateDiffDays?: number | undefined
      feed: ReadonlyArray<{
        id: string
        date: string
        currency: string
        amountMinor: number
        reference: string
      }>
      candidates: ReadonlyArray<{
        id: string
        date: string
        currency: string
        amountMinor: number
        reference: string
      }>
    }) => {
      const { data } = await apiClient.post<{
        data: ReadonlyArray<{
          feedId: string
          candidateId: string | null
          confidence: 'exact_ref' | 'amount_date' | 'unmatched'
        }>
      }>('/financing/bank-match', input)
      return data.data
    },
  })
}

export function useEvaluateFxKyc() {
  return useMutation({
    mutationFn: async (input: {
      dailyAccumulatedMinor: number
      requestedMinor: number
      kycThresholdMinor: number
      dailyCapMinor: number
      hasVerifiedIdDocument: boolean
    }) => {
      const { data } = await apiClient.post<{
        data: { allowed: boolean; reason: 'OK' | 'KYC_DOCUMENT_REQUIRED' | 'DAILY_LIMIT_EXCEEDED' }
      }>('/fx/kyc/evaluate', input)
      return data.data
    },
  })
}

export function useConsolidatedSummary() {
  return useMutation({
    mutationFn: async (
      entities: ReadonlyArray<{
        entityId: string
        currency: string
        revenueMinor: number
        expenseMinor: number
        intercompanyEliminationMinor: number
      }>,
    ) => {
      const { data } = await apiClient.post<{
        data: ReadonlyArray<{
          currency: string
          grossRevenueMinor: number
          consolidatedRevenueMinor: number
          totalExpenseMinor: number
          netProfitMinor: number
        }>
      }>('/accounting/consolidated-summary', { entities })
      return data.data
    },
  })
}

export function useEvaluateContractGuarantee() {
  return useMutation({
    mutationFn: async (input: {
      guaranteeNumber: string
      amountMinor: number
      contractValueMinor: number
      expiresAt: string
      asOfIso: string
    }) => {
      const { data } = await apiClient.post<{
        data: { guaranteeNumber: string; coverageBps: number; expired: boolean; active: boolean }
      }>('/contracts/guarantees/evaluate', input)
      return data.data
    },
  })
}

export function useScheduleSubscriptionCycle() {
  return useMutation({
    mutationFn: async (input: {
      contractId: string
      currentPeriodEnd: string
      cycleDays: number
      graceDays: number
      amountMinor: number
    }) => {
      const { data } = await apiClient.post<{
        data: {
          contractId: string
          nextBillingDate: string
          gracePeriodEnd: string
          status: string
        }
      }>('/contracts/subscriptions/next-cycle', input)
      return data.data
    },
  })
}

export function useESignContract() {
  return useMutation({
    mutationFn: async ({
      contractId,
      ...body
    }: {
      contractId: string
      signerName: string
      signerEmail?: string | undefined
      documentSha256: string
    }) => {
      const { data } = await apiClient.post<{
        data: { contractId: string; signerName: string; signedAt: string; status: string }
      }>(`/contracts/${contractId}/e-sign`, body)
      return data.data
    },
  })
}

export function useAllocateWaitlist() {
  return useMutation({
    mutationFn: async (input: {
      capacity: number
      confirmedIds: string[]
      waitlistIds: string[]
      applicantId: string
    }) => {
      const { data } = await apiClient.post<{
        data: { status: string; confirmedIds: string[]; waitlistIds: string[] }
      }>('/appointments/waitlist/allocate', input)
      return data.data
    },
  })
}

export function useEvaluateNoShowFee() {
  return useMutation({
    mutationFn: async (input: {
      depositMinor: number
      noShowFeeMinor: number
      hoursBeforeAppointment: number
      freeCancelWindowHours: number
    }) => {
      const { data } = await apiClient.post<{
        data: { withinFreeWindow: boolean; forfeitedMinor: number; refundableMinor: number }
      }>('/appointments/no-show-fee', input)
      return data.data
    },
  })
}

export function useCreateChangeOrder() {
  return useMutation({
    mutationFn: async ({
      projectId,
      ...body
    }: {
      projectId: string
      title: string
      originalBudgetMinor: number
      deltaMinor: number
      estimatedCostDeltaMinor: number
      approved: boolean
    }) => {
      const { data } = await apiClient.post<{
        data: {
          projectId: string
          revisedBudgetMinor: number
          netMarginDeltaMinor: number
          status: string
        }
      }>(`/projects/${projectId}/change-orders`, body)
      return data.data
    },
  })
}

export function useEstimateBillingTco() {
  return useMutation({
    mutationFn: async (input: {
      basePlanMonthlyMinor: number
      extraUsers: number
      perUserMonthlyMinor: number
      extraBranches: number
      perBranchMonthlyMinor: number
      addonsMonthlyMinor: number
      annualDiscountBps: number
      currency: string
    }) => {
      const { data } = await apiClient.post<{ data: TcoEstimateResult }>(
        '/billing/tco-estimate',
        input,
      )
      return data.data
    },
  })
}

export function useCreateSupportTicket() {
  return useMutation({
    mutationFn: async (input: {
      subject: string
      priority: 'low' | 'normal' | 'high' | 'critical'
      category: 'billing' | 'sync' | 'accounting' | 'pos' | 'other'
      description: string
    }) => {
      const { data } = await apiClient.post<{ data: SupportTicketResult }>(
        '/v1/support-tickets',
        input,
      )
      return data.data
    },
  })
}

export function useIntegrationHealth() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['marketplace', 'integrations', 'health'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: IntegrationHealthResult }>(
        '/marketplace/integrations/health',
      )
      return data.data
    },
    enabled: ready,
  })
}

export function useWorkspaceExportBundle() {
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data } = await apiClient.get<{ data: WorkspaceExportBundleResult }>(
        `/workspaces/${workspaceId}/export-bundle`,
      )
      return data.data
    },
  })
}

export function useQrWhatsappCatalog() {
  return useMutation({
    mutationFn: async (input: {
      tableNumber?: string | undefined
      whatsappPhone?: string | undefined
      publishableKey: string
    }) => {
      const { data } = await apiClient.get<{
        data: {
          items: unknown[]
          qrMenuPath: string
          whatsappUrl: string | null
          tableNumber: string | null
        }
      }>('/public/v1/catalog/qr-whatsapp', {
        params: {
          ...(input.tableNumber ? { tableNumber: input.tableNumber } : {}),
          ...(input.whatsappPhone ? { whatsappPhone: input.whatsappPhone } : {}),
        },
        headers: { 'Hisabche-Publishable-Key': input.publishableKey },
      })
      return data.data
    },
  })
}
