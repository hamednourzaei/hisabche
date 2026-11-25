// ============================================
// backend/src/services/capacity/financial-reconciler.ts
//
// V76 Phase 9 — Financial Correctness Under Load Verifier.
// Enforces debit == credit, zero lost/duplicate transactions, and AFN
// zero-decimal integrity after synthetic financial benchmarks.
// ============================================

import type { FinancialInvariantCheckResult } from '@hisabche/validation'
import { fractionDigits } from '@hisabche/formatting'

export interface SyntheticLedgerPostRecord {
  readonly mutationId: string
  readonly workspaceId: string
  readonly currency: 'AFN' | 'USD'
  readonly debitMinor: number
  readonly creditMinor: number
}

export function reconcileSyntheticFinancialWorkload(
  expectedMutations: readonly string[],
  postedRecords: readonly SyntheticLedgerPostRecord[],
): FinancialInvariantCheckResult {
  const details: string[] = []
  let discrepancyCount = 0

  // 1. Debit == Credit per record & total
  let balancedJournalEntries = true
  for (const rec of postedRecords) {
    if (rec.debitMinor !== rec.creditMinor) {
      balancedJournalEntries = false
      discrepancyCount++
      details.push(
        `Unbalanced entry ${rec.mutationId}: debit=${rec.debitMinor} credit=${rec.creditMinor}`,
      )
    }
  }

  // 2. Zero duplicate postings
  const seen = new Set<string>()
  let zeroDuplicatePostings = true
  for (const rec of postedRecords) {
    if (seen.has(rec.mutationId)) {
      zeroDuplicatePostings = false
      discrepancyCount++
      details.push(`Duplicate posting detected for mutationId=${rec.mutationId}`)
    }
    seen.add(rec.mutationId)
  }

  // 3. Zero lost transactions
  let zeroLostTransactions = true
  for (const id of expectedMutations) {
    if (!seen.has(id)) {
      zeroLostTransactions = false
      discrepancyCount++
      details.push(`Lost transaction detected for mutationId=${id}`)
    }
  }

  // 4. AFN zero-decimal check
  const afnZeroDecimalPreserved = fractionDigits('AFN') === 0
  if (!afnZeroDecimalPreserved) {
    discrepancyCount++
    details.push('AFN fractionDigits is not 0')
  }

  return {
    balancedJournalEntries,
    zeroLostTransactions,
    zeroDuplicatePostings,
    afnZeroDecimalPreserved,
    discrepancyCount,
    details,
  }
}
