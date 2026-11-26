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
import apiClient, { localRequest } from '../lib/client'
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
  restorable: false
  rowCapPerTable: number
  truncatedTables: string[]
  failedTables: Array<{ name: string; error: string }>
  checksumSha256: string
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

export function useWorkspaceRestorePreview() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      backup,
    }: {
      workspaceId: string
      backup: {
        meta: {
          workspaceId: string
          schemaVersion: string
          truncatedTables?: string[]
          checksumSha256?: string
        }
        data: Record<string, Array<Record<string, unknown>>>
      }
    }) => {
      const { data } = await apiClient.post<{
        data: {
          dryRunOnly: true
          restoreExecutionSupported: boolean
          recoveryScope: string
          valid: boolean
          workspaceMatch: boolean
          schemaVersion: string
          truncatedInSource: string[]
          unknownTables: string[]
          duplicateIds: Array<{ table: string; id: string }>
          missingIdTables: string[]
          crossTenantRows: Array<{ table: string; id: string; workspaceId: string }>
          malformedTimestamps: Array<{ table: string; id: string; field: string }>
          invalidCurrencies: Array<{ table: string; id: string; currency: string }>
          invalidMoneyRows: Array<{ table: string; id: string; field: string }>
          brokenForeignKeys: Array<{
            table: string
            id: string
            field: string
            targetTable: string
            targetId: string
          }>
          missingDependencyCount?: number
          existingConflicts: Array<{ table: string; id: string }>
          wouldCreate: number
          wouldUpdate?: number
          wouldSkip: number
          rejectedRows: number
          errors: string[]
          tableCounts: Record<string, number>
        }
      }>(`/workspaces/${workspaceId}/export-restore-preview`, backup)
      return data.data
    },
  })
}

export function useProjectChangeOrders(projectId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['projects', projectId ?? '', 'change-orders'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
        `/projects/${projectId}/change-orders`,
      )
      return data.data
    },
    enabled: ready && !!projectId,
  })
}

export function useDecideChangeOrder() {
  return useMutation({
    mutationFn: async ({
      projectId,
      orderId,
      decision,
    }: {
      projectId: string
      orderId: string
      decision: 'approved' | 'rejected'
    }) => {
      const { data } = await apiClient.post<{ data: Record<string, unknown> }>(
        `/projects/${projectId}/change-orders/${orderId}/decide`,
        { decision },
      )
      return data.data
    },
  })
}

export function useSupportTickets() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['support', 'tickets'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
        '/v1/support-tickets',
      )
      return data.data
    },
    enabled: ready,
  })
}

export function useUpdateSupportTicketStatus() {
  return useMutation({
    mutationFn: async ({
      ticketId,
      status,
      rcaSummary,
      reason,
    }: {
      ticketId: string
      status: 'acknowledged' | 'escalated' | 'resolved' | 'closed'
      rcaSummary?: string | undefined
      reason?: string | undefined
    }) => {
      const { data } = await apiClient.patch<{ data: Record<string, unknown> }>(
        `/v1/support-tickets/${ticketId}/status`,
        {
          status,
          ...(rcaSummary !== undefined ? { rcaSummary } : {}),
          ...(reason !== undefined ? { reason } : {}),
        },
      )
      return data.data
    },
  })
}

export function useAssignSupportTicket() {
  return useMutation({
    mutationFn: async ({
      ticketId,
      assigneeId,
    }: {
      ticketId: string
      assigneeId: string | null
    }) => {
      const { data } = await apiClient.post<{ data: Record<string, unknown> }>(
        `/v1/support-tickets/${ticketId}/assign`,
        { assigneeId },
      )
      return data.data
    },
  })
}

export function useSupportTicketEvents(ticketId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['support', 'tickets', ticketId ?? '', 'events'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
        `/v1/support-tickets/${ticketId}/events`,
      )
      return data.data
    },
    enabled: ready && !!ticketId,
  })
}

export function useSupportTicketComments(ticketId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['support', 'tickets', ticketId ?? '', 'comments'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
        `/v1/support-tickets/${ticketId}/comments`,
      )
      return data.data
    },
    enabled: ready && !!ticketId,
  })
}

export function useAddSupportTicketComment() {
  return useMutation({
    mutationFn: async ({
      ticketId,
      body: commentBody,
      isInternal = false,
    }: {
      ticketId: string
      body: string
      isInternal?: boolean | undefined
    }) => {
      const { data } = await apiClient.post<{ data: Record<string, unknown> }>(
        `/v1/support-tickets/${ticketId}/comments`,
        { body: commentBody, isInternal },
      )
      return data.data
    },
  })
}

export function useEvaluateSupportSla() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{
        data: {
          evaluatedCount: number
          escalatedTicketIds: string[]
          notificationFailures?: number
          checkedAt: string
        }
      }>('/v1/support-tickets/evaluate-sla', {})
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

export interface PaymentProcessorStateResult {
  paymentId: string
  processorState: 'queued_offline' | 'pending_capture' | 'captured' | 'declined' | 'voided'
  gatewayName: string | null
  externalRef: string | null
  feeMinor: number
  currency: string
  reason: string | null
  updatedAt: string
}

export function usePaymentProcessorState(paymentId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['payments', paymentId ?? '', 'processor-state'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: PaymentProcessorStateResult }>(
        `/payments/${paymentId}/processor-state`,
      )
      return data.data
    },
    enabled: ready && !!paymentId,
  })
}

export function useTransitionPaymentProcessorState() {
  return useMutation({
    mutationFn: async ({
      paymentId,
      processorState,
      gatewayName,
      externalRef,
      feeMinor,
      reason,
    }: {
      paymentId: string
      processorState: 'queued_offline' | 'pending_capture' | 'captured' | 'declined' | 'voided'
      gatewayName?: string | undefined
      externalRef?: string | undefined
      feeMinor?: number | undefined
      reason?: string | undefined
    }) => {
      const { data } = await apiClient.post<{ data: PaymentProcessorStateResult }>(
        `/payments/${paymentId}/processor-state`,
        {
          processorState,
          ...(gatewayName !== undefined ? { gatewayName } : {}),
          ...(externalRef !== undefined ? { externalRef } : {}),
          ...(feeMinor !== undefined ? { feeMinor } : {}),
          ...(reason !== undefined ? { reason } : {}),
        },
      )
      return data.data
    },
  })
}

export function usePaymentGatewayEvents(paymentId: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['payments', paymentId ?? '', 'gateway-events'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Array<Record<string, unknown>> }>(
        `/payments/${paymentId}/gateway-events`,
      )
      return data.data
    },
    enabled: ready && !!paymentId,
  })
}

export function usePaymentGatewayReconciliation() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['payments', 'gateway-reconciliation'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Record<string, unknown> }>(
        '/payments/gateway-reconciliation',
      )
      return data.data
    },
    enabled: ready,
  })
}

export function useReconcilePaymentSettlement() {
  return useMutation({
    mutationFn: async (input: { paymentId: string; reason?: string | undefined }) => {
      const { data } = await apiClient.post<{
        data: {
          paymentId: string
          currency: string
          processorState: string
          ledgerPosted: boolean
          settlementStatus: string
          reconciled: boolean
          checkedAt: string
        }
      }>(
        `/payments/${input.paymentId}/reconcile-settlement`,
        input.reason ? { reason: input.reason } : {},
      )
      return data.data
    },
  })
}

export interface CrossCoreReconciliationResult {
  workspaceId: string
  checkedAt: string
  status?: 'balanced' | 'unbalanced'
  balanced: boolean
  debits?: number
  credits?: number
  unallocated?: number
  underallocated?: number
  overallocated?: number
  orphaned?: number
  mismatched?: number
  missingPostings?: number
  duplicatePostings?: number
  advanceLiabilityMismatch?: number
  currencyMismatch?: number
  roundingDifference?: number
  reversalMismatch?: number
  exceptions?: ReadonlyArray<{
    code: string
    severity: 'error' | 'warning'
    currency: string | null
    entityType: string
    entityId: string
    amountMinor: number
    message: string
  }>
  orphanAllocationsCount: number
  perCurrency: ReadonlyArray<{
    currency: string
    invoicePaidMinor: number
    allocatedToInvoicesMinor: number
    invoicePaidVsAllocationsVarianceMinor: number
    paymentsTotalMinor: number
    overAllocatedPaymentsCount: number
  }>
  ledger: {
    postedDebitMinor: number
    postedCreditMinor: number
    debitCreditVarianceMinor: number
    unpostedInvoicesCount: number
    unpostedPaymentsCount: number
  }
}

export function useReconcileCrossCore() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ data: CrossCoreReconciliationResult }>(
        '/accounting/reconcile-cross-core',
        {},
      )
      return data.data
    },
  })
}

export function useLocalOpsRegisters() {
  return useMutation({
    mutationFn: async (input: {
      kind: 'asset' | 'manufacturing' | 'approval'
      payload: Record<string, unknown>
    }) => {
      if (input.kind === 'asset') {
        return localRequest('POST', '/local-ops/assets', input.payload)
      }
      if (input.kind === 'manufacturing') {
        return localRequest('POST', '/local-ops/manufacturing-defs', input.payload)
      }
      return localRequest('POST', '/local-ops/approvals', input.payload)
    },
  })
}

export function useReadLocalOpsRegister(
  kind: 'assets' | 'manufacturing-defs' | 'approvals' | null,
) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ['local-ops', kind ?? 'none'] as const,
    queryFn: async () => {
      if (kind === 'assets') {
        return localRequest('GET', '/local-ops/assets')
      }
      if (kind === 'manufacturing-defs') {
        return localRequest('GET', '/local-ops/manufacturing-defs')
      }
      return localRequest('GET', '/local-ops/approvals')
    },
    enabled: ready && kind !== null,
  })
}
