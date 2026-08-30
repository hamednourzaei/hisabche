// ============================================
// backend/src/services/accounting/ledger.port.ts
//
// The ONLY thing another module may know about the ledger.
//
// Invoicing, payments, inventory and payroll all need to book entries, and
// none of them should know that a sale is a debit to receivables and a credit
// to revenue, let alone which account carries either. They describe what
// happened in accounting terms and hand it over; the core decides whether it
// may be written.
//
// Before this existed, invoice.service.ts built journal rows by hand against
// the literal account codes '1000', '1200', '2000', '4000' and '5000'. A
// business that numbered its chart of accounts differently got no entries at
// all, and silently — the poster returned early on a missing code.
// ============================================

import type { AccountRole } from '@hisabche/validation'

import type { DraftLine } from './accounting.domain'
import type { TenancyContext } from '../tenancy.service'

/** What produced an entry. Part of the idempotency key for automatic posting. */
export type LedgerSourceType =
  | 'invoice'
  | 'payment'
  | 'stock_adjustment'
  | 'payroll'
  // A till session posts once, on close, keyed by the session id — so a
  // close retried after a lost response cannot post the day's takings twice.
  | 'pos_session'
  // A depreciation period. Keyed by (asset, period) so a run six weeks late
  // posts the four entries it owes and no more.
  | 'depreciation'
  // An unrealised exchange difference. Each run reverses the last one.
  | 'fx_revaluation'
  // A backdated cost recalculation. Its own entry, never a rewrite of the
  // entries it corrects.
  | 'cost_repost'
  | 'manual'
  | 'reversal'

export interface LedgerPostingRequest {
  sourceType: LedgerSourceType
  /** The document this entry accounts for. null only for manual entries. */
  sourceId: string | null
  /** The ACCOUNTING date — the day the event belongs to, not today. */
  date: string
  description: string
  reference?: string | undefined
  lines: DraftLine[]
}

export type LedgerPostingOutcome =
  /** Written. */
  | { status: 'posted'; entryId: string; entryNumber: string }
  /** This document was already booked; nothing was written a second time. */
  | { status: 'already_posted'; entryId: string }
  /**
   * The chart of accounts cannot express this posting yet. Reported rather
   * than thrown, so a shop that has not finished setting up its accounts can
   * still issue invoices — but the caller is told, instead of the failure
   * disappearing into a swallowed catch as it used to.
   */
  | { status: 'skipped'; reason: 'missing_accounts'; missing: AccountRole[] }

export interface LedgerPort {
  /** Book a document. Safe to call twice for the same source. */
  postDocument(ctx: TenancyContext, request: LedgerPostingRequest): Promise<LedgerPostingOutcome>

  /**
   * Reverse whatever a document booked, on `date`. Used when an invoice is
   * cancelled: the original entry stays, and a mirror entry cancels it out.
   */
  reverseDocument(
    ctx: TenancyContext,
    sourceType: LedgerSourceType,
    sourceId: string,
    options: { date?: string | undefined; reason: string },
  ): Promise<LedgerPostingOutcome | { status: 'nothing_to_reverse' }>

  /** The account ids behind the roles a caller needs, by role not by code. */
  resolveAccountsByRole(
    ctx: TenancyContext,
    roles: AccountRole[],
  ): Promise<{ accounts: Partial<Record<AccountRole, string>>; missing: AccountRole[] }>
}
