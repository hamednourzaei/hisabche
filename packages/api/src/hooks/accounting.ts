// ============================================
// Accounting Hooks — TanStack Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══
export interface Account {
  id: string; code: string; name: string; type: string;
  parentId?: string; isActive: boolean; createdAt: string;
}

export interface JournalEntry {
  id: string; date: string; description: string; reference?: string;
  lines: JournalLine[];
}

export interface JournalLine {
  id: string; accountId: string; debit: number; credit: number;
}

export interface TrialBalance {
  accountId: string; accountCode: string; accountName: string;
  accountType: string; debit: number; credit: number; balance: number;
}

export interface BalanceSheet {
  assets: { total: number; details: any[] };
  liabilities: { total: number; details: any[] };
  equity: { total: number; details: any[] };
}

export interface IncomeStatement {
  revenue: number; expenses: number; netIncome: number;
}

// ═══ Query Keys ═══
export const accountingKeys = {
  all: ['accounting'] as const,
  accounts: () => [...accountingKeys.all, 'accounts'] as const,
  journalEntries: () => [...accountingKeys.all, 'journal'] as const,
  trialBalance: (date: string) => [...accountingKeys.all, 'trialBalance', date] as const,
  balanceSheet: (date: string) => [...accountingKeys.all, 'balanceSheet', date] as const,
  incomeStatement: (from: string, to: string) => [...accountingKeys.all, 'income', from, to] as const,
}

// ═══ Hooks ═══
export function useAccounts() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.accounts(),
    queryFn: async (): Promise<Account[]> => {
      const { data } = await apiClient.get('/accounting/accounts')
      return data
    },
    enabled: authReady,
    staleTime: 5 * 60_000,
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/accounting/accounts', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.accounts() })
    },
  })
}

export function useJournalEntries() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.journalEntries(),
    queryFn: async (): Promise<JournalEntry[]> => {
      const { data } = await apiClient.get('/accounting/journal')
      return data
    },
    enabled: authReady,
    staleTime: 2 * 60_000,
  })
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: any) => {
      const { data } = await apiClient.post('/accounting/journal', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.journalEntries() })
      queryClient.invalidateQueries({ queryKey: accountingKeys.trialBalance('') })
    },
  })
}

export function useTrialBalance(date: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.trialBalance(date),
    queryFn: async (): Promise<TrialBalance[]> => {
      const { data } = await apiClient.get('/accounting/trial-balance', { params: { date } })
      return data
    },
    enabled: authReady && !!date,
    staleTime: 60_000,
  })
}

export function useBalanceSheet(date: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.balanceSheet(date),
    queryFn: async (): Promise<BalanceSheet> => {
      const { data } = await apiClient.get('/accounting/balance-sheet', { params: { date } })
      return data
    },
    enabled: authReady && !!date,
    staleTime: 60_000,
  })
}

export function useIncomeStatement(from: string, to: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.incomeStatement(from, to),
    queryFn: async (): Promise<IncomeStatement> => {
      const { data } = await apiClient.get('/accounting/income-statement', { params: { from, to } })
      return data
    },
    enabled: authReady && !!from && !!to,
    staleTime: 60_000,
  })
}