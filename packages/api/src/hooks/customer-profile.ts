// ============================================
// packages/api/src/hooks/customer-profile.ts
//
// Customer 360 phase 3 — Customer Profile Core (backend/src/services/customer-profile):
// credit limit, payment terms, linked supplier, documents.
//
// The profile key lives under `paymentKeys.all`: credit used is the receivable,
// so every payment/invoice mutation that invalidates payments refreshes it too.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { paymentKeys } from './payments'

export interface CreditControl {
  creditLimit: number
  used: number
  available: number
  usedPercent: number
  overLimit: boolean
}

export interface CustomerProfile {
  /** false until the phase-3 migration has been run on the database. */
  configured: boolean
  creditLimit: number | null
  paymentTermsDays: number | null
  credit: CreditControl | null
  linkedSupplier: { id: string; name: string } | null
  combined: {
    customerNet: number
    supplierPayable: number
    net: number
    mixedCurrencies: boolean
  } | null
}

export interface CustomerTermsInput {
  creditLimit?: number | null
  paymentTermsDays?: number | null
  supplierId?: string | null
}

export interface CustomerDocument {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  uploadedBy: string | null
}

export interface SupplierOption {
  id: string
  name: string
}

export const customerProfileKeys = {
  profile: (customerId?: string) => [...paymentKeys.all, 'customer-profile', customerId] as const,
  documents: (customerId?: string) => ['customer-documents', customerId] as const,
  supplierSearch: (search: string) => ['suppliers', 'search', search] as const,
}

const unwrap = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data
  }
  return response as T
}

export function useCustomerProfile(customerId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: customerProfileKeys.profile(customerId),
    queryFn: async () =>
      unwrap<CustomerProfile>(await apiClient.get(`/customers/${customerId}/profile`)),
    enabled: authReady && !!customerId,
  })
}

export function useUpdateCustomerTerms(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CustomerTermsInput) =>
      unwrap<CustomerProfile>(await apiClient.patch(`/customers/${customerId}/terms`, input)),
    onSuccess: (profile) => {
      queryClient.setQueryData(customerProfileKeys.profile(customerId), profile)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useCustomerDocuments(customerId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: customerProfileKeys.documents(customerId),
    queryFn: async () => {
      const body = unwrap<{ available?: boolean; documents?: unknown }>(
        await apiClient.get(`/customers/${customerId}/documents`),
      )
      return {
        available: body?.available === true,
        documents: asList<CustomerDocument>(body?.documents),
      }
    },
    enabled: authReady && !!customerId,
  })
}

export function useUploadCustomerDocument(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { fileName: string; mimeType: string; contentBase64: string }) =>
      unwrap<CustomerDocument>(await apiClient.post(`/customers/${customerId}/documents`, input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customerProfileKeys.documents(customerId) }),
  })
}

export function useRemoveCustomerDocument(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/customers/${customerId}/documents/${documentId}`)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customerProfileKeys.documents(customerId) }),
  })
}

/** A short-lived signed URL; fetched on click, never cached. */
export async function fetchCustomerDocumentUrl(customerId: string, documentId: string) {
  return unwrap<{ url: string }>(
    await apiClient.get(`/customers/${customerId}/documents/${documentId}/url`),
  ).url
}

/** Server-side search, so the 501st supplier is still findable. */
export function useSupplierSearch(search: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: customerProfileKeys.supplierSearch(search),
    queryFn: async () =>
      asList<Record<string, unknown>>(
        unwrap(await apiClient.get('/suppliers', { params: { search, isActive: 'true' } })),
      ).map(
        (row) => ({ id: String(row['id']), name: String(row['name'] ?? '') }) as SupplierOption,
      ),
    enabled: authReady && search.trim().length >= 2,
  })
}

// ─── Phase 4: accounting view and insights ────────────────────────────────

export interface CustomerEntryLine {
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export interface CustomerDocumentAccounting {
  sourceType: 'invoice' | 'payment'
  sourceId: string
  date: string
  kind: string
  reference: string
  amount: number
  unposted: boolean
  entries: Array<{
    id: string
    entryNumber: string | null
    date: string
    status: string
    reversalOf: string | null
    lines: CustomerEntryLine[]
  }>
}

export interface CustomerAccounting {
  documents: CustomerDocumentAccounting[]
  postedCount: number
  unpostedCount: number
}

export type CustomerInsightCode =
  | 'SALES_UP'
  | 'SALES_DOWN'
  | 'LOW_COLLECTION'
  | 'OVERDUE_SHARE_HIGH'
  | 'OVER_CREDIT_LIMIT'
  | 'NEAR_CREDIT_LIMIT'
  | 'INACTIVE'
  | 'UNPOSTED_DOCUMENTS'
  | 'NO_ACTIVITY'

export interface CustomerInsight {
  code: CustomerInsightCode
  severity: 'info' | 'warning' | 'critical' | 'positive'
  values: Record<string, number>
}

// Under paymentKeys.all: a payment or invoice changes both.
export const customerAnalysisKeys = {
  accounting: (customerId?: string) =>
    [...paymentKeys.all, 'customer-accounting', customerId] as const,
  insights: (customerId?: string) => [...paymentKeys.all, 'customer-insights', customerId] as const,
}

export function useCustomerAccounting(customerId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: customerAnalysisKeys.accounting(customerId),
    queryFn: async () => {
      const body = unwrap<Partial<CustomerAccounting>>(
        await apiClient.get(`/customers/${customerId}/accounting`),
      )
      return {
        documents: asList<CustomerDocumentAccounting>(body?.documents),
        postedCount: Number(body?.postedCount) || 0,
        unpostedCount: Number(body?.unpostedCount) || 0,
      }
    },
    enabled: authReady && !!customerId,
  })
}

export function useCustomerInsights(customerId?: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: customerAnalysisKeys.insights(customerId),
    queryFn: async () => {
      const body = unwrap<{ asOf?: string; insights?: unknown }>(
        await apiClient.get(`/customers/${customerId}/insights`),
      )
      return { asOf: String(body?.asOf ?? ''), insights: asList<CustomerInsight>(body?.insights) }
    },
    enabled: authReady && !!customerId,
  })
}
