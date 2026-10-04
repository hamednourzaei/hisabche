// ============================================
// Bank reconciliation hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// A SUGGESTION IS A PROPOSAL, NEVER AN ACTION
//
// The server scores candidate matches and says WHY it scored them. It does not
// apply any of them. A person confirms every single one, one at a time, and
// this hook file offers no "accept all".
//
// That is not caution for its own sake. Two invoices for the same amount from
// the same customer in the same week is completely ordinary, and the server
// marks that pair `isAmbiguous`. Guessing sends a receipt to the wrong invoice,
// and the person who discovers it is the customer being chased for a debt they
// already paid.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'

// ═══ Types ═══

export type MatchReason =
  | 'exact_reference'
  | 'exact_amount_and_date'
  | 'exact_amount'
  | 'amount_within_tolerance'
  | 'party_name'
  | 'date_proximity'

export interface MatchSuggestion {
  statementLineId: string
  bookEntryId: string
  /** 0–1. Never 1 unless the bank's own reference matched. */
  score: number
  reasons: MatchReason[]
  /** Minor units. Non-zero means close but not equal — show it. */
  differenceMinor: number
  daysApart: number
  confidence: 'certain' | 'likely' | 'possible'
  /** More than one plausible partner. Must not be auto-applied. */
  isAmbiguous: boolean
  /**
   * The server's note for the person confirming: `ready` = the bank's own
   * reference matched one entry; otherwise the reason it needs a second look.
   * Nothing is ever matched without a click.
   */
  review?:
    | { kind: 'ready' }
    | {
        kind: 'check'
        reason:
          'BELOW_THRESHOLD' | 'AMBIGUOUS' | 'TIER_NOT_ALLOWED' | 'NO_SUGGESTION' | 'BANK_CHARGE'
      }
    | undefined
}

export interface ReconciliationSummary {
  statementLines: number
  matchedLines: number
  unmatchedLines: number
  bookEntries: number
  matchedEntries: number
  unmatchedEntries: number
  statementBalanceMinor: number
  bookBalanceMinor: number
  /** statement − book. Anything but zero needs explaining. */
  differenceMinor: number
  /** The difference as a LIST rather than a number. */
  reconcilingItems: Array<{
    id: string
    side: 'statement' | 'book'
    amountMinor: number
    description: string
  }>
}

export interface ImportStatementInput {
  accountId: string
  statementDate: string
  openingBalanceMinor: number
  closingBalanceMinor: number
  lines: Array<{
    externalRef?: string | null
    onDate: string
    /** Minor units. Positive is money IN, negative is money OUT. */
    amountMinor: number
    description: string
  }>
}

export interface BankStatement {
  id: string
  accountId: string
  statementDate: string
  openingBalanceMinor: number
  closingBalanceMinor: number
  importedAt: string | null
}

export const bankKeys = {
  all: ['bank'] as const,
  statements: (accountId?: string) => [...bankKeys.all, 'statements', accountId ?? 'all'] as const,
  suggestions: (statementId: string) => [...bankKeys.all, 'suggestions', statementId] as const,
  reconciliation: (statementId: string) =>
    [...bankKeys.all, 'reconciliation', statementId] as const,
}

// ═══ Queries ═══

/** The statements on file. The only way into every other endpoint here. */
export function useBankStatements(accountId?: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: bankKeys.statements(accountId),
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/bank/statements', {
        params: accountId ? { accountId } : {},
      })
      return asList<BankStatement>(data)
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useMatchSuggestions(statementId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: bankKeys.suggestions(statementId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/finance/bank/statements/${statementId}/suggestions`)
      return data as { statementId: string; suggestions: MatchSuggestion[] }
    },
    enabled: ready && Boolean(statementId),
    // Recomputed from scratch each time and only meaningful next to the
    // current match state, so it is not cached across a reconciling session.
    staleTime: 0,
  })
}

/** #62 — which account an unmatched line usually lands in. A suggestion, never a posting. */
export interface BankCategorySuggestion {
  accountId: string
  accountName: string
  root: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  /** The share of this business's own history that went to this account, 0–1. */
  confidence: number
  sampleSize: number
  because: string[]
}

export type BankCategoryVerdict =
  | { kind: 'categorized'; suggestion: BankCategorySuggestion }
  | { kind: 'insufficient_history'; sampleSize: number; minimum: number }
  | { kind: 'ambiguous'; candidates: BankCategorySuggestion[] }
  | { kind: 'no_pattern' }

export interface BankCategorySuggestions {
  statementId: string
  historySize: number
  lines: Array<{
    lineId: string
    onDate: string
    description: string
    amountMinor: number
    verdict: BankCategoryVerdict
  }>
}

export function useBankCategorySuggestions(statementId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: [...bankKeys.all, 'categories', statementId] as const,
    queryFn: async (): Promise<BankCategorySuggestions> => {
      const { data } = await apiClient.get<BankCategorySuggestions>(
        `/finance/bank/statements/${statementId}/categories`,
      )
      return { ...data, lines: asList<BankCategorySuggestions['lines'][number]>(data?.lines) }
    },
    enabled: ready && Boolean(statementId),
    // Only meaningful beside the current match state, like the suggestions.
    staleTime: 0,
  })
}

export function useReconciliation(statementId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: bankKeys.reconciliation(statementId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/finance/bank/statements/${statementId}/reconciliation`)
      return data as ReconciliationSummary
    },
    enabled: ready && Boolean(statementId),
    staleTime: 0,
  })
}

// ═══ Mutations ═══

/**
 * Import a statement.
 *
 * NOT retried. A statement is a large body of lines and a duplicate import
 * doubles a bank account's apparent movements — the worst possible thing to do
 * silently in the background.
 */
export function useImportStatement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ImportStatementInput) => {
      const { data } = await apiClient.post('/finance/bank/statements', input)
      return data as { id: string; lines: number }
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all })
    },
  })
}

/** Confirm ONE match. There is deliberately no bulk form of this. */
export function useReconcileLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      statementLineId: string
      bookEntryId: string
      /** Required by the UI whenever `differenceMinor` is non-zero. */
      differenceReason?: string
    }) => {
      const { data } = await apiClient.post('/finance/bank/reconcile', input)
      return data
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all })
    },
  })
}

/** Undo a confirmed match. Reconciliation has to be reversible to be usable. */
export function useUnmatchLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (statementLineId: string) => {
      const { data } = await apiClient.post(`/finance/bank/lines/${statementLineId}/unmatch`)
      return data as { unmatched: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all })
    },
  })
}
