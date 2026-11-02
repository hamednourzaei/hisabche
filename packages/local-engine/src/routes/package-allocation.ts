// ============================================
// packages/local-engine/src/routes/package-allocation.ts
//
// M5 - the DEVICE side of the allocation rule. It owns no rule: which GRANTs a consume draws from, whether each is
// expired or suspended, and how much deferred revenue each releases are decided by `planGrantConsumption` /
// `allocatableGrantsFromFacts` (packages/validation) - the same functions the golden vectors prove against the server's SQL
// trigger (docs/package-deferred-revenue-01-migration.sql). This file only reads the facts from SQLite, writes the
// allocation rows and the journal entry, inside the caller's transaction.
//
// The server stays the final authority: when the command syncs, its trigger allocates again from ITS ledger; a consume the
// device accepted and the server refuses (an expired GRANT, a second device spent the last credit) comes back as a conflict,
// never silently.
// ============================================

import {
  allocatableGrantsFromFacts,
  grantStatuses,
  planGrantConsumption,
  unattributedBalance,
  type LedgerAllocationFact,
} from '@hisabche/validation'
import { ConflictError } from '../errors'
import type { RouteHandlerContext } from '../types'
import { ensureAccountsForRoles, postDocument, reverseLedgerEntry } from './local-ledger'

interface ConsumeLike {
  id: string
  customerId: string
  packageProductId: string
  quantity: number
  effectiveDate: string
}

type Db = RouteHandlerContext['db']

/** The ledger facts of one (customer, package), read from SQLite - exactly what the server's SQL reads. */
function readFacts(
  c: RouteHandlerContext,
  scope: { customerId: string; packageProductId: string; excludeEntryId?: string },
) {
  const entry = {
    customerId: scope.customerId,
    packageProductId: scope.packageProductId,
    id: scope.excludeEntryId ?? '',
  }
  const ws = c.ctx.workspaceId
  const grants = c.db.all<{
    id: string
    effective_date: string
    quantity: number
    deferred_amount: number | null
    term_months: number | null
  }>(
    `SELECT id, effective_date, quantity, deferred_amount, term_months FROM package_credit_ledger
      WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND entry_type = 'GRANT' AND deleted_at IS NULL`,
    [ws, entry.customerId, entry.packageProductId],
  )
  const adjustments = c.db.all<{ reference_entry_id: string; quantity: number }>(
    `SELECT reference_entry_id, quantity FROM package_credit_ledger
      WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND entry_type = 'ADJUSTMENT'
        AND reference_entry_id IS NOT NULL AND deleted_at IS NULL`,
    [ws, entry.customerId, entry.packageProductId],
  )
  const manual = c.db.get<{ q: number | null }>(
    `SELECT SUM(quantity) AS q FROM package_credit_ledger
      WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND entry_type = 'ADJUSTMENT'
        AND reference_entry_id IS NULL AND quantity > 0 AND deleted_at IS NULL`,
    [ws, entry.customerId, entry.packageProductId],
  )
  const allocationRows = c.db.all<{
    entry_id: string
    grant_entry_id: string | null
    kind: 'CONSUME' | 'REVERSAL'
    quantity: number
    released_amount: number
    effective_date: string
  }>(
    `SELECT a.entry_id, a.grant_entry_id, a.kind, a.quantity, a.released_amount, l.effective_date
       FROM package_credit_allocations a
       JOIN package_credit_ledger l ON l.id = a.entry_id
      WHERE a.workspace_id = ? AND l.customer_id = ? AND l.package_product_id = ?`,
    [ws, entry.customerId, entry.packageProductId],
  )
  const allocations: LedgerAllocationFact[] = allocationRows.map((a) => ({
    entryId: a.entry_id,
    grantId: a.grant_entry_id,
    kind: a.kind,
    quantity: a.quantity,
    releasedAmount: a.released_amount,
    effectiveDate: a.effective_date,
  }))
  const reversed = c.db.all<{ reference_entry_id: string }>(
    `SELECT reference_entry_id FROM package_credit_ledger
      WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND entry_type = 'REVERSAL'
        AND reference_entry_id IS NOT NULL AND deleted_at IS NULL`,
    [ws, entry.customerId, entry.packageProductId],
  )
  const suspensions = c.db.all<{
    grant_entry_id: string
    kind: 'SUSPEND' | 'RESUME'
    effective_on: string
  }>(
    `SELECT grant_entry_id, kind, effective_on FROM package_credit_suspensions WHERE workspace_id = ? ORDER BY created_at, rowid`,
    [ws],
  )

  // Consumptions that predate the allocation rows: charged to GRANTs with no deferred amount, never counted twice.
  const allocated = new Set(allocationRows.map((a) => a.entry_id))
  const legacyRows = c.db.all<{
    id: string
    entry_type: string
    quantity: number
    reference_entry_id: string | null
  }>(
    `SELECT id, entry_type, quantity, reference_entry_id FROM package_credit_ledger
      WHERE workspace_id = ? AND customer_id = ? AND package_product_id = ? AND entry_type IN ('CONSUME', 'REVERSAL')
        AND id <> ? AND deleted_at IS NULL`,
    [ws, entry.customerId, entry.packageProductId, entry.id],
  )
  const legacyConsumes = new Set(
    legacyRows.filter((r) => r.entry_type === 'CONSUME' && !allocated.has(r.id)).map((r) => r.id),
  )
  const legacyConsumed = legacyRows.reduce((sum, r) => {
    if (r.entry_type === 'CONSUME' && legacyConsumes.has(r.id)) return sum + r.quantity
    if (
      r.entry_type === 'REVERSAL' &&
      r.reference_entry_id &&
      legacyConsumes.has(r.reference_entry_id)
    ) {
      return sum - r.quantity
    }
    return sum
  }, 0)

  return {
    input: {
      grants: grants.map((g) => ({
        id: g.id,
        startsOn: g.effective_date,
        quantity: g.quantity,
        deferredAmount: g.deferred_amount,
        termMonths: g.term_months,
      })),
      adjustments: adjustments.map((a) => ({
        grantId: a.reference_entry_id,
        quantity: a.quantity,
      })),
      allocations,
      reversedConsumeIds: new Set(reversed.map((r) => r.reference_entry_id)),
      suspensionEvents: suspensions.map((s, order) => ({
        grantId: s.grant_entry_id,
        kind: s.kind,
        effectiveOn: s.effective_on,
        order,
      })),
      legacyConsumed,
    },
    unattributed: unattributedBalance({ manualTopUps: manual?.q ?? 0, allocations }),
  }
}

/**
 * A CONSUME was just written: allocate it over the eligible GRANTs, record how much deferred revenue each released and
 * book ONE entry (debit deferred revenue, credit sales). Throws - and so rolls the caller's transaction back - when no
 * eligible GRANT covers it, when the books have no deferred-revenue account, or when the date is in a closed period.
 */
export function allocateConsume(c: RouteHandlerContext, entry: ConsumeLike): void {
  const { input, unattributed } = readFacts(c, {
    customerId: entry.customerId,
    packageProductId: entry.packageProductId,
    excludeEntryId: entry.id,
  })
  const grants = allocatableGrantsFromFacts(input)
  const plan = planGrantConsumption(grants, entry.quantity, entry.effectiveDate, unattributed)
  if (plan.shortfall > 0) throw new ConflictError('INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT')

  const now = new Date().toISOString()
  for (const allocation of plan.allocations) {
    c.db.run(
      `INSERT INTO package_credit_allocations
         (id, workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date, created_at)
       VALUES (?, ?, ?, 'CONSUME', ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        c.ctx.workspaceId,
        entry.id,
        allocation.grantId,
        allocation.quantity,
        allocation.releasedAmount,
        entry.effectiveDate,
        now,
      ],
    )
  }

  if (plan.totalReleasedAmount > 0) {
    const { accounts, missing } = ensureAccountsForRoles(c.db, c.ctx.workspaceId, [
      'deferred_revenue',
      'sales',
    ])
    if (missing.length > 0 || !accounts.deferred_revenue || !accounts.sales) {
      throw new ConflictError('DEFERRED_REVENUE_ACCOUNT_MISSING')
    }
    postDocument(c.db, c.ctx, {
      sourceType: 'package_release',
      sourceId: entry.id,
      date: entry.effectiveDate,
      description: 'Package delivery: deferred revenue released',
      reference: entry.id,
      lines: [
        { accountId: accounts.deferred_revenue, debit: plan.totalReleasedAmount, credit: 0 },
        { accountId: accounts.sales, debit: 0, credit: plan.totalReleasedAmount },
      ],
    })
  }
}

/**
 * A REVERSAL of a consume was just written: give back exactly what that consume allocated and released, and reverse the
 * release entry (a new dated entry; the original stays).
 */
export function reverseConsume(
  c: RouteHandlerContext,
  reversal: { id: string; referenceEntryId: string; effectiveDate: string },
): void {
  const rows = c.db.all<{
    grant_entry_id: string | null
    quantity: number
    released_amount: number
  }>(
    `SELECT grant_entry_id, quantity, released_amount FROM package_credit_allocations
      WHERE workspace_id = ? AND entry_id = ? AND kind = 'CONSUME'`,
    [c.ctx.workspaceId, reversal.referenceEntryId],
  )
  if (rows.length === 0) return // a consume from before allocation existed: nothing was released

  const now = new Date().toISOString()
  let total = 0
  for (const row of rows) {
    c.db.run(
      `INSERT INTO package_credit_allocations
         (id, workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date, created_at)
       VALUES (?, ?, ?, 'REVERSAL', ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        c.ctx.workspaceId,
        reversal.id,
        row.grant_entry_id,
        row.quantity,
        row.released_amount,
        reversal.effectiveDate,
        now,
      ],
    )
    total += row.released_amount
  }
  if (total <= 0) return

  const release = c.db.get<{ id: string }>(
    `SELECT id FROM journal_entry WHERE workspace_id = ? AND source_type = 'package_release' AND source_id = ?
        AND status = 'posted' AND reversal_of IS NULL AND deleted_at IS NULL LIMIT 1`,
    [c.ctx.workspaceId, reversal.referenceEntryId],
  )
  if (!release) throw new ConflictError('PACKAGE_RELEASE_ENTRY_MISSING')
  reverseLedgerEntry(c.db as Db, c.ctx, release.id, {
    date: reversal.effectiveDate,
    reason: 'Package delivery cancelled: deferred revenue restored',
    now,
  })
}

/** The status of every GRANT of a customer today (term, activation, expiry, suspension, what is left) - the shared function. */
export function listGrantStatuses(
  c: RouteHandlerContext,
  customerId: string,
  packageProductId: string | undefined,
  today: string,
) {
  const products = packageProductId
    ? [packageProductId]
    : c.db
        .all<{ package_product_id: string }>(
          `SELECT DISTINCT package_product_id FROM package_credit_ledger
            WHERE workspace_id = ? AND customer_id = ? AND entry_type = 'GRANT' AND deleted_at IS NULL`,
          [c.ctx.workspaceId, customerId],
        )
        .map((r) => r.package_product_id)
  return products.flatMap((product) =>
    grantStatuses(readFacts(c, { customerId, packageProductId: product }).input, today).map(
      (status) => ({
        ...status,
        customerId,
        packageProductId: product,
      }),
    ),
  )
}
