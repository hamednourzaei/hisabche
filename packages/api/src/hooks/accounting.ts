// ============================================
// Accounting Hooks — TanStack Query
// FIXED: اضافه شدن Realtime روی جداول accounts، journal_entries و
// journal_lines.
//
// نکته: سه جدول کاملاً جدا داریم که هرکدام subscription مستقل خود
// را می‌خواهند. برای سادگی و جلوگیری از سه کانال هم‌زمان، هر سه
// subscription روی accountingKeys.all invalidate می‌کنند — یعنی با
// تغییر هرکدام از این جداول، تمام صفحات حسابداری (accounts, journal,
// trial-balance, balance-sheet, income-statement) که مشتق از همین
// داده‌ها هستند، invalidate می‌شوند. این ساده‌تر از invalidate
// دقیق و جداگانه‌ی هر بخش است و چون این صفحات معمولاً پرترافیک
// نیستند، هزینه‌ی اضافی invalidate کردن بیشتر از حد لازم ناچیز است.
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'

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

  // ✅ FIX: subscription realtime برای جدول accounts — با
  // accountingKeys.all، تمام صفحات مشتق‌شده (trial balance, balance
  // sheet, ...) هم پوشش داده می‌شوند.
  useRealtime({ table: 'accounts', queryKey: accountingKeys.all as unknown as string[] })

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

  // ✅ FIX: subscription realtime برای journal_entries — جدا از
  // accounts چون جدول کاملاً متفاوتی است، ولی هر دو یک queryKey
  // مشترک (accountingKeys.all) را invalidate می‌کنند.
  useRealtime({ table: 'journal_entries', queryKey: accountingKeys.all as unknown as string[] })

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

  // ✅ FIX: subscription realtime برای journal_lines — چون
  // trial-balance مستقیماً از خطوط دفتر کل (journal_lines) محاسبه
  // می‌شود، این صفحه باید با هر تغییر در آن‌ها بلافاصله invalidate
  // شود. سومین و آخرین جدول جدا در این فایل.
  useRealtime({ table: 'journal_lines', queryKey: accountingKeys.all as unknown as string[] })

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

// ⚠️ توجه: useBalanceSheet و useIncomeStatement عمداً subscription
// realtime جدای خودشان را ندارند. هر دو از همان جداول (accounts,
// journal_entries, journal_lines) مشتق می‌شوند که توسط
// useAccounts/useJournalEntries/useTrialBalance پوشش داده شده‌اند؛
// اگر این صفحات بدون هیچ‌کدام از آن هوک‌ها در همان صفحه استفاده
// شوند، به‌روزرسانی realtime نخواهند داشت.
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