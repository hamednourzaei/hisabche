// ============================================
// packages/local-engine/src/routes/local-ledger.ts
//
// The device's counterpart of the server's `ledger.ensureAccountsForRoles` and
// `ledger.postDocument`: resolve an account by ROLE (creating the standard one
// when the business has none) and book ONE balanced, idempotent entry per
// document. The standard accounts are the shared table
// (`STANDARD_ACCOUNT_FOR_ROLE`), so the till posts to the same accounts the
// server would create.
//
// ⚠️ IDEMPOTENT PER DOCUMENT. A retried close/transfer/capital finds the entry
// its first attempt booked and returns it — never a second one.
// ⚠️ NEVER UNBALANCED. A draft whose debits and credits differ is refused
// loudly, not booked.
// ============================================

import {
  evaluatePeriodLock,
  round2,
  STANDARD_ACCOUNT_FOR_ROLE,
  type AccountRole,
  type LedgerPeriodLock,
  type PeriodLockDecision,
} from '@hisabche/validation'
import type { LocalDb } from '../db'
import { ConflictError, ValidationError } from '../errors'
import type { LocalContext } from '../types'
import { derivedId } from './derived-id'

const newId = (...parts: string[]) =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : derivedId('local', 'row', ...parts, String(Date.now()), String(Math.random()))

/**
 * Is the ledger closed on this day, for this branch? The decision is the SERVER's own function (`evaluatePeriodLock`); the
 * device only supplies the locks it holds in `meta`: the company lock (`period_lock`) and one per branch
 * (`period_lock_branch:<branchId>`). A document with no branch meets the company lock alone, as on the server.
 */
export const BRANCH_LOCK_PREFIX = 'period_lock_branch:'

export function periodLockDecision(
  db: LocalDb,
  entryDate: string,
  branchId: string | null = null,
): PeriodLockDecision {
  const company = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['period_lock'])
  const locks: LedgerPeriodLock[] = company?.value
    ? [{ branchId: null, lockedUntil: company.value, reason: '' }]
    : []
  if (branchId) {
    const branch = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
      BRANCH_LOCK_PREFIX + branchId,
    ])
    if (branch?.value) locks.push({ branchId, lockedUntil: branch.value, reason: '' })
  }
  return evaluatePeriodLock(entryDate, branchId, locks)
}

/**
 * The branch a payment belongs to: the branch of the invoices it settles, when they all share ONE. A payment that settles
 * invoices of two branches, or none, belongs to no single branch and meets the company lock alone — nothing is guessed.
 */
export function branchOfInvoices(
  db: LocalDb,
  workspaceId: string,
  invoiceIds: readonly string[],
): string | null {
  if (invoiceIds.length === 0) return null
  const rows = db.all<{ branch_id: string | null }>(
    `SELECT branch_id FROM invoice WHERE workspace_id = ? AND id IN (${invoiceIds.map(() => '?').join(', ')})`,
    [workspaceId, ...invoiceIds],
  )
  const branches = new Set(rows.map((row) => row.branch_id))
  if (branches.size !== 1) return null
  const [only] = [...branches]
  return only ?? null
}

/**
 * Refuse a ledger write dated inside a closed period — the same refusal (409 `ACCOUNTING_PERIOD_LOCKED`) the
 * server gives. Call it BEFORE the first write of the document, inside its transaction, so nothing is left behind.
 */
export function assertPeriodOpen(
  db: LocalDb,
  entryDate: string,
  branchId: string | null = null,
): void {
  const decision = periodLockDecision(db, entryDate, branchId)
  if (decision.locked) {
    throw new ConflictError(
      'ACCOUNTING_PERIOD_LOCKED',
      `Accounting period is locked through ${decision.lockedUntil}`,
    )
  }
}

/**
 * The account for each role: the business's own (first by code), else the
 * standard one — created once. A code already taken gets a numeric suffix
 * instead of being overwritten. A role with no standard account stays missing.
 */
export function ensureAccountsForRoles(
  db: LocalDb,
  workspaceId: string,
  roles: readonly AccountRole[],
): { accounts: Partial<Record<AccountRole, string>>; missing: AccountRole[] } {
  const accounts: Partial<Record<AccountRole, string>> = {}
  const missing: AccountRole[] = []
  const now = new Date().toISOString()

  for (const role of roles) {
    const own = db.get<{ id: string }>(
      `SELECT id FROM account
       WHERE workspace_id = ? AND role = ? AND is_active = 1 AND is_group = 0 AND deleted_at IS NULL
       ORDER BY code LIMIT 1`,
      [workspaceId, role],
    )
    if (own) {
      accounts[role] = own.id
      continue
    }
    const standard = STANDARD_ACCOUNT_FOR_ROLE[role]
    if (!standard) {
      missing.push(role)
      continue
    }
    let code = standard.code
    for (let n = 1; ; n += 1) {
      const taken = db.get<{ id: string }>(
        'SELECT id FROM account WHERE workspace_id = ? AND code = ? AND deleted_at IS NULL',
        [workspaceId, code],
      )
      if (!taken) break
      code = `${standard.code}${n}`
    }
    const id = newId(workspaceId, 'account', role)
    db.run(
      `INSERT INTO account (id, workspace_id, code, name, type, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, workspaceId, code, standard.name, standard.type, role, now, now],
    )
    accounts[role] = id
  }
  return { accounts, missing }
}

export interface DocumentDraft {
  sourceType: string
  sourceId: string
  date: string
  description: string
  reference: string
  /** The branch the document belongs to, when it has one: that branch's lock applies as well as the company's. */
  branchId?: string | null | undefined
  lines: ReadonlyArray<{ accountId: string; debit: number; credit: number }>
}

export type PostOutcome =
  | { status: 'posted' | 'already_posted'; entryId: string }
  | { status: 'skipped'; missing: string[] }

/** Book one balanced entry for a document; a second call returns the first entry. */
export function postDocument(db: LocalDb, ctx: LocalContext, draft: DocumentDraft): PostOutcome {
  const existing = db.get<{ id: string }>(
    `SELECT id FROM journal_entry
     WHERE workspace_id = ? AND source_type = ? AND source_id = ? AND status = 'posted'
       AND reversal_of IS NULL AND deleted_at IS NULL
     LIMIT 1`,
    [ctx.workspaceId, draft.sourceType, draft.sourceId],
  )
  if (existing) return { status: 'already_posted', entryId: existing.id }

  assertPeriodOpen(db, draft.date.slice(0, 10), draft.branchId ?? null)
  const lines = draft.lines.filter((line) => line.debit !== 0 || line.credit !== 0)
  const debit = round2(lines.reduce((sum, line) => sum + line.debit, 0))
  const credit = round2(lines.reduce((sum, line) => sum + line.credit, 0))
  if (lines.length === 0 || debit !== credit) {
    throw new ValidationError(`LEDGER_ENTRY_UNBALANCED: debit ${debit} · credit ${credit}`)
  }

  const now = new Date().toISOString()
  const entryId = newId(ctx.workspaceId, 'journal', draft.sourceType, draft.sourceId)
  const date = draft.date.slice(0, 10)
  db.run(
    `INSERT INTO journal_entry (
       id, workspace_id, entry_number, date, description, reference, status,
       source_type, source_id, posted_at, created_at, updated_at, origin, sync_state
     ) VALUES (?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?, ?, ?, 'local', 'local_only')`,
    [
      entryId,
      ctx.workspaceId,
      `J-${date.slice(0, 4)}-${draft.sourceType.toUpperCase()}-${draft.sourceId.slice(0, 8)}`,
      date,
      draft.description,
      draft.reference,
      draft.sourceType,
      draft.sourceId,
      now,
      now,
      now,
    ],
  )
  for (const line of lines) {
    db.run(
      `INSERT INTO journal_line (
         id, workspace_id, journal_id, account_id, debit, credit, description,
         created_at, updated_at, origin, sync_state
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        newId(entryId, line.accountId),
        ctx.workspaceId,
        entryId,
        line.accountId,
        line.debit,
        line.credit,
        draft.description,
        now,
        now,
      ],
    )
  }
  return { status: 'posted', entryId }
}

export interface LedgerReversal {
  id: string
  entryNumber: string
}

/**
 * Reverse ONE posted entry the way the server does: a NEW entry (`source_type = 'reversal'`, `reversal_of` = the
 * original) with every line inverted, dated `date`, and the original marked `reversed`. The original's date and lines
 * are never edited — a report for the period it fell in still shows it, and the reversal shows from its own date on.
 *
 * ⚠️ The reversal's date must be open (\`assertPeriodOpen\`): a closed day refuses the whole cancel. Call it inside
 * the document's transaction so a refusal leaves nothing half done. An entry that is not \`posted\` (already reversed,
 * or never booked) returns \`null\` — a second cancel does not post a second reversal.
 */
export function reverseLedgerEntry(
  db: LocalDb,
  ctx: LocalContext,
  entryId: string,
  options: { date: string; reason: string; now: string; branchId?: string | null | undefined },
): LedgerReversal | null {
  const entry = db.get<{
    id: string
    entry_number: string | null
    source_id: string | null
    status: string
  }>(
    `SELECT id, entry_number, source_id, status FROM journal_entry
      WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [entryId, ctx.workspaceId],
  )
  if (!entry || entry.status !== 'posted') return null

  const date = options.date.slice(0, 10)
  assertPeriodOpen(db, date, options.branchId ?? null)

  const lines = db.all<{ account_id: string; debit: number; credit: number }>(
    `SELECT account_id, debit, credit FROM journal_line
      WHERE journal_id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [entryId, ctx.workspaceId],
  )
  const reversalId = newId(ctx.workspaceId, 'reversal', entryId)
  const entryNumber = `REV-${entry.entry_number || entry.id}`

  db.run(
    `INSERT INTO journal_entry (
       id, workspace_id, entry_number, date, description, reference, status,
       source_type, source_id, reversal_of, posted_at, created_at, updated_at, origin, sync_state
     ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'reversal', ?, ?, ?, ?, ?, 'local', 'local_only')`,
    [
      reversalId,
      ctx.workspaceId,
      entryNumber,
      date,
      options.reason,
      entry.entry_number || '',
      entry.source_id,
      entryId,
      options.now,
      options.now,
      options.now,
    ],
  )
  for (const line of lines) {
    db.run(
      `INSERT INTO journal_line (
         id, workspace_id, journal_id, account_id, debit, credit, description,
         created_at, updated_at, origin, sync_state
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        newId(ctx.workspaceId, 'reversal-line', reversalId, line.account_id),
        ctx.workspaceId,
        reversalId,
        line.account_id,
        line.credit, // the old credit becomes the debit
        line.debit,
        `Reversal of line in ${entry.entry_number ?? entry.id}`,
        options.now,
        options.now,
      ],
    )
  }
  db.run("UPDATE journal_entry SET status = 'reversed', updated_at = ? WHERE id = ?", [
    options.now,
    entryId,
  ])
  return { id: reversalId, entryNumber }
}
