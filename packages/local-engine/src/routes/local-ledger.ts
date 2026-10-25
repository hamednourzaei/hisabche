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

import { round2, STANDARD_ACCOUNT_FOR_ROLE, type AccountRole } from '@hisabche/validation'
import type { LocalDb } from '../db'
import { ValidationError } from '../errors'
import type { LocalContext } from '../types'
import { derivedId } from './derived-id'

const newId = (...parts: string[]) =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : derivedId('local', 'row', ...parts, String(Date.now()), String(Math.random()))

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
