// ============================================
// Create invoice — online through the shared mutation,
// offline through the durable outbox. Same call site either way.
// ============================================

import { useCallback } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateInvoice as useCreateInvoiceMutation, invoiceKeys } from '@hisabche/api'
import { createInvoiceSchema, type CreateInvoice } from '@hisabche/validation'

import { useOutboxStore } from '../../offline/outbox.store'

export interface CreateInvoiceResult {
  queued: boolean
  invoiceId?: string | null
}

/** No response, a timeout, throttling or a server fault: worth replaying. */
export function isRetryableFailure(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  if (!status) return true
  return status >= 500 || status === 408 || status === 429
}

function newClientId(): string {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function useSubmitInvoice() {
  const mutation = useCreateInvoiceMutation()
  const enqueue = useOutboxStore((s) => s.enqueue)
  const queryClient = useQueryClient()

  const submit = useCallback(
    async (draft: CreateInvoice): Promise<CreateInvoiceResult> => {
      // Validate with the same schema the backend uses.
      const parsed = createInvoiceSchema.parse(draft)

      // ⚠️ ONE ID FOR THIS SALE, WHICHEVER PATH IT TAKES. The online attempt
      // and the outbox fallback share it, and the server de-duplicates by it.
      // A fresh id for the fallback was a second sale whenever the first
      // request had reached the server and only its response was lost.
      const clientId = newClientId()

      const { isConnected } = await NetInfo.fetch()
      if (!isConnected) {
        enqueue({ clientId, kind: 'invoice.create', payload: parsed })
        return { queued: true, invoiceId: null }
      }

      try {
        const created = await mutation.mutateAsync({ ...parsed, idempotencyKey: clientId })
        await queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
        return { queued: false, invoiceId: created.id ?? null }
      } catch (error) {
        // Only an UNREACHED or unanswered request goes to the outbox. A 4xx is
        // the server refusing this invoice; queueing it would replay a refusal
        // forever, so the error is shown to the person instead.
        if (!isRetryableFailure(error)) throw error
        enqueue({ clientId, kind: 'invoice.create', payload: parsed })
        return { queued: true, invoiceId: null }
      }
    },
    [enqueue, mutation, queryClient],
  )

  return { submit, isSubmitting: mutation.isPending }
}
