// ============================================
// packages/validation/src/schemas/consolidation.domain.ts
//
// OPTION 2: MULTI-ENTITY FINANCIAL CONSOLIDATION
//
// Aggregates balance sheets and income statements across multiple workspaces
// in a corporate group, eliminating intercompany balances.
// Integer minor units, books base currency.
// ============================================

export interface EntityTrialBalance {
  readonly workspaceId: string
  readonly workspaceName: string
  readonly currency: string
  readonly fxRateToBase: number
  readonly balances: Record<string, { readonly debitMinor: number; readonly creditMinor: number }>
}

export interface IntercompanyElimination {
  readonly accountCode: string
  readonly amountMinor: number
  readonly description: string
}

export interface ConsolidatedReport {
  readonly groupName: string
  readonly baseCurrency: string
  readonly asOfDate: string
  readonly entityBalances: readonly EntityTrialBalance[]
  readonly eliminations: readonly IntercompanyElimination[]
  readonly totals: {
    readonly totalDebitMinor: number
    readonly totalCreditMinor: number
    readonly isBalanced: boolean
  }
}

/**
 * Consolidate multiple entity trial balances into a single group report.
 * Converts to group base currency and subtracts intercompany eliminations.
 */
export function consolidateEntities(
  groupName: string,
  baseCurrency: string,
  asOfDate: string,
  entities: readonly EntityTrialBalance[],
  eliminations: readonly IntercompanyElimination[] = [],
): ConsolidatedReport {
  let totalDebit = 0
  let totalCredit = 0

  for (const ent of entities) {
    for (const b of Object.values(ent.balances)) {
      const convertedDebit = Math.round(b.debitMinor * (ent.fxRateToBase || 1))
      const convertedCredit = Math.round(b.creditMinor * (ent.fxRateToBase || 1))
      totalDebit += convertedDebit
      totalCredit += convertedCredit
    }
  }

  // Deduct eliminations from both sides
  for (const elim of eliminations) {
    totalDebit -= elim.amountMinor
    totalCredit -= elim.amountMinor
  }

  return {
    groupName,
    baseCurrency,
    asOfDate,
    entityBalances: entities,
    eliminations,
    totals: {
      totalDebitMinor: Math.max(0, totalDebit),
      totalCreditMinor: Math.max(0, totalCredit),
      isBalanced: totalDebit === totalCredit,
    },
  }
}
