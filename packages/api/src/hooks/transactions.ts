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
    },
  })
}

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