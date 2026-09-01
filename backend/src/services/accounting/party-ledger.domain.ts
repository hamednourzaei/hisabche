// ============================================
// backend/src/services/accounting/party-ledger.domain.ts
//
// A running account for one party — what they owe, or what we owe them.
//
// ---------------------------------------------------------------------------
// DIRECTION IS THE WHOLE PROBLEM
//
// The same transaction means opposite things depending on which side of the
// relationship you are standing on. A `sale` increases what a CUSTOMER owes;
// a `purchase` increases what we owe a SUPPLIER. Getting this backwards does
// not produce an error — it produces a statement that looks perfectly
// reasonable and is wrong by twice the amount.
//
// So the mapping is data, and the test names every case.
//
// ---------------------------------------------------------------------------
// MINOR UNITS THROUGHOUT
//
// Summed as integers. Summing floats over a few hundred rows drifts by cents,
// and a customer statement that disagrees with the invoice by one afghani is a
// phone call.
// ============================================

/** The transaction kinds a party ledger understands. */
/**
 * ⚠️ Exactly the five in `transactionTypeSchema` (packages/validation).
 * An 'adjustment' was in the first draft of this file and does not exist in
 * the product — a sixth type here would compile, never occur, and quietly
 * suggest the ledger handles something it does not.
 */
export type LedgerTxnType = 'sale' | 'purchase' | 'payment' | 'receipt' | 'return'

export type PartySide = 'customer' | 'supplier'

export interface LedgerTxn {
  type: LedgerTxnType
  amountMinor: number
  at: string
}

/**
 * Does this transaction DEBIT the party's account (raise what they owe) or
 * CREDIT it (lower it)?
 *
 * Read from the shop's point of view:
 *   customer · sale      → they owe more          → debit
 *   customer · receipt   → they paid us           → credit
 *   customer · payment   → money went to them     → credit
 *   supplier · purchase  → we owe them more       → credit
 *   supplier · payment   → we paid them           → debit
 *
 * ⚠️ `return` reverses whatever the original did, which is why it is not a
 * fixed direction: a customer return credits them, a supplier return debits.
 */
export function directionFor(side: PartySide, type: LedgerTxnType): 'debit' | 'credit' {
  if (side === 'customer') {
    return type === 'sale' ? 'debit' : 'credit'
  }
  return type === 'purchase' ? 'credit' : 'debit'
}

export interface LedgerSummary {
  openingBalanceMinor: number
  totalDebitMinor: number
  totalCreditMinor: number
  closingBalanceMinor: number
}

/**
 * Roll a list of transactions into a statement.
 *
 * `closing = opening + debit − credit` on BOTH sides. The sign convention does
 * not flip for suppliers; the direction mapping already did that work, and
 * flipping it twice is how a payable reads as a receivable.
 */
export function summarise(
  side: PartySide,
  openingBalanceMinor: number,
  transactions: readonly LedgerTxn[],
): LedgerSummary {
  let totalDebitMinor = 0
  let totalCreditMinor = 0

  for (const txn of transactions) {
    // A negative amount is a data error, not a direction. Taking its absolute
    // value would silently turn a bad row into a plausible one.
    const amount = Math.trunc(txn.amountMinor)
    if (!Number.isFinite(amount) || amount < 0) continue

    if (directionFor(side, txn.type) === 'debit') totalDebitMinor += amount
    else totalCreditMinor += amount
  }

  return {
    openingBalanceMinor,
    totalDebitMinor,
    totalCreditMinor,
    closingBalanceMinor: openingBalanceMinor + totalDebitMinor - totalCreditMinor,
  }
}
