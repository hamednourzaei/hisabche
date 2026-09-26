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
import { asList } from '../lib/as-list'

// ═══ Types ═══
export type AccountRootType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountRootType
  /** What automatic posting uses this account FOR. Null for ordinary accounts. */
  role: string | null
  parentId: string | null
  /** A group organises the tree and can never carry a posting of its own. */
  isGroup: boolean
  isActive: boolean
  createdAt: string | null
}

export type JournalEntryStatus = 'draft' | 'posted' | 'reversed' | 'cancelled'

export interface JournalEntry {
  id: string
  entryNumber: string | null
  date: string
  description: string
  reference: string
  /** Only a 'posted' entry is in the books. A draft shows in no report. */
  status: JournalEntryStatus
  sourceType: string | null
  sourceId: string | null
  reversalOf: string | null
  postedAt: string | null
  lines: JournalLine[]
}

export interface JournalLine {
  id: string
  accountId: string
  accountCode?: string
  accountName?: string
  debit: number
  credit: number
}

export interface TrialBalance {
  accountId: string
  accountCode: string
  accountName: string
  accountType: AccountRootType
  debit: number
  credit: number
  /** Signed on the account's natural side: negative is a real reversed balance. */
  balance: number
}

/**
 * The trial balance now arrives with its own totals. `difference` is the one
 * number that says the ledger is intact — anything but zero is damage, and the
 * screen shows it rather than adding the columns up again itself.
 */
export interface TrialBalanceResult {
  rows: TrialBalance[]
  totalDebit: number
  totalCredit: number
  difference: number
  fromDate: string | null
  toDate: string
}

export interface BalanceSheet {
  asOf: string
  assets: TrialBalance[]
  liabilities: TrialBalance[]
  equity: TrialBalance[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  /** Revenue less expenses, carried into equity. Not a balance sheet line. */
  currentYearEarnings: number
  /** assets − (liabilities + equity). Anything but 0 is a bug, not a figure. */
  outOfBalanceBy: number
}

export interface IncomeStatement {
  fromDate: string
  toDate: string
  revenue: TrialBalance[]
  expenses: TrialBalance[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}

// ═══ Query Keys ═══
export const accountingKeys = {
  all: ['accounting'] as const,
  accounts: () => [...accountingKeys.all, 'accounts'] as const,
  journalEntries: () => [...accountingKeys.all, 'journal'] as const,
  /**
   * K4 — the branch is part of every report key.
   *
   * `null` is the consolidated business. A branch figure and the consolidated
   * one are different answers to the same question, so sharing a key would
   * render one under the other's heading.
   */
  trialBalance: (date: string, branchId: string | null = null) =>
    [...accountingKeys.all, 'trialBalance', date, branchId ?? 'all'] as const,
  balanceSheet: (date: string, branchId: string | null = null) =>
    [...accountingKeys.all, 'balanceSheet', date, branchId ?? 'all'] as const,
  incomeStatement: (from: string, to: string, branchId: string | null = null) =>
    [...accountingKeys.all, 'income', from, to, branchId ?? 'all'] as const,
  /**
   * H3 — the lines behind one account, for one window.
   *
   * The dates are part of the key: the same account over two periods is two
   * different answers, and sharing a key would show a figure drilled from
   * January under a March heading.
   */
  generalLedger: (accountId: string, from: string, to: string) =>
    [...accountingKeys.all, 'generalLedger', accountId, from, to] as const,
}

/** One posted line in an account's ledger. */
export interface GeneralLedgerLine {
  lineId: string
  entryId: string
  entryNumber: string
  date: string
  description: string
  reference: string
  /** What produced this line — 'invoice', 'payment', 'manual'… */
  sourceType: string | null
  sourceId: string | null
  debit: number
  credit: number
  /** Running balance in the account's natural direction, INCLUDING opening. */
  balance: number
}

export interface GeneralLedgerResult {
  accountId: string
  accountCode: string
  accountName: string
  from: string | null
  to: string | null
  /**
   * What the account held before the window opened.
   *
   * Not decoration: without it the first row's running balance starts at zero
   * and every figure below it is wrong by the opening amount — while still
   * looking perfectly self-consistent.
   */
  openingBalance: number
  closingBalance: number
  lines: GeneralLedgerLine[]
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
      return asList<Account>(data)
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
      return asList<JournalEntry>(data)
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

export function useTrialBalance(date: string, branchId: string | null = null) {
  const authReady = useAuthReady()

  // ✅ FIX: subscription realtime برای journal_lines — چون
  // trial-balance مستقیماً از خطوط دفتر کل (journal_lines) محاسبه
  // می‌شود، این صفحه باید با هر تغییر در آن‌ها بلافاصله invalidate
  // شود. سومین و آخرین جدول جدا در این فایل.
  useRealtime({ table: 'journal_lines', queryKey: accountingKeys.all as unknown as string[] })

  return useQuery({
    // K4 — the branch is part of the KEY. A trial balance for one branch and
    // the consolidated one are two different answers; sharing a cache key
    // would show the branch figure under an «all branches» heading.
    queryKey: accountingKeys.trialBalance(date, branchId),
    queryFn: async (): Promise<TrialBalanceResult> => {
      const { data } = await apiClient.get('/accounting/trial-balance', {
        // `undefined`, not `null` — axios drops an undefined param and
        // serialises a null one as the string "null", which the server would
        // then treat as a branch id and match nothing.
        params: { date, branchId: branchId ?? undefined },
      })
      return data
    },
    enabled: authReady && !!date,
    staleTime: 60_000,
  })
}

/**
 * H3 — the journal lines behind one account, for the period on screen.
 *
 * `GET /accounting/general-ledger` has existed since the accounting module was
 * written and had **no callers at all**: the drill-down data was there and no
 * screen could reach it. Every figure in the Trial Balance, the Balance Sheet
 * and the Income Statement was a dead end.
 *
 * ⚠️ `enabled` gates on `accountId`, so mounting the drawer closed costs
 * nothing. The dates are passed through as given — an empty `from` means «from
 * the beginning», which the server reads as an opening balance of zero.
 */
export function useGeneralLedger(accountId: string | undefined, fromDate: string, toDate: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.generalLedger(accountId ?? '', fromDate, toDate),
    queryFn: async (): Promise<GeneralLedgerResult> => {
      const { data } = await apiClient.get('/accounting/general-ledger', {
        params: { accountId, fromDate: fromDate || undefined, toDate: toDate || undefined },
      })
      return data
    },
    enabled: authReady && Boolean(accountId),
    staleTime: 60_000,
  })
}

// ⚠️ توجه: useBalanceSheet و useIncomeStatement عمداً subscription
// realtime جدای خودشان را ندارند. هر دو از همان جداول (accounts,
// journal_entries, journal_lines) مشتق می‌شوند که توسط
// useAccounts/useJournalEntries/useTrialBalance پوشش داده شده‌اند؛
// اگر این صفحات بدون هیچ‌کدام از آن هوک‌ها در همان صفحه استفاده
// شوند، به‌روزرسانی realtime نخواهند داشت.
export function useBalanceSheet(date: string, branchId: string | null = null) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.balanceSheet(date, branchId),
    queryFn: async (): Promise<BalanceSheet> => {
      const { data } = await apiClient.get('/accounting/balance-sheet', {
        params: { date, branchId: branchId ?? undefined },
      })
      return data
    },
    enabled: authReady && !!date,
    staleTime: 60_000,
  })
}

export function useIncomeStatement(from: string, to: string, branchId: string | null = null) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: accountingKeys.incomeStatement(from, to, branchId),
    queryFn: async (): Promise<IncomeStatement> => {
      const { data } = await apiClient.get('/accounting/income-statement', {
        params: { from, to, branchId: branchId ?? undefined },
      })
      return data
    },
    enabled: authReady && !!from && !!to,
    staleTime: 60_000,
  })
}

// ─── Profit report (request #91) ─────────────────────────
// Per-product profit, salaries and net profit from the accounting core
// (GET /accounting/profit-report). Under `payments` so every invoice and
// payment mutation — which invalidate paymentKeys.all — refreshes it.

export interface ProductProfitRow {
  productId: string | null
  name: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  marginPercent: number | null
  costMissing: boolean
  costEstimated: boolean
}

export interface ProfitReport {
  from: string
  to: string
  currency: string
  products: ProductProfitRow[]
  totals: {
    revenue: number
    cost: number
    grossProfit: number
    salaries: number
    netProfit: number
    netMarginPercent: number | null
    invoiceCount: number
    payrollCount: number
  }
  otherCurrencies: Array<{ currency: string; invoices: number; payrolls: number }>
}

/**
 * Every currency's profit report for the range — one per currency with
 * documents in it (plus the primary), never summed across currencies
 * (GET /accounting/profit-report/by-currency).
 */
export function useProfitReportsByCurrency(from: string, to: string, currency: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: ['payments', 'profit-report', 'by-currency', from, to, currency],
    queryFn: async ({ signal }): Promise<ProfitReport[]> => {
      const { data } = await apiClient.get('/accounting/profit-report/by-currency', {
        params: { from, to, currency },
        signal,
      })
      return asList<ProfitReport>(data).map((report) => ({
        ...report,
        products: asList<ProductProfitRow>(report.products),
        otherCurrencies: asList<ProfitReport['otherCurrencies'][number]>(report.otherCurrencies),
      }))
    },
    enabled: authReady && !!from && !!to && !!currency,
    staleTime: 30_000,
  })
}
