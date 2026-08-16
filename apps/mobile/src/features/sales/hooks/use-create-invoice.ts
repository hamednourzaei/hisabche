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

      const { isConnected } = await NetInfo.fetch()
      if (!isConnected) {
        enqueue({ clientId: newClientId(), kind: 'invoice.create', payload: parsed })
        return { queued: true, invoiceId: null }
      }

      try {
        const created = await mutation.mutateAsync(parsed)
        await queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
        return { queued: false, invoiceId: created.id ?? null }
      } catch (error) {
        // Server unreachable mid-flight — fall back to the outbox rather
        // than losing the user's work.
        enqueue({ clientId: newClientId(), kind: 'invoice.create', payload: parsed })
        return { queued: true, invoiceId: null }
      }
    },
    [enqueue, mutation, queryClient],
  )

  return { submit, isSubmitting: mutation.isPending }
}
