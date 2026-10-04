// ============================================
// Reading a photographed receipt or bill (#16 #30 #48 #49).
//
//   POST /ingest/read      { contentType, data }   → a DRAFT; nothing is written
//   POST /ingest/confirm   the draft as the person corrected it → one purchase invoice
//
// The server refuses (422, `INGEST_…`) rather than return an empty draft, and a
// document whose total could not be read is «unreadable», never zero.
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { aiKeys } from './ai-chat'
import { dashboardKeys } from './dashboard'
import { invoiceKeys } from './invoices'
import { paymentKeys } from './payments'

export type ReadConfidence = 'high' | 'medium' | 'low'

export interface ReadField<T> {
  value: T
  confidence: ReadConfidence
  /** What was printed, when it differs from `value` (an amount, as written). */
  raw?: string | null
}

export interface DocumentDraft {
  kind: 'invoice' | 'receipt' | 'bank_statement' | 'delivery_note' | 'unknown'
  fields: {
    /** Integer hundredths of the currency unit. */
    totalMinor: ReadField<number>
    taxMinor?: ReadField<number>
    documentNumber?: ReadField<string>
    /** The date exactly as printed — in whatever calendar the paper used. */
    issuedOn?: ReadField<string>
    supplierName?: ReadField<string>
    /** Lines that were read but could not be placed. Shown, never dropped. */
    unrecognisedLines: string[]
  }
}

export interface DocumentReading {
  draft: DocumentDraft
  confirmable: { ok: boolean; reason: string | null } | null
  /** A currency printed on the document, when it is one the product knows. */
  currency: string | null
}

export interface ConfirmDocumentInput {
  /** Made once per reviewed draft, resent unchanged on retry. */
  requestId: string
  supplierId: string
  currency: string
  issuedOn: string
  total: number
  description: string
  documentNumber: string | null
}

export function useReadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { contentType: string; data: string }): Promise<DocumentReading> => {
      const { data } = await apiClient.post<DocumentReading>('/ingest/read', input)
      return {
        ...data,
        draft: {
          ...data.draft,
          fields: {
            ...data.draft.fields,
            unrecognisedLines: asList<string>(data.draft?.fields?.unrecognisedLines),
          },
        },
      }
    },
    onSettled: () => {
      // Reading a document spends the same allowance as a question.
      void queryClient.invalidateQueries({ queryKey: aiKeys.availability() })
    },
  })
}

export function useConfirmDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ConfirmDocumentInput) =>
      (await apiClient.post<{ invoiceId: string }>('/ingest/confirm', input)).data,
    // A purchase invoice: the lists, the dashboard and what is owed all moved.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      void queryClient.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}
