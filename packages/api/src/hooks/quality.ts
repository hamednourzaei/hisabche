// ============================================
// packages/api/src/hooks/quality.ts
// V60 Slice 11 — Quality Events & Warranty Claims hooks
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'
import { useIntentKey } from '../lib/intent-key'

export interface QualityEventItem {
  id: string
  source_type: string
  source_id: string
  event_kind: string
  product_id: string | null
  serial_number: string | null
  quantity: number
  quarantine_warehouse_id: string | null
  notes: string | null
  actor_id: string
  occurred_at: string
}

export interface WarrantyClaimItem {
  id: string
  warranty_id: string
  claim_date: string
  issue_description: string
  status: string
  disposition: string
  repair_ticket_id: string | null
  resolution_notes: string | null
}

export const qualityKeys = {
  all: ['quality'] as const,
  events: (sourceType?: string, sourceId?: string) =>
    [...qualityKeys.all, 'events', sourceType ?? '', sourceId ?? ''] as const,
  claims: () => [...qualityKeys.all, 'claims'] as const,
}

export function useQualityEvents(filters?: { sourceType?: string; sourceId?: string }) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: qualityKeys.events(filters?.sourceType, filters?.sourceId),
    queryFn: async (): Promise<QualityEventItem[]> => {
      const params: Record<string, string> = {}
      if (filters?.sourceType) params.sourceType = filters.sourceType
      if (filters?.sourceId) params.sourceId = filters.sourceId
      const { data } = await apiClient.get('/quality-events', { params })
      return asList<QualityEventItem>(data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useRecordQualityEvent() {
  const queryClient = useQueryClient()
  const intent = useIntentKey('quality-event')
  return useMutation({
    mutationFn: async (input: {
      sourceType: 'receipt' | 'work_order' | 'delivery' | 'return' | 'repair'
      sourceId: string
      eventKind: 'check' | 'pass' | 'fail' | 'defect' | 'rework'
      productId?: string | undefined
      serialNumber?: string | undefined
      quantity?: number | undefined
      fromWarehouseId?: string | undefined
      quarantineWarehouseId?: string | undefined
      notes?: string | undefined
    }) => {
      const { data } = await apiClient.post('/quality-events', input, {
        headers: { 'Idempotency-Key': intent.current() },
      })
      return data
    },
    onError: (err) => intent.settle(err),
    onSuccess: () => {
      intent.settle()
      queryClient.invalidateQueries({ queryKey: qualityKeys.all })
    },
  })
}

export function useWarrantyClaims() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: qualityKeys.claims(),
    queryFn: async (): Promise<WarrantyClaimItem[]> => {
      const { data } = await apiClient.get('/warranty-claims')
      return asList<WarrantyClaimItem>(data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useSubmitWarrantyClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      warrantyId: string
      claimDate: string
      issueDescription: string
      disposition?: 'restock' | 'repair' | 'scrap' | 'replace' | undefined
      repairTicketId?: string | undefined
      resolutionNotes?: string | undefined
    }) => {
      const { data } = await apiClient.post('/warranty-claims', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qualityKeys.claims() })
    },
  })
}
