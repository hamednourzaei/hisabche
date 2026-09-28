// ============================================
// backend/src/services/accounting/accounting.service.ts
//
// The accounting core's orchestration: it holds the rules from
// accounting.domain, the statements from accounting.reports and the storage in
// accounting.repository together, and it is the only object the rest of the
// backend talks to.
//
// It also implements LedgerPort, so invoicing and, later, payments and
// inventory can book entries without knowing a single account code.
// ============================================

import { sourceIdOf } from '../../utils/deterministic-id'
import {
  type AccountRole,
  type CreateAccount,
  type CreateJournalEntry,
  type UpdateAccount,
} from '@hisabche/validation'

import { ConflictError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { sod } from '../authorization'
import { logBusinessEvent } from '../event-log.service'

import {
  collapseLines,
  dateOnly,
  dayBefore,
  evaluatePeriodLock,
  nextEntryNumber,
  normaliseLines,
  reverseLines,
  validateAccountPlacement,
  validateEntryLines,
  type AccountNode,
  type DraftLine,
  type LedgerAccountFacts,
  naturalBalance,
  naturalSide,
  type AccountRootType,
} from './accounting.domain'
import {
  AccountingRepository,
  domainErrorCode,
  type AccountRow,
  type JournalEntryRow,
} from './accounting.repository'
import type { BalanceSheet, IncomeStatement } from '@hisabche/validation'
import {
  toBalanceSheet,
  toIncomeStatement,
  toTrialBalance,
  trialBalanceTotals,
} from './accounting.reports'
import { getCashFlow, getCustomerDebtReport } from './operational-reports'
import { buildProfitReport, invoiceMargins, type ProfitReport } from './profit-report.domain'
import {
  explainInvoiceProfit,
  productJourney,
  type InvoiceEvidence,
  type ProductJourney,
} from './evidence.domain'
import { carryForward, planClosing, type AccountBalance } from './year-end.domain'
import type {
  LedgerPort,
  LedgerPostingOutcome,
  LedgerPostingRequest,
  LedgerSourceType,
} from './ledger.port'

/**
 * Roles inferred from the account codes the old invoice poster hard-coded.
 *
 * Only a fallback, and only while `accounts.role` is still being filled in:
 * a workspace that already had a chart of accounts keeps working after this
 * change instead of quietly losing its automatic entries. A role set
 * explicitly on the account always wins.
 */
const LEGACY_CODE_ROLES: Record<string, AccountRole> = {
  '1000': 'inventory',
  '1200': 'receivable',
  '2000': 'payable',
  '4000': 'sales',
  '5000': 'cogs',
}

/**
 * The account created for a role that has none — see `ensureAccountsForRoles`.
 * Codes follow the legacy numbering the poster already understood.
 */
const STANDARD_ACCOUNT_FOR_ROLE: Partial<
  Record<
    AccountRole,
    { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' }
  >
> = {
  cash: { code: '1010', name: 'صندوق', type: 'asset' },
  bank: { code: '1020', name: 'بانک', type: 'asset' },
  inventory: { code: '1000', name: 'موجودی کالا', type: 'asset' },
  receivable: { code: '1200', name: 'حساب‌های دریافتنی', type: 'asset' },
  payable: { code: '2000', name: 'حساب‌های پرداختنی', type: 'liability' },
  tax: { code: '2100', name: 'مالیات', type: 'liability' },
  retained_earnings: { code: '3000', name: 'سود انباشته', type: 'equity' },
  current_year_earnings: { code: '3100', name: 'سود سال جاری', type: 'equity' },
  sales: { code: '4000', name: 'فروش', type: 'revenue' },
  cogs: { code: '5000', name: 'بهای تمام‌شده‌ی کالای فروش‌رفته', type: 'expense' },
  purchase: { code: '5100', name: 'خرید', type: 'expense' },
  salary_expense: { code: '6000', name: 'هزینه‌ی حقوق', type: 'expense' },
}

function roleOf(account: AccountRow): AccountRole | null {
  if (account.role) return account.role as AccountRole
  return LEGACY_CODE_ROLES[account.code] ?? null
}

function toFacts(accounts: AccountRow[]): Map<string, LedgerAccountFacts> {
  return new Map(
    accounts.map((a) => [
      a.id,
      { id: a.id, type: a.type, isGroup: a.isGroup, isActive: a.isActive },
    ]),
  )
}

function toNodes(accounts: AccountRow[]): AccountNode[] {
  return accounts.map((a) => ({
    id: a.id,
    code: a.code,
    type: a.type,
    parentId: a.parentId,
    isGroup: a.isGroup,
  }))
}

const REPORT_TTL_SECONDS = 120
const ACCOUNTS_TTL_SECONDS = 300

// sourceIdOf lives in utils/deterministic-id (imports nothing), re-exported
// here because this module is where the journal callers already import it from.
export { sourceIdOf } from '../../utils/deterministic-id'

export class AccountingService implements LedgerPort {
  private readonly repo: AccountingRepository

  constructor(repo: AccountingRepository = new AccountingRepository()) {
    this.repo = repo
  }

  // ─── Cache ────────────────────────────────────────────────────────────────
  //
  // Every key starts `accounting:<workspaceId>:`, and invalidation drops that
  // whole prefix. The service this replaced built keys like
  // `trial_balance:<user>:<date>` but invalidated `trial_balance:<user>` with
  // no date, so a report cached after a posting was never cleared again.

  private key(workspaceId: string, ...parts: (string | number | null)[]) {
    return `accounting:${workspaceId}:${parts.map((p) => p ?? '-').join(':')}`
  }

  private async invalidateWorkspace(workspaceId: string) {
    await memoryCache.invalidate(`accounting:${workspaceId}`)
  }

  // ─── Chart of accounts ────────────────────────────────────────────────────

  async listAccounts(ctx: TenancyContext): Promise<AccountRow[]> {
    const cacheKey = this.key(ctx.workspaceId, 'accounts')
    const cached = await memoryCache.get<AccountRow[]>(cacheKey)
    if (cached) return cached

    const accounts = await this.repo.listAccounts(ctx.workspaceId)
    await memoryCache.set(cacheKey, accounts, ACCOUNTS_TTL_SECONDS)
    return accounts
  }

  async createAccount(ctx: TenancyContext, data: CreateAccount): Promise<AccountRow> {
    const existing = await this.repo.listAccounts(ctx.workspaceId)

    const problems = validateAccountPlacement(
      {
        id: '',
        code: data.code,
        type: data.type,
        parentId: data.parentId ?? null,
        isGroup: data.isGroup ?? false,
      },
      toNodes(existing),
    )
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const account = await this.repo.insertAccount(ctx, {
      code: data.code,
      name: data.name,
      type: data.type,
      role: data.role ?? null,
      parent_id: data.parentId ?? null,
      is_group: data.isGroup ?? false,
      is_active: data.isActive !== false,
    })

    await this.invalidateWorkspace(ctx.workspaceId)
    return account
  }

  /**
   * What may still be changed about an account once it is in use is narrow on
   * purpose. Its name can always be corrected. Its ROOT TYPE cannot once
   * anything is posted to it: moving an account from expense to asset
   * retroactively rewrites every statement the business has already filed.
   */
  async updateAccount(ctx: TenancyContext, id: string, data: UpdateAccount): Promise<AccountRow> {
    const existing = await this.repo.listAccounts(ctx.workspaceId)
    const current = existing.find((a) => a.id === id)
    if (!current) throw new NotFoundError('Account')

    const nextType = data.type ?? current.type
    const nextIsGroup = data.isGroup ?? current.isGroup

    if (nextType !== current.type || nextIsGroup !== current.isGroup) {
      if (await this.repo.accountHasPostings(ctx.workspaceId, id)) {
        throw new ConflictError('ACCOUNT_HAS_POSTINGS')
      }
    }

    // A group that still has children cannot become a posting account: its
    // children would keep rolling up into a total that now also holds money
    // of its own, and the subtotal would count it twice.
    if (current.isGroup && !nextIsGroup) {
      if (await this.repo.accountHasChildren(ctx.workspaceId, id)) {
        throw new ConflictError('ACCOUNT_HAS_CHILDREN')
      }
    }

    const problems = validateAccountPlacement(
      {
        id,
        code: data.code ?? current.code,
        type: nextType,
        parentId: data.parentId === undefined ? current.parentId : (data.parentId ?? null),
        isGroup: nextIsGroup,
      },
      toNodes(existing),
    )
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const values: Record<string, unknown> = {}
    if (data.code !== undefined) values.code = data.code
    if (data.name !== undefined) values.name = data.name
    if (data.type !== undefined) values.type = data.type
    if (data.role !== undefined) values.role = data.role ?? null
    if (data.parentId !== undefined) values.parent_id = data.parentId ?? null
    if (data.isGroup !== undefined) values.is_group = data.isGroup
    if (data.isActive !== undefined) values.is_active = data.isActive

    const account = await this.repo.updateAccount(ctx.workspaceId, id, values)
    await this.invalidateWorkspace(ctx.workspaceId)
    return account
  }

  /**
   * Create the standard account for each role that has none, then resolve.
   *
   * ---------------------------------------------------------------------------
   * ⚠️ WHY THE LEDGER WAS EMPTY
   *
   * Invoice posting looks accounts up by ROLE (receivable, sales, cogs,
   * inventory…). Nothing ever created those accounts: there is no default
   * chart, so a new workspace had none, `resolveAccountsByRole` reported them
   * missing, and every invoice was skipped with only a console line. The
   * journal, trial balance, balance sheet and P&L are all built from journal
   * entries — so all of them stayed empty while invoices kept being issued.
   *
   * This provisions ONLY what is missing, once, in this workspace. An owner
   * who has built their own chart and tagged the roles is untouched. A code
   * already taken by another account gets a numeric suffix rather than being
   * overwritten.
   */
  async ensureAccountsForRoles(
    ctx: TenancyContext,
    roles: AccountRole[],
  ): Promise<{ accounts: Partial<Record<AccountRole, string>>; missing: AccountRole[] }> {
    const first = await this.resolveAccountsByRole(ctx, roles)
    if (first.missing.length === 0) return first

    const existing = await this.repo.listAccounts(ctx.workspaceId)
    const takenCodes = new Set(existing.map((a) => a.code))

    for (const role of first.missing) {
      const template = STANDARD_ACCOUNT_FOR_ROLE[role]
      if (!template) continue

      let code = template.code
      for (let n = 1; takenCodes.has(code); n++) code = `${template.code}${n}`
      takenCodes.add(code)

      await this.repo.insertAccount(ctx, {
        code,
        name: template.name,
        type: template.type,
        role,
        parent_id: null,
        is_group: false,
        is_active: true,
      })
    }

    await this.invalidateWorkspace(ctx.workspaceId)
    return this.resolveAccountsByRole(ctx, roles)
  }

  async resolveAccountsByRole(
    ctx: TenancyContext,
    roles: AccountRole[],
  ): Promise<{ accounts: Partial<Record<AccountRole, string>>; missing: AccountRole[] }> {
    const all = await this.listAccounts(ctx)
    const found: Partial<Record<AccountRole, string>> = {}

    for (const account of all) {
      if (account.isGroup || !account.isActive) continue
      const role = roleOf(account)
      // First by code order, so a chart with two receivable accounts resolves
      // to the same one on every posting rather than whichever row came back.
      if (role && roles.includes(role) && !found[role]) found[role] = account.id
    }

    return { accounts: found, missing: roles.filter((role) => !found[role]) }
  }

  // ─── Period lock ──────────────────────────────────────────────────────────

  async getPeriodLock(ctx: TenancyContext) {
    return this.repo.getPeriodLock(ctx.workspaceId)
  }

  /** J1 — every lock in the workspace: the company one and each branch's. */
  async listPeriodLocks(ctx: TenancyContext) {
    return this.repo.listPeriodLocks(ctx.workspaceId)
  }

  /**
   * Closing a period is an owner's decision — it is what makes filed figures
   * un-editable — so a seller may not move the boundary.
   *
   * J1: `branchId` closes ONE branch. Omitting it closes the company, which is
   * every branch and the original behaviour.
   */
  async setPeriodLock(
    ctx: TenancyContext,
    lockedUntil: string,
    reason: string,
    branchId: string | null = null,
  ) {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('ACCOUNTING_PERIOD_LOCK_FORBIDDEN')
    }

    const nextUntil = dateOnly(lockedUntil)

    // Read the whole set BEFORE the write, so the audit event can say what the
    // boundary was as well as what it became. "Locked until 1404-06-31" alone
    // does not tell you whether a period was closed or REOPENED — and reopening
    // a closed period is the more serious of the two.
    const before = await this.repo.listPeriodLocks(ctx.workspaceId)
    const previous = before.find((lock) => lock.branchId === branchId)

    await this.repo.setPeriodLock(ctx, nextUntil, reason, branchId)
    await this.invalidateWorkspace(ctx.workspaceId)

    // J1.5 — every lock and unlock is an audit event.
    //
    // A period lock decides whether the books can still be changed. Moving it
    // silently is exactly the change an audit trail exists to record, and it
    // had none.
    const reopened = Boolean(previous && nextUntil < previous.lockedUntil)

    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'accounting_period_lock',
      entityId: branchId ?? ctx.workspaceId,
      action: reopened ? 'reopened' : 'locked',
      title: reopened
        ? `دوره حسابداری بازگشایی شد تا ${nextUntil}`
        : `دوره حسابداری بسته شد تا ${nextUntil}`,
      description: [
        branchId ? `شعبه: ${branchId}` : 'کل کسب‌وکار',
        previous ? `قبلاً: ${previous.lockedUntil}` : 'بدون قفل قبلی',
        reason,
      ]
        .filter(Boolean)
        .join(' · '),
      // Reopening is the one worth telling people about: it makes filed
      // figures editable again.
      notify: reopened,
      notifyType: reopened ? 'warning' : 'info',
    }).catch((err: unknown) => console.error('[AccountingService] period lock audit failed:', err))

    return this.repo.getPeriodLock(ctx.workspaceId)
  }

  /**
   * J1.3, application layer.
   *
   * ⚠️ This is the SECOND of two checks, not the only one. The same rule runs
   * inside `accounting_post_journal_entry`, in the posting transaction — so a
   * direct database write is refused as well, and a check that raced between
   * here and the insert cannot let anything through.
   *
   * This layer exists to fail EARLY and with a message naming which lock
   * refused, rather than surfacing a Postgres exception from three calls deep.
   */
  private async assertPeriodOpen(
    ctx: TenancyContext,
    date: string,
    branchId: string | null = null,
  ) {
    const locks = await this.repo.listPeriodLocks(ctx.workspaceId)
    const decision = evaluatePeriodLock(date, branchId, locks)

    if (decision.locked) {
      throw new ConflictError(
        `ACCOUNTING_PERIOD_LOCKED: ${decision.scope} lock, closed through ${decision.lockedUntil}`,
      )
    }
  }

  // ─── Journal entries ──────────────────────────────────────────────────────

  async listJournalEntries(
    ctx: TenancyContext,
    options: { limit?: number | undefined; status?: string | undefined } = {},
  ): Promise<JournalEntryRow[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
    const cacheKey = this.key(ctx.workspaceId, 'entries', limit, options.status ?? 'all')

    const cached = await memoryCache.get<JournalEntryRow[]>(cacheKey)
    if (cached) return cached

    const entries = await this.repo.listEntries(ctx.workspaceId, {
      limit,
      ...(options.status ? { status: options.status } : {}),
    })
    await memoryCache.set(cacheKey, entries, 60)
    return entries
  }

  /** Entries for a set of documents, e.g. one party's invoices and payments. Not cached. */
  async entriesForDocuments(
    ctx: TenancyContext,
    sources: { sourceType: 'invoice' | 'payment'; sourceId: string }[],
  ): Promise<JournalEntryRow[]> {
    const byType = new Map<string, string[]>()
    for (const source of sources) {
      byType.set(source.sourceType, [...(byType.get(source.sourceType) ?? []), source.sourceId])
    }
    const results = await Promise.all(
      [...byType].map(([type, ids]) =>
        this.repo.entriesForSources(ctx.workspaceId, type, [...new Set(ids)]),
      ),
    )
    return results.flat()
  }

  async getJournalEntry(ctx: TenancyContext, id: string): Promise<JournalEntryRow> {
    const entry = await this.repo.getEntry(ctx.workspaceId, id)
    if (!entry) throw new NotFoundError('Journal entry')
    return entry
  }

  /**
   * A manual entry. `status` decides whether it lands in the ledger or waits
   * as a draft; a draft is invisible to every report until it is posted.
   */
  async createJournalEntry(
    ctx: TenancyContext,
    data: CreateJournalEntry,
    options: {
      status?: 'draft' | 'posted' | undefined
      /**
       * The request's Idempotency-Key (27 Sep 2026). It becomes the entry's
       * source, so the unique index «one live entry per source» makes a
       * retried submit return the first entry instead of posting it twice.
       */
      idempotencyKey?: string | null | undefined
      /** A source the caller owns (the year-end close). Wins over the key. */
      source?: { type: string; id: string } | undefined
    } = {},
  ) {
    const status = options.status ?? 'posted'
    const date = dateOnly(data.date)
    const lines = normaliseLines(data.lines as DraftLine[])

    await this.assertPeriodOpen(ctx, date)
    await this.assertLinesPostable(ctx, lines)

    const entryId = await this.writeEntry(ctx, {
      date,
      description: data.description ?? '',
      reference: data.reference ?? '',
      status,
      sourceType: options.source?.type ?? 'manual',
      sourceId:
        options.source?.id ??
        (options.idempotencyKey
          ? sourceIdOf(ctx.workspaceId, 'manual', options.idempotencyKey)
          : null),
      reversalOf: null,
      lines,
    })

    await sod.recordAction(ctx, 'ledger.post', 'journal_entry', entryId)
    await this.invalidateWorkspace(ctx.workspaceId)
    return this.getJournalEntry(ctx, entryId)
  }

  /**
   * Reverse a posted entry.
   *
   * The original is left exactly as it was and marked `reversed`; a new entry
   * with the sides exchanged carries the correction. This is the ONLY way to
   * undo something in the ledger — there is no update and no delete, because
   * a record that can be rewritten after the fact is not evidence of anything.
   */
  async reverseJournalEntry(
    ctx: TenancyContext,
    id: string,
    options: { date?: string | undefined; reason: string; override?: { reason: string } },
  ) {
    const original = await this.getJournalEntry(ctx, id)

    if (original.status !== 'posted') throw new ConflictError('JOURNAL_ENTRY_NOT_POSTED')

    // Posting an entry and reversing it unobserved leaves no net trace of
    // either. Enforced only where the workspace has asked for it.
    await sod.assertAllowed(ctx, 'ledger.reverse', 'journal_entry', id, options.override)

    const reversalDate = dateOnly(options.date ?? new Date())
    // Both dates matter: reversing INTO a closed period reopens filed figures,
    // and reversing an entry that itself sits in one does the same.
    await this.assertPeriodOpen(ctx, reversalDate)
    await this.assertPeriodOpen(ctx, original.date)

    const lines = reverseLines(
      original.lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
      })),
    )

    await this.assertLinesPostable(ctx, lines)

    const entryId = await this.writeEntry(ctx, {
      date: reversalDate,
      description: `برگشت سند ${original.entryNumber ?? original.id.slice(0, 8)} — ${options.reason}`,
      reference: original.entryNumber ?? original.id,
      status: 'posted',
      sourceType: 'reversal',
      sourceId: original.id,
      reversalOf: original.id,
      lines,
    })

    await this.repo.markReversed(ctx.workspaceId, original.id)
    await sod.recordAction(ctx, 'ledger.reverse', 'journal_entry', original.id)
    await this.invalidateWorkspace(ctx.workspaceId)

    return this.getJournalEntry(ctx, entryId)
  }

  /** Move a draft into the ledger. Re-checks everything at posting time. */
  async postDraft(ctx: TenancyContext, id: string) {
    const entry = await this.getJournalEntry(ctx, id)
    if (entry.status !== 'draft') throw new ConflictError('JOURNAL_ENTRY_NOT_DRAFT')

    await this.assertPeriodOpen(ctx, entry.date)
    await this.assertLinesPostable(
      ctx,
      entry.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })),
    )

    const year = Number(entry.date.slice(0, 4))
    const sequence = await this.repo.lastEntrySequence(ctx.workspaceId, year)

    const moved = await this.repo.setEntryStatus(ctx.workspaceId, id, 'draft', 'posted', {
      entry_number: entry.entryNumber ?? nextEntryNumber(year, sequence),
      posted_at: new Date().toISOString(),
      posted_by: ctx.userId,
    })
    if (!moved) throw new ConflictError('JOURNAL_ENTRY_NOT_DRAFT')

    await this.invalidateWorkspace(ctx.workspaceId)
    return this.getJournalEntry(ctx, id)
  }

  // ─── LedgerPort ───────────────────────────────────────────────────────────

  async postDocument(
    ctx: TenancyContext,
    request: LedgerPostingRequest,
  ): Promise<LedgerPostingOutcome> {
    const date = dateOnly(request.date)
    const lines = collapseLines(normaliseLines(request.lines))

    if (request.sourceId) {
      const existing = await this.repo.findEntryBySource(
        ctx.workspaceId,
        request.sourceType,
        request.sourceId,
      )
      // Re-saving an invoice must not book its revenue a second time. The
      // database enforces this too, with a unique index on the source pair.
      if (existing) return { status: 'already_posted', entryId: existing.id }
    }

    await this.assertPeriodOpen(ctx, date)
    await this.assertLinesPostable(ctx, lines)

    const year = Number(date.slice(0, 4))
    const sequence = await this.repo.lastEntrySequence(ctx.workspaceId, year)
    const entryNumber = nextEntryNumber(year, sequence)

    const outcome = { reused: false }
    const entryId = await this.writeEntry(
      ctx,
      {
        date,
        description: request.description,
        reference: request.reference ?? '',
        status: 'posted',
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        reversalOf: null,
        entryNumber,
        lines,
      },
      outcome,
    )

    // Lost the race to a concurrent posting of the same document: the unique
    // index kept ONE entry, and that one is not ours to count.
    if (outcome.reused) return { status: 'already_posted', entryId }

    await sod.recordAction(ctx, 'ledger.post', 'journal_entry', entryId)
    await this.invalidateWorkspace(ctx.workspaceId)
    return { status: 'posted', entryId, entryNumber }
  }

  async reverseDocument(
    ctx: TenancyContext,
    sourceType: LedgerSourceType,
    sourceId: string,
    options: { date?: string | undefined; reason: string },
  ) {
    const existing = await this.repo.findEntryBySource(ctx.workspaceId, sourceType, sourceId)
    if (!existing || existing.status !== 'posted') return { status: 'nothing_to_reverse' as const }

    const reversal = await this.reverseJournalEntry(ctx, existing.id, options)
    return {
      status: 'posted' as const,
      entryId: reversal.id,
      entryNumber: reversal.entryNumber ?? '',
    }
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  async getTrialBalance(
    ctx: TenancyContext,
    options: {
      fromDate?: string | undefined
      toDate?: string | undefined
      /** Branches to include. Omit or null for the consolidated statement. */
      branchIds?: string[] | null | undefined
    } = {},
  ) {
    const fromDate = options.fromDate ? dateOnly(options.fromDate) : null
    const toDate = dateOnly(options.toDate ?? new Date())
    const branchIds = options.branchIds ?? null
    // The branch filter is part of the cache identity. Without it, a member
    // pinned to one shop would be served the whole chain's figures because
    // somebody else asked first.
    const cacheKey = this.key(
      ctx.workspaceId,
      'trial',
      fromDate,
      toDate,
      branchIds?.join(',') ?? 'all',
    )

    const cached = await memoryCache.get<ReturnType<typeof trialBalanceTotals> & { rows: unknown }>(
      cacheKey,
    )
    if (cached) return cached as any

    const rows = toTrialBalance(
      await this.repo.ledgerTotals(ctx.workspaceId, fromDate, toDate, branchIds),
    )
    const result = { rows, ...trialBalanceTotals(rows), fromDate, toDate, branchIds }

    await memoryCache.set(cacheKey, result, REPORT_TTL_SECONDS)
    return result
  }

  async getBalanceSheet(
    ctx: TenancyContext,
    date: string,
    branchIds: string[] | null = null,
  ): Promise<BalanceSheet> {
    const asOf = dateOnly(date ?? new Date())
    const cacheKey = this.key(ctx.workspaceId, 'balance-sheet', asOf, branchIds?.join(',') ?? 'all')

    const cached = await memoryCache.get<BalanceSheet>(cacheKey)
    if (cached) return cached

    // From the day the books opened up to `asOf` — a balance sheet is a
    // position, not a period, so it has no start date.
    const result = toBalanceSheet(
      await this.repo.ledgerTotals(ctx.workspaceId, null, asOf, branchIds),
      asOf,
    )

    await memoryCache.set(cacheKey, result, REPORT_TTL_SECONDS)
    return result
  }

  /** Request #91 — per-product profit, salaries and net profit for a range, in one currency. Not cached. */
  async getProfitReport(
    ctx: TenancyContext,
    fromDate: string,
    toDate: string,
    currency: string,
  ): Promise<ProfitReport> {
    const from = dateOnly(fromDate)
    const to = dateOnly(toDate)
    if (from > to) throw new ValidationError('PROFIT_REPORT_RANGE_INVALID')
    const sources = await this.repo.profitSources(ctx.workspaceId, from, to)
    return buildProfitReport({ from, to, currency, ...sources })
  }

  /**
   * The profit report of EVERY currency the period has documents in — one
   * report each, never added together (owner's request, 26 Sep 2026: «dollar
   * profit so much, toman so much, afghani so much»).
   *
   * ⚠️ No conversion. Summing AFN and IRT needs a rate this report does not
   * have; a single «total profit» across currencies would be an invented
   * number. The primary currency is always included, even when empty.
   */
  async getProfitReportsByCurrency(
    ctx: TenancyContext,
    fromDate: string,
    toDate: string,
    primaryCurrency: string,
  ): Promise<ProfitReport[]> {
    const from = dateOnly(fromDate)
    const to = dateOnly(toDate)
    if (from > to) throw new ValidationError('PROFIT_REPORT_RANGE_INVALID')
    const sources = await this.repo.profitSources(ctx.workspaceId, from, to)
    const currencies = [
      primaryCurrency,
      ...new Set([
        ...sources.invoices.map((invoice) => invoice.currency),
        ...sources.payrolls.map((payroll) => payroll.currency),
      ]),
    ].filter((code, index, all) => code && all.indexOf(code) === index)
    return currencies.map((currency) => buildProfitReport({ from, to, currency, ...sources }))
  }

  /** Per-product profit in every currency present (insights' «profit change» explanation). */
  async getProductProfits(ctx: TenancyContext, fromDate: string, toDate: string) {
    const from = dateOnly(fromDate)
    const to = dateOnly(toDate)
    const sources = await this.repo.profitSources(ctx.workspaceId, from, to)
    const currencies = [...new Set(sources.invoices.map((invoice) => invoice.currency))]
    return currencies.flatMap((currency) =>
      buildProfitReport({ from, to, currency, ...sources, payrolls: [] }).products.map((row) => ({
        key:
          currencies.length > 1
            ? `${row.productId ?? row.name}:${currency}`
            : (row.productId ?? row.name),
        label: currencies.length > 1 ? `${row.name} (${currency})` : row.name,
        value: row.profit,
      })),
    )
  }

  /** Profit % of each sale invoice — the till shows it beside each transaction. */
  async getInvoiceMargins(ctx: TenancyContext, invoiceIds: string[]) {
    const sources = await this.repo.profitSourcesForInvoices(ctx.workspaceId, invoiceIds)
    return invoiceMargins(sources.invoices, sources.lines, sources.consumptions)
  }

  /**
   * The chain behind one invoice's profit (evidence.domain.ts): lines, the
   * shared discount, each cost with the layer and document it came from, the
   * journal entry and the payments. Totals are buildProfitReport's.
   */
  async explainInvoiceProfit(ctx: TenancyContext, invoiceId: string): Promise<InvoiceEvidence> {
    const sources = await this.repo.invoiceEvidenceSources(ctx.workspaceId, invoiceId)
    if (!sources) throw new NotFoundError('Invoice')
    return explainInvoiceProfit(sources)
  }

  /**
   * A product's money journey in [from, to] in one currency: bought (cost
   * layers), sold (consumptions), still on hand, and the report's revenue
   * and profit for it — never converted between currencies.
   */
  async productJourney(
    ctx: TenancyContext,
    productId: string,
    fromDate: string,
    toDate: string,
    currency: string,
  ): Promise<ProductJourney> {
    const from = dateOnly(fromDate)
    const to = dateOnly(toDate)
    if (from > to) throw new ValidationError('PROFIT_REPORT_RANGE_INVALID')
    const [sources, journey] = await Promise.all([
      this.repo.profitSources(ctx.workspaceId, from, to),
      this.repo.productJourneySources(ctx.workspaceId, productId, from, to),
    ])
    const row = buildProfitReport({ from, to, currency, ...sources, payrolls: [] }).products.find(
      (p) => p.productId === productId,
    )
    return productJourney({
      productId,
      currency,
      layers: journey.layers,
      consumptions: journey.consumptions,
      revenue: row?.revenue ?? 0,
      profit: row?.profit ?? 0,
    })
  }

  async getIncomeStatement(
    ctx: TenancyContext,
    fromDate: string,
    toDate: string,
    branchIds: string[] | null = null,
  ): Promise<IncomeStatement> {
    const from = dateOnly(fromDate)
    const to = dateOnly(toDate)
    const cacheKey = this.key(ctx.workspaceId, 'income', from, to, branchIds?.join(',') ?? 'all')

    // Typed on the way OUT of the cache. An untyped read collapses the return
    // type to `{}` and pushes a cast onto every caller — which is how the AI
    // service ended up reading field names that did not exist.
    const cached = await memoryCache.get<IncomeStatement>(cacheKey)
    if (cached) return cached

    const result = toIncomeStatement(
      await this.repo.ledgerTotals(ctx.workspaceId, from, to, branchIds),
      from,
      to,
    )

    await memoryCache.set(cacheKey, result, REPORT_TTL_SECONDS)
    return result
  }

  // ═══════════════════════════════════════════════ GENERAL LEDGER

  /**
   * The lines behind one number.
   *
   * ---------------------------------------------------------------------------
   * WHY A REPORT WITHOUT THIS IS HALF A REPORT
   *
   * A trial balance says an account holds 412,900. The only useful next
   * question is "made up of what", and until now the answer required somebody
   * to open the journal and filter it by hand. Every serious ledger has this
   * and it is the difference between a figure you can defend and a figure you
   * can only recite.
   *
   * ⚠️ The running balance is computed HERE rather than in SQL, because it
   * depends on the account's natural side: an asset's balance rises on a debit
   * and a liability's rises on a credit. Doing it in the query would mean the
   * direction rule lived in two places.
   */
  async generalLedger(
    ctx: TenancyContext,
    accountId: string,
    fromDate: string | null,
    toDate: string | null,
  ) {
    const from = fromDate ? dateOnly(fromDate) : null
    const to = toDate ? dateOnly(toDate) : null

    const account = (await this.listAccounts(ctx)).find((row) => row.id === accountId)
    if (!account) throw new NotFoundError('Account')

    const lines = await this.repo.ledgerLines(ctx.workspaceId, accountId, from, to)

    // What the account held before this window opened. Without it the first
    // row's running balance starts at zero and every figure below it is wrong
    // by the opening amount — while still looking perfectly self-consistent.
    //
    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ STRICTLY BEFORE `from`, NOT UP TO IT.
    //
    // This read `ledgerTotals(..., to = from)`, and `p_to_date` is INCLUSIVE —
    // the same `.lte` convention every other bound in this file uses. Meanwhile
    // `ledgerLines` filters `.gte('date', from)`. So every entry dated exactly
    // on the first day of the window was inside the opening balance AND listed
    // again as a line: counted twice.
    //
    // Ask for the cash account from the 1st and every entry booked on the 1st
    // is double-counted, so the closing balance disagrees with the trial
    // balance by exactly that day's movement — in the drill-down report people
    // open precisely to check the trial balance.
    // ═══════════════════════════════════════════════════════════════════════
    const opening = from
      ? (await this.repo.ledgerTotals(ctx.workspaceId, null, dayBefore(from), null)).find(
          (row) => row.accountId === accountId,
        )
      : undefined

    const side = naturalSide(account.type as AccountRootType)

    let runningMinor = opening
      ? Math.round(
          naturalBalance(account.type as AccountRootType, opening.debit, opening.credit) * 100,
        )
      : 0

    const rows = lines.map((line) => {
      const movementMinor =
        side === 'debit'
          ? Math.round(line.debit * 100) - Math.round(line.credit * 100)
          : Math.round(line.credit * 100) - Math.round(line.debit * 100)

      runningMinor += movementMinor

      return { ...line, balance: runningMinor / 100 }
    })

    return {
      accountId,
      accountCode: account.code,
      accountName: account.name,
      from,
      to,
      openingBalance:
        (opening
          ? Math.round(
              naturalBalance(account.type as AccountRootType, opening.debit, opening.credit) * 100,
            )
          : 0) / 100,
      closingBalance: runningMinor / 100,
      lines: rows,
    }
  }

  // ═══════════════════════════════════════════════ YEAR END

  /**
   * What closing this year WOULD post — without posting it.
   *
   * Same preview-then-commit shape as everything else that moves money. An
   * accountant asked to approve a closing entry needs to see the lines, and a
   * "close year" button that goes straight to the ledger is a button nobody
   * presses twice.
   */
  async planYearEndClose(ctx: TenancyContext, fromDate: string, toDate: string) {
    const from = dateOnly(fromDate)
    const to = dateOnly(toDate)

    // Read through the SAME date-bounded aggregate the income statement uses.
    // A second query shaped slightly differently is how a closing entry comes
    // to disagree with the statement it is supposed to close.
    const totals = await this.repo.ledgerTotals(ctx.workspaceId, from, to, null)

    const balances: AccountBalance[] = totals.map((row) => ({
      accountId: row.accountId,
      code: row.accountCode,
      type: row.accountType,
      debit: row.debit,
      credit: row.credit,
    }))

    // Resolved through the SAME role lookup every posting uses, so the year
    // closes into the account the rest of the ledger already calls retained
    // earnings — not a second one found by a different rule.
    const { accounts } = await this.resolveAccountsByRole(ctx, ['retained_earnings'])

    const result = planClosing(balances, accounts.retained_earnings ?? null)

    if (!result.ok) return { ok: false as const, reason: result.reason, from, to }

    return {
      ok: true as const,
      from,
      to,
      ...result.plan,
      // Shown beside the entry so the new year's opening figures can be
      // reconciled against the closing ones — which is what an accountant
      // actually asks for.
      carriedForward: carryForward(balances),
    }
  }

  /**
   * Post the closing entry.
   *
   * ⚠️ Goes through `postJournalEntry` like any other entry. A "close" that
   * mutated balances directly would be a second way for money to move — the
   * thing the whole architecture exists to prevent — and it could not be
   * reversed, audited or explained by the tools that already exist.
   *
   * The plan is RECOMPUTED here rather than accepted from the client: a plan
   * posted back could be minutes stale, and a closing entry built from stale
   * balances leaves the year open by exactly the amount that moved since.
   */
  /**
   * The idempotency key of a year-end close.
   *
   * Deterministic in the period, so the same close always produces the same
   * reference and a second attempt is recognisable.
   */
  private static yearEndReferenceOf(from: string, to: string): string {
    return `YEC:${from}:${to}`
  }

  async postYearEndClose(ctx: TenancyContext, fromDate: string, toDate: string) {
    const plan = await this.planYearEndClose(ctx, fromDate, toDate)
    if (!plan.ok) throw new ValidationError(`YEAR_END_${plan.reason}`)

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ CLOSING A YEAR TWICE USED TO DOUBLE RETAINED EARNINGS.
    //
    // `createJournalEntry` posts with `sourceType: 'manual'` and
    // `sourceId: null`, and `postDocument`'s idempotency guard only applies
    // when a source id is set. So pressing «close year» a second time — or a
    // client retrying after a timed-out response — posted the whole closing
    // entry again: every revenue and expense account was driven to the
    // NEGATIVE of its balance and retained earnings was credited with twice
    // the profit.
    //
    // ⚠️ AND IT LOOKED FINE. The second entry balances like the first, so the
    // trial balance still footed and the balance sheet still balanced. The
    // only symptom was a year's profit that was wrong by a factor of two.
    //
    // The close is now keyed by its own period. `reference` is a column this
    // document already has, so this needs no schema change — and unlike the
    // description it is not free text somebody might edit.
    // ═══════════════════════════════════════════════════════════════════════
    const reference = AccountingService.yearEndReferenceOf(plan.from, plan.to)
    const existing = await this.repo.findEntryByReference(ctx.workspaceId, reference)

    if (existing) {
      // Refused, not silently returned. A close that already happened is a
      // fact the person needs to see — and the entry number tells them where
      // to look. Returning it quietly would make a genuine second attempt
      // indistinguishable from a retry.
      throw new ValidationError(`YEAR_END_ALREADY_CLOSED:${existing.entryNumber ?? existing.id}`)
    }

    // `createJournalEntry` — the same door every other posting uses. It runs
    // the period lock and the postable-lines checks, which a closing entry
    // needs at least as much as an ordinary one.
    // ⚠️ AND KEYED IN THE DATABASE (27 Sep 2026). The lookup above answers a
    // second close with a clear message, but two closes at the SAME moment
    // both pass it. The period as the entry's source puts them on the unique
    // index «one live entry per source»: the second gets the first's entry.
    return this.createJournalEntry(
      ctx,
      {
        date: plan.to,
        description: `Year-end close ${plan.from} — ${plan.to}`,
        reference,
        lines: plan.lines,
      } as CreateJournalEntry,
      {
        source: {
          type: 'year_end_close',
          id: sourceIdOf(ctx.workspaceId, 'year_end_close', plan.from, plan.to),
        },
      },
    )
  }

  /** Receivables and treasury reports. See operational-reports.ts. */
  async getCashFlow(ctx: TenancyContext, startDate: string, endDate: string) {
    return getCashFlow(ctx, startDate, endDate)
  }

  async getCustomerDebtReport(ctx: TenancyContext) {
    return getCustomerDebtReport(ctx)
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /**
   * The domain rules, checked against THIS workspace's chart of accounts.
   *
   * The same checks run again inside the posting function, in the transaction
   * that does the write. That is not redundancy for its own sake: this pass
   * produces a readable message listing everything wrong at once, and the
   * database pass is the one that cannot be raced.
   */
  private async assertLinesPostable(ctx: TenancyContext, lines: DraftLine[]) {
    const accounts = toFacts(await this.listAccounts(ctx))
    const violations = validateEntryLines(lines, accounts)
    if (violations.length > 0) {
      throw new ValidationError(violations.map((v) => `${v.code} (${v.detail})`).join('; '))
    }
  }

  private async writeEntry(
    ctx: TenancyContext,
    entry: {
      date: string
      description: string
      reference: string
      status: 'draft' | 'posted'
      sourceType: string | null
      sourceId: string | null
      reversalOf: string | null
      entryNumber?: string | undefined
      lines: DraftLine[]
    },
    /**
     * Set to true when a CONCURRENT writer booked the same source first and its
     * entry id was returned instead. The caller then reports «already posted»,
     * not «posted» — otherwise two tabs running the batch would both count the
     * same invoice as newly posted (one journal entry, two «posted» counts).
     */
    outcome?: { reused: boolean },
  ): Promise<string> {
    const year = Number(entry.date.slice(0, 4))
    let entryNumber =
      entry.entryNumber ??
      (entry.status === 'posted'
        ? nextEntryNumber(year, await this.repo.lastEntrySequence(ctx.workspaceId, year))
        : null)

    // The number is unique per workspace and year in the database, so two
    // simultaneous posts can compute the same one and one of them loses. That
    // is a numbering collision, not a failed posting: take the next number and
    // try again rather than telling the user their entry was rejected.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.repo.postEntry(
          ctx,
          {
            date: entry.date,
            description: entry.description,
            reference: entry.reference,
            status: entry.status,
            entryNumber,
            sourceType: entry.sourceType,
            sourceId: entry.sourceId,
            reversalOf: entry.reversalOf,
          },
          entry.lines,
        )
      } catch (error) {
        const code = domainErrorCode(error)
        if (code === 'ACCOUNTING_PERIOD_LOCKED') throw new ConflictError('ACCOUNTING_PERIOD_LOCKED')
        if (code && code.startsWith('JOURNAL_')) throw new ValidationError(code)

        const isDuplicate = (error as { code?: string } | null)?.code === '23505'
        if (!isDuplicate) throw error

        // The other unique index on this table is the one source document may
        // only be booked once. Losing that race means somebody else posted the
        // same document a moment ago, which is the outcome we wanted anyway.
        if (entry.sourceId && entry.sourceType) {
          const existing = await this.repo.findEntryBySource(
            ctx.workspaceId,
            entry.sourceType,
            entry.sourceId,
          )
          if (existing) {
            if (outcome) outcome.reused = true
            return existing.id
          }
        }

        if (!entryNumber || attempt === 2) throw error

        entryNumber = nextEntryNumber(
          year,
          await this.repo.lastEntrySequence(ctx.workspaceId, year),
        )
      }
    }

    /* istanbul ignore next — the loop either returns or throws */
    throw new ConflictError('JOURNAL_ENTRY_NUMBER_CONFLICT')
  }
}
