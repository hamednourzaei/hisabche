// ============================================
// backend/src/services/accounting/accounting.domain.ts
//
// The rules of the ledger, with no database and no network in sight. Every
// function here is pure, which is the point: "does this entry balance" and
// "may this account be posted to" are questions that must have the same answer
// whether they are asked by the journal route, the invoice poster or a test.
// ============================================

import type { AccountRole } from '@hisabche/validation'

export type AccountRootType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

/**
 * The side an account increases on. Assets and expenses grow with debits;
 * everything else grows with credits. This single fact is what lets a report
 * present a balance as a positive number without inventing a sign convention
 * per statement.
 */
const NATURAL_SIDE: Record<AccountRootType, 'debit' | 'credit'> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
}

export function naturalSide(type: AccountRootType): 'debit' | 'credit' {
  return NATURAL_SIDE[type]
}

/** Balance sheet accounts carry forward; P&L accounts belong to one period. */
export function isBalanceSheetType(type: AccountRootType): boolean {
  return type === 'asset' || type === 'liability' || type === 'equity'
}

/**
 * Signed so that a normal balance is positive: a bank account with money in it
 * reads +1000, and so does a supplier we owe 1000 to. A negative number here
 * is a real fact about the books (an overdrawn bank account), not a display
 * problem — the old balance sheet dropped those rows and then did not balance.
 */
export function naturalBalance(type: AccountRootType, debit: number, credit: number): number {
  return naturalSide(type) === 'debit' ? round2(debit - credit) : round2(credit - debit)
}

// ─── Money ───────────────────────────────────────────────────────────────────

/**
 * Money is compared and summed as integer minor units. The old balance check
 * added floats and then allowed a 0.001 slack, which both passes entries that
 * are genuinely out by a tenth of a cent and, on a long entry, fails ones that
 * are not.
 */
export function toMinorUnits(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function sumMinorUnits(values: number[]): number {
  return values.reduce((total, value) => total + toMinorUnits(value), 0)
}

// ─── Journal entries ─────────────────────────────────────────────────────────

export interface DraftLine {
  accountId: string
  debit: number
  credit: number
  description?: string | undefined
}

export interface LedgerAccountFacts {
  id: string
  type: AccountRootType
  isGroup: boolean
  isActive: boolean
}

export type LedgerRuleCode =
  | 'JOURNAL_ENTRY_EMPTY'
  | 'JOURNAL_ENTRY_UNBALANCED'
  | 'JOURNAL_LINE_TWO_SIDED'
  | 'JOURNAL_LINE_NEGATIVE'
  | 'JOURNAL_LINE_ACCOUNT_UNKNOWN'
  | 'JOURNAL_LINE_ACCOUNT_IS_GROUP'
  | 'JOURNAL_LINE_ACCOUNT_INACTIVE'
  | 'ACCOUNTING_PERIOD_LOCKED'

export interface LedgerRuleViolation {
  code: LedgerRuleCode
  detail: string
}

/**
 * Every reason this set of lines may not become a ledger entry, in one pass.
 * Returning all of them rather than throwing on the first means a user fixing
 * a ten line entry is told everything that is wrong with it at once.
 */
export function validateEntryLines(
  lines: DraftLine[],
  accounts: Map<string, LedgerAccountFacts>,
): LedgerRuleViolation[] {
  const violations: LedgerRuleViolation[] = []

  if (lines.length === 0) {
    return [{ code: 'JOURNAL_ENTRY_EMPTY', detail: 'entry has no lines' }]
  }

  for (const [index, line] of lines.entries()) {
    const debit = toMinorUnits(line.debit)
    const credit = toMinorUnits(line.credit)

    if (debit < 0 || credit < 0) {
      violations.push({ code: 'JOURNAL_LINE_NEGATIVE', detail: `line ${index + 1}` })
      continue
    }

    // A line with both sides filled is the shape a mistyped correction takes,
    // and it nets to zero in every report while still looking like data.
    if (debit > 0 === credit > 0) {
      violations.push({ code: 'JOURNAL_LINE_TWO_SIDED', detail: `line ${index + 1}` })
    }

    const account = accounts.get(line.accountId)
    if (!account) {
      violations.push({ code: 'JOURNAL_LINE_ACCOUNT_UNKNOWN', detail: `line ${index + 1}` })
      continue
    }
    if (account.isGroup) {
      violations.push({ code: 'JOURNAL_LINE_ACCOUNT_IS_GROUP', detail: `line ${index + 1}` })
    }
    if (!account.isActive) {
      violations.push({ code: 'JOURNAL_LINE_ACCOUNT_INACTIVE', detail: `line ${index + 1}` })
    }
  }

  const totalDebit = sumMinorUnits(lines.map((l) => l.debit))
  const totalCredit = sumMinorUnits(lines.map((l) => l.credit))

  if (totalDebit !== totalCredit) {
    violations.push({
      code: 'JOURNAL_ENTRY_UNBALANCED',
      detail: `debit ${totalDebit / 100} vs credit ${totalCredit / 100}`,
    })
  } else if (totalDebit === 0) {
    violations.push({ code: 'JOURNAL_ENTRY_EMPTY', detail: 'entry totals zero' })
  }

  return violations
}

/**
 * A reversal is the original with the two sides exchanged — ERPNext's reverse
 * action and Odoo's credit note are the same idea. The original entry is never
 * touched; both entries stay in the ledger and net to nothing.
 */
export function reverseLines(lines: DraftLine[]): DraftLine[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: round2(line.credit),
    credit: round2(line.debit),
    description: line.description,
  }))
}

/** Normalises to two decimals so the amount stored is the amount checked. */
export function normaliseLines(lines: DraftLine[]): DraftLine[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: round2(line.debit || 0),
    credit: round2(line.credit || 0),
    description: line.description,
  }))
}

/**
 * Lines for the same account are merged before posting. An invoice with twelve
 * items would otherwise write twelve identical pairs of inventory/COGS lines,
 * and the general ledger would be unreadable at the exact moment somebody
 * needs to read it.
 */
export function collapseLines(lines: DraftLine[]): DraftLine[] {
  const byAccount = new Map<
    string,
    { debit: number; credit: number; description?: string | undefined }
  >()

  for (const line of lines) {
    const current = byAccount.get(line.accountId) ?? { debit: 0, credit: 0 }
    current.debit += toMinorUnits(line.debit)
    current.credit += toMinorUnits(line.credit)
    current.description = current.description ?? line.description
    byAccount.set(line.accountId, current)
  }

  const collapsed: DraftLine[] = []
  for (const [accountId, totals] of byAccount) {
    // Netting matters: 300 debit and 100 credit on one account is a 200 debit,
    // and a line carrying both sides is rejected by validateEntryLines.
    const net = totals.debit - totals.credit
    if (net === 0) continue
    collapsed.push({
      accountId,
      debit: net > 0 ? net / 100 : 0,
      credit: net < 0 ? -net / 100 : 0,
      description: totals.description,
    })
  }

  return collapsed
}

// ─── Period lock ─────────────────────────────────────────────────────────────

/**
 * Odoo's "lock everything" date: on or before it, nothing may be posted,
 * amended or reversed. Kept as a plain date comparison so it behaves the same
 * for a Jalali-facing UI as it does for the ledger, which stores dates only.
 */
export function isPeriodLocked(entryDate: string, lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  return dateOnly(entryDate) <= dateOnly(lockedUntil)
}

// ─── J1 — branch-aware period locks ─────────────────────────────────────────

/**
 * One lock. `branchId === null` means the COMPANY lock, which covers every
 * branch; a non-null branchId locks that branch alone.
 */
export interface PeriodLock {
  branchId: string | null
  lockedUntil: string
  reason: string
}

export type PeriodLockScope = 'company' | 'branch'

export interface PeriodLockDecision {
  locked: boolean
  /** Which lock refused it — for an error message a person can act on. */
  scope: PeriodLockScope | null
  lockedUntil: string | null
  reason: string
}

/**
 * J1.2 — COMPANY LOCK **OR** BRANCH LOCK REFUSES THE POSTING.
 *
 * The precedence rule, written once and stated plainly because getting it
 * backwards is silent:
 *
 *   · A company lock covers everything. Closing the company's January closes
 *     January at every branch, including branches that have no lock row.
 *   · A branch lock covers that branch only. One shop can close early — it
 *     finished counting — without closing the others.
 *   · They are OR-ed, never overridden. A branch CANNOT unlock a period the
 *     company has closed: if it could, "the year is closed" would mean "the
 *     year is closed unless a branch manager disagrees", and the filed figures
 *     would not be final.
 *
 * ⚠️ A posting with NO branch (branchId null) is checked against the company
 * lock only. There is no branch to consult, and refusing it because SOME branch
 * is locked would make one shop's month-end block head-office entries.
 */
export function evaluatePeriodLock(
  entryDate: string,
  branchId: string | null,
  locks: PeriodLock[],
): PeriodLockDecision {
  const open: PeriodLockDecision = { locked: false, scope: null, lockedUntil: null, reason: '' }

  const company = locks.find((lock) => lock.branchId === null)
  if (company && isPeriodLocked(entryDate, company.lockedUntil)) {
    return {
      locked: true,
      scope: 'company',
      lockedUntil: dateOnly(company.lockedUntil),
      reason: company.reason,
    }
  }

  if (!branchId) return open

  const branch = locks.find((lock) => lock.branchId === branchId)
  if (branch && isPeriodLocked(entryDate, branch.lockedUntil)) {
    return {
      locked: true,
      scope: 'branch',
      lockedUntil: dateOnly(branch.lockedUntil),
      reason: branch.reason,
    }
  }

  return open
}

/** The ledger stores accounting dates, never instants. */
/**
 * The day before `date`, as `YYYY-MM-DD`.
 *
 * ⚠️ Exists for ONE reason: an opening balance must cover everything STRICTLY
 * BEFORE a window, while the RPC that computes it takes an INCLUSIVE upper
 * bound. Passing the window's own start date therefore included the first day
 * in both the opening balance and the listed lines, and every entry on that
 * day was counted twice.
 *
 * `Date.UTC` rather than the local constructor: a date-only string parsed
 * locally lands at midnight in the server's zone, and subtracting a day in a
 * zone with a DST shift can return the same calendar date.
 */
export function dayBefore(date: string): string {
  const [year, month, day] = dateOnly(date).split('-').map(Number)
  const previous = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) - 1))
  return previous.toISOString().slice(0, 10)
}

export function dateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

// ─── Chart of accounts ───────────────────────────────────────────────────────

export interface AccountNode {
  id: string
  code: string
  type: AccountRootType
  parentId: string | null
  isGroup: boolean
}

export type ChartRuleCode =
  | 'ACCOUNT_CODE_DUPLICATE'
  | 'ACCOUNT_PARENT_UNKNOWN'
  | 'ACCOUNT_PARENT_NOT_GROUP'
  | 'ACCOUNT_PARENT_TYPE_MISMATCH'
  | 'ACCOUNT_PARENT_CYCLE'
  | 'ACCOUNT_SELF_PARENT'

/**
 * The placement rules for one account against the chart it is joining.
 * `candidate.id` is empty for a new account and set when moving an existing
 * one, which is what makes the cycle check meaningful.
 */
export function validateAccountPlacement(
  candidate: AccountNode,
  existing: AccountNode[],
): ChartRuleCode[] {
  const problems: ChartRuleCode[] = []
  const byId = new Map(existing.map((a) => [a.id, a]))

  if (existing.some((a) => a.code === candidate.code && a.id !== candidate.id)) {
    problems.push('ACCOUNT_CODE_DUPLICATE')
  }

  if (!candidate.parentId) return problems

  if (candidate.id && candidate.parentId === candidate.id) {
    problems.push('ACCOUNT_SELF_PARENT')
    return problems
  }

  const parent = byId.get(candidate.parentId)
  if (!parent) {
    problems.push('ACCOUNT_PARENT_UNKNOWN')
    return problems
  }

  // A group holds children; a ledger account holds postings. Letting a posting
  // account acquire children puts money at two levels of the same subtotal.
  if (!parent.isGroup) problems.push('ACCOUNT_PARENT_NOT_GROUP')

  // A revenue account under an asset parent would be added into the wrong
  // statement by every subtotal that walks the tree.
  if (parent.type !== candidate.type) problems.push('ACCOUNT_PARENT_TYPE_MISMATCH')

  if (candidate.id) {
    let cursor: string | null = parent.id
    const seen = new Set<string>()
    while (cursor) {
      if (cursor === candidate.id) {
        problems.push('ACCOUNT_PARENT_CYCLE')
        break
      }
      if (seen.has(cursor)) break // the chart is already cyclic; not our doing
      seen.add(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
    }
  }

  return problems
}

/**
 * The entry number a workspace's next journal entry takes.
 *
 * Sequential per workspace and per year, so the number tells a reader when the
 * entry belongs without opening it. Uniqueness is enforced by the database
 * index, not by this function — two concurrent posts can compute the same
 * number and the loser retries.
 */
export function nextEntryNumber(year: number, lastNumberThisYear: number): string {
  return `JV-${year}-${String(lastNumberThisYear + 1).padStart(6, '0')}`
}

/** The year part of an entry number, or null if it is not one of ours. */
export function entryNumberYear(entryNumber: string | null): number | null {
  const match = /^JV-(\d{4})-\d{6}$/.exec(entryNumber ?? '')
  return match ? Number(match[1]) : null
}

export function entryNumberSequence(entryNumber: string | null): number {
  const match = /^JV-\d{4}-(\d{6})$/.exec(entryNumber ?? '')
  return match ? Number(match[1]) : 0
}

export type { AccountRole }
