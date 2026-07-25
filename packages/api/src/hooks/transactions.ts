// ============================================
// Transaction Hooks — TanStack Query
// FIXED: اضافه شدن Realtime روی جدول transactions — با هر
// INSERT/UPDATE/DELETE، هم لیست تراکنش‌ها و هم خلاصه‌ی ledger
// بلافاصله invalidate می‌شوند.
//
// نکته: برخلاف invoices/products/customers، اینجا یک queryKey واحد
// کافی نیست چون transactionKeys.ledger از یک namespace کاملاً جدا
// (['ledger', ...]) استفاده می‌کند، نه زیرمجموعه‌ی ['transactions'].
// useRealtime عمومی فقط یک queryKey ثابت می‌پذیرد، پس اینجا مستقیم
// از subscribeToChannel استفاده شده تا در callback هر دو namespace
// (transactions و ledger) با یک subscription واحد invalidate شوند.
// ============================================

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import type { Transaction, CreateTransaction, TransactionFilters, LedgerSummary } from '@hisabche/validation'

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  ledger: (customerId?: string) => ['ledger', customerId] as const,
}

export function useTransactions(filters: TransactionFilters = { page: 1, limit: 20, sortDirection: 'desc' }) {
  const authReady = useAuthReady()
  const queryClient = useQueryClient()
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null)

  // ✅ FIX: تنها subscription realtime برای جدول transactions —
  // با هر تغییر، هم transactionKeys.all و هم تمام ledger ها
  // (['ledger']) با هم invalidate می‌شوند. از subscribeToChannel
  // مستقیم استفاده شده (نه useRealtime عمومی) چون useRealtime فقط
  // یک queryKey واحد می‌پذیرد و اینجا دو namespace جدا داریم.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!authReady) return

    channelRef.current?.unsubscribe()
    let cancelled = false

    import('../supabase/realtime')
      .then(({ subscribeToChannel }) => {
        subscribeToChannel('transactions', () => {
          queryClient.invalidateQueries({ queryKey: transactionKeys.all })
          queryClient.invalidateQueries({ queryKey: ['ledger'] })
        })
          .then((ch) => {
            if (cancelled) {
              ch.unsubscribe()
              return
            }
            channelRef.current = ch
          })
          .catch((err: Error) => {
            console.warn('[useTransactions] Failed to subscribe to transactions:', err.message)
          })
      })
      .catch((err: Error) => {
        console.warn('[useTransactions] Failed to import realtime module:', err.message)
      })

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady])

  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: async () => {
      const response = await apiClient.get<{ transactions: Transaction[]; total: number }>('/transactions', { params: filters })
      return (response as any).data || response
    },
    enabled: authReady,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTransaction) => {
      const response = await apiClient.post<Transaction>('/transactions', input)
      return (response as any).data || response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
  })
}

// ⚠️ توجه: این هوک عمداً subscription realtime جدای خودش را ندارد.
// به‌روزرسانی realtime آن از طریق subscription موجود در
// useTransactions (که باید در همان صفحه mount باشد) تأمین می‌شود.
export function useLedger(customerId?: string, supplierId?: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: transactionKeys.ledger(customerId || supplierId),
    queryFn: async () => {
      const params = customerId ? { customerId } : { supplierId }
      const response = await apiClient.get<LedgerSummary>('/transactions/ledger', { params })
      return (response as any).data || response
    },
    enabled: authReady && !!(customerId || supplierId),
  })
}