// ============================================
// packages/api/src/hooks/payments.ts
//
// The payments core, from the client side.
//
// WHY THIS FILE EXISTS (Phase B)
//
// `/api/payments` has existed on the backend since the AR/AP migration: it
// records a payment, allocates it against that party's open invoices, and books
// the journal entry. No client hook ever called it.
//
// So the web PaymentModal did the only thing it could reach — `POST
// /transactions` with `type: 'payment'` — which wrote a single-sided row that
//
//   * settled no invoice, so `invoice_outstanding` never moved,
//   * reached no journal entry, so the trial balance never saw the cash, and
//   * used 'payment', which in the party-ledger vocabulary means money paid
//     OUT. Taking 500 from a debtor increased their debt by 500.
//
// The address was right there. Nothing pointed at it.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

export type PaymentDirection = 'in' | 'out'
export type PaymentPartyType = 'customer' | 'supplier'

export interface RecordPaymentInput {
  /** 'in' — received from a customer. 'out' — paid to a supplier. */
  direction: PaymentDirection
  partyType: PaymentPartyType
  /** null only for a walk-in invoice — then `allocations` must name it. */
  partyId: string | null
  amount: number
  /** ISO date (YYYY-MM-DD). Defaults to today on the server. */
  entryDate?: string
  currency?: string
  method?: string
  reference?: string
  notes?: string
  /**
   * Which invoices this settles. OMIT to let the server settle the oldest open
   * invoices first — what a shopkeeper means by "he paid me 500". Anything left
   * over stays on the payment as an advance rather than being refused.
   */
  allocations?: { invoiceId: string; amount: number }[]
}

export interface PaymentRecord {
  id: string
  paymentNumber: string | null
  direction: PaymentDirection
  partyType: PaymentPartyType
  partyId: string | null
  amount: number
  currency: string
  method: string
  entryDate: string
  reference: string
  notes: string
  status: 'draft' | 'posted' | 'cancelled'
  /** Amount that settled no invoice — an advance on the party's account. */
  unallocated?: number
}

/**
 * Shape of GET /payments/open-invoices/:partyType/:partyId — the server's
 * `OpenInvoice` plus `outstanding` (payments.service#getOpenInvoices).
 * This type used to declare `id` / `date`, which the server never sends; it
 * had no consumer until Customer 360, so nothing noticed.
 */
export interface OpenInvoice {
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  /** Falls back to the invoice date on the server when unset. */
  dueDate: string
  total: number
  allocated: number
  outstanding: number
}

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown> = {}) => [...paymentKeys.lists(), filters] as const,
  openInvoices: (partyType: string, partyId?: string) =>
    [...paymentKeys.all, 'open-invoices', partyType, partyId] as const,
  // Under `payments` on purpose: recording or cancelling a payment invalidates
  // `paymentKeys.all`, so the party page refreshes with it.
  summary: (partyType: string, partyId?: string) =>
    [...paymentKeys.all, 'summary', partyType, partyId] as const,
  ledger: (partyType: string, partyId?: string) =>
    [...paymentKeys.all, 'ledger', partyType, partyId] as const,
}

export interface AgingBuckets {
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  over90: number
  total: number
}

/** Authoritative money figures for one party (GET /payments/summary/...). */
export interface PartySummary {
  asOf: string
  totalSales: number
  totalPurchases: number
  totalReceived: number
  totalPaid: number
  /** customers.opening_balance; already included in receivable/netBalance. */
  openingBalance: number
  receivable: number
  payable: number
  /** Positive: they owe us. */
  netBalance: number
  overdue: number
  dueToday: number
  dueLater: number
  aging: AgingBuckets
  invoiceCount: number
  openInvoiceCount: number
  overdueInvoiceCount: number
  lastSaleAt: string | null
  lastPaymentAt: string | null
  currencies: string[]
}

export interface PartyLedgerRow {
  date: string
  kind: 'sale' | 'purchase' | 'payment_in' | 'payment_out' | 'return'
  amount: number
  reference: string
  /** Running balance after this row. Positive: they owe us. */
  balance: number
  sourceType?: 'invoice' | 'payment'
  sourceId?: string
  currency?: string
  method?: string
}

export interface PartyLedger {
  partyType: PaymentPartyType
  partyId: string
  /** The running balance starts from this. */
  openingBalance: number
  movements: PartyLedgerRow[]
  balance: number
}

/**
 * The api client sometimes hands back the axios response and sometimes the
 * payload itself, depending on the interceptor path. Both shapes are unwrapped
 * here rather than at each call site.
 */
const unwrap = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data
  }
  return response as T
}

export function usePayments(
  filters: { partyId?: string; direction?: PaymentDirection; limit?: number } = {},
) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: async () =>
      unwrap<PaymentRecord[]>(await apiClient.get('/payments', { params: filters })),
    enabled: authReady,
    staleTime: 1000 * 30,
  })
}

/** Customer 360: totals, receivable/payable, overdue and aging — computed on the server. */
export function usePartySummary(partyType: PaymentPartyType, partyId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: paymentKeys.summary(partyType, partyId),
    queryFn: async () =>
      unwrap<PartySummary>(await apiClient.get(`/payments/summary/${partyType}/${partyId}`)),
    enabled: authReady && !!partyId,
  })
}

/** Every invoice and payment of the party with a running balance, oldest first. */
export function usePartyLedger(partyType: PaymentPartyType, partyId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: paymentKeys.ledger(partyType, partyId),
    queryFn: async () =>
      unwrap<PartyLedger>(await apiClient.get(`/payments/ledger/${partyType}/${partyId}`)),
    enabled: authReady && !!partyId,
  })
}

/** What this party still owes, invoice by invoice — the allocation targets. */
export function useOpenInvoices(partyType: PaymentPartyType, partyId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: paymentKeys.openInvoices(partyType, partyId),
    queryFn: async () =>
      unwrap<OpenInvoice[]>(
        // Path parameters, not a query string — the route is
        // GET /payments/open-invoices/:partyType/:partyId.
        //
        // `partyId` is non-null here: `enabled` below keeps the query from
        // running without one. Interpolated plainly rather than with a `??`
        // fallback so `client-route-contract.test.ts` can still read the path
        // out of the source — a guard that cannot parse the address it is
        // meant to check is a guard that passes by accident.
        await apiClient.get(`/payments/open-invoices/${partyType}/${partyId}`),
      ),
    enabled: authReady && !!partyId,
  })
}

/**
 * Record money moving.
 *
 * Everything downstream of a payment changes: the invoice's outstanding amount,
 * the party's balance, the ledger, and the dashboard's cash figure. All four are
 * invalidated here, because a payment that shows on one screen and not the next
 * is the shape of bug people stop trusting the app over.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) =>
      unwrap<PaymentRecord>(await apiClient.post('/payments', input)),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      // A cash payment is money in the cashier's drawer: the till must show it
      // without anyone entering it again.
      queryClient.invalidateQueries({ queryKey: ['till'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/**
 * Cancel a payment — T9's «حذف پرداخت».
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THIS IS A CANCELLATION, NOT A DELETE, AND THE DIFFERENCE IS THE POINT
 *
 * `POST /payments/:id/cancel` reopens the invoices the payment settled and
 * REVERSES its journal entry. The row stays, marked cancelled. Deleting it
 * would erase the fact that money was recorded and then unrecorded — and a
 * ledger you can quietly remove entries from is not a ledger.
 *
 * The reason is required by the server, not decorated on by the client: a
 * cancelled payment with no explanation is unauditable.
 */
export function useCancelPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      paymentId,
      reason,
      sodOverrideReason,
    }: {
      paymentId: string
      reason: string
      sodOverrideReason?: string
    }) =>
      unwrap<PaymentRecord>(
        await apiClient.post(`/payments/${paymentId}/cancel`, { reason, sodOverrideReason }),
      ),

    onSuccess: () => {
      // The same fan-out as recording one. A cancellation moves exactly the
      // same numbers in the opposite direction — the invoice's outstanding
      // balance, the customer's debt, the ledger and the dashboard.
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
