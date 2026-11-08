// ============================================
// packages/local-engine/src/routes/order-deposits.ts
//
// Order deposits on the device: the money a customer paid BEFORE the invoice
// existed, and the two moves that spend it.
//
//   receipt            Dr cash | bank            Cr customer advances
//   applied to invoice Dr customer advances      Cr receivable
//   refund             Dr customer advances      Cr cash | bank
//
// ⚠️ ONE SET OF RULES, NOT TWO. What a request must look like, what a balance
// means and how many decimals a currency has are decided by
// `@hisabche/validation` (`validateApplyDeposit`, `validateRefundDeposit`,
// `depositBalanceOf`, `canDrawFromDeposit`, `ledgerAmountOf`) — the same
// functions the server's service checks before it calls the SQL transaction in
// docs/order-deposit-apply-refund-01-migration.sql. Nothing here re-implements
// them.
//
// ⚠️ WHAT THE DEVICE POSTS, THE SERVER REPEATS. In the offline edition this is
// the book of record. In the cloud edition the same move is ALSO queued
// (`x-hisabche-queue: 1`) and travels to `POST /orders/:id/deposits/:id/apply`
// with the SAME idempotency key, so the server's locked transaction settles the
// invoice on ITS books and a retry finds the first result instead of a second
// one. That is the same arrangement `payments.ts` uses for a cash receipt.
//
// ⚠️ AMOUNTS ARE INTEGER MINOR UNITS. The deposit stores `amount_minor`; the
// ledger books numeric(18,2), so `ledgerAmountOf` converts with the currency's
// OWN precision and answers null when the figure cannot be represented — a
// refusal, never a rounding.
// ============================================

import { buildEnqueue } from '@hisabche/app-bridge'
import {
  canDrawFromDeposit,
  depositBalanceOf,
  ledgerAmountOf,
  ledgerFractionDigitsOf,
  round2,
  validateApplyDeposit,
  validateRefundDeposit,
  type AccountRole,
} from '@hisabche/validation'

import { requireCapability } from '../auth'
import type { LocalDb } from '../db'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { ensureAccountsForRoles, postDocument } from './local-ledger'

interface DepositRow {
  id: string
  workspace_id: string
  order_id: string
  customer_id: string
  amount_minor: number
  payment_method: string
  currency: string | null
  posting_status: string | null
  journal_entry_id: string | null
  applied_invoice_id: string | null
  created_at: string
}

interface MovementRow {
  id: string
  deposit_id: string
  invoice_id: string | null
  amount_minor: number
  currency: string
  reason: string | null
  method: string | null
  idempotency_key: string
  payment_id: string | null
  journal_entry_id: string | null
  sync_status: string
  created_at: string
}

/** What the customer screen calls this deposit. Derived, never stored. */
type DepositUsageStatus =
  'pending_posting' | 'posting_unknown' | 'available' | 'partially_used' | 'fully_used'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const nowIso = () => new Date().toISOString()

/** The deposit of THIS business, or 404 — another business's row is not «found». */
function requireDeposit(ctx: RouteHandlerContext, orderId: string, depositId: string): DepositRow {
  const row = ctx.db.get<DepositRow>(
    `SELECT * FROM order_deposits
      WHERE id = ? AND workspace_id = ? AND order_id = ? AND deleted_at IS NULL`,
    [depositId, ctx.ctx.workspaceId, orderId],
  )
  if (!row) throw new NotFoundError('Order deposit', depositId)
  return row
}

/**
 * What a movement still counts against the deposit.
 *
 * ⚠️ A MOVEMENT WHOSE PAYMENT WAS CANCELLED NO LONGER COUNTS. The server reads
 * this from `order_deposit_balance`; on the device the same question is «is its
 * payment still posted», so a cancelled payment gives the money back instead of
 * leaving the deposit permanently short.
 */
function countsAgainstDeposit(db: LocalDb, workspaceId: string, depositId: string) {
  const live = (table: 'order_deposit_applications' | 'order_deposit_refunds') =>
    db.get<{ total: number }>(
      `SELECT COALESCE(SUM(m.amount_minor), 0) AS total
         FROM ${table} m
        WHERE m.deposit_id = ? AND m.workspace_id = ? AND m.deleted_at IS NULL
          AND m.sync_status <> 'failed'
          AND (
            m.payment_id IS NULL
            OR EXISTS (
              SELECT 1 FROM payment p
               WHERE p.id = m.payment_id AND p.workspace_id = m.workspace_id
                 AND p.status = 'posted' AND p.deleted_at IS NULL
            )
          )`,
      [depositId, workspaceId],
    )?.total ?? 0

  return {
    appliedMinor: Number(live('order_deposit_applications')),
    refundedMinor: Number(live('order_deposit_refunds')),
  }
}

/** True while a move on this deposit is still waiting in the outbox. */
function hasPendingSync(db: LocalDb, workspaceId: string, depositId: string): boolean {
  const row = db.get<{ id: string }>(
    `SELECT q.client_id AS id
       FROM sync_queue q
      WHERE q.workspace_id = ? AND q.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM order_deposit_applications a
           WHERE a.id = q.client_id AND a.deposit_id = ?
          UNION ALL
          SELECT 1 FROM order_deposit_refunds r
           WHERE r.id = q.client_id AND r.deposit_id = ?
        )
      LIMIT 1`,
    [workspaceId, depositId, depositId],
  )
  return Boolean(row)
}

/**
 * What the screen calls this deposit.
 *
 * ⚠️ A NULL `posting_status` IS NOT «posted»: the row was written before the
 * column existed, so whether the receipt is booked is unknown and the screen
 * says so instead of claiming it was.
 */
function statusOf(
  postingStatus: string | null,
  balance: { remainingMinor: number; appliedMinor: number; refundedMinor: number },
): DepositUsageStatus {
  if (postingStatus === 'pending_posting') return 'pending_posting'
  if (postingStatus !== 'posted') return 'posting_unknown'
  if (balance.remainingMinor <= 0) return 'fully_used'
  if (balance.appliedMinor > 0 || balance.refundedMinor > 0) return 'partially_used'
  return 'available'
}

function viewOf(db: LocalDb, workspaceId: string, row: DepositRow) {
  const counts = countsAgainstDeposit(db, workspaceId, row.id)
  const balance = depositBalanceOf({
    amountMinor: row.amount_minor,
    appliedMinor: counts.appliedMinor,
    refundedMinor: counts.refundedMinor,
  })
  return {
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    amountMinor: balance.amountMinor,
    appliedMinor: balance.appliedMinor,
    refundedMinor: balance.refundedMinor,
    remainingMinor: balance.remainingMinor,
    currency: row.currency,
    paymentMethod: row.payment_method,
    postingStatus: row.posting_status,
    journalEntryId: row.journal_entry_id,
    status: statusOf(row.posting_status, balance),
    pendingSync: hasPendingSync(db, workspaceId, row.id),
    createdAt: row.created_at,
  }
}

/**
 * The currency precision every move on this deposit needs, or a refusal.
 *
 * A deposit whose currency is unknown cannot be converted: guessing the books
 * currency would book a hundredth of the money or a hundred times it.
 */
function digitsOf(deposit: DepositRow): number {
  const digits = ledgerFractionDigitsOf(deposit.currency)
  if (digits === null) throw new ValidationError('DEPOSIT_CURRENCY_UNKNOWN')
  return digits
}

/** The movement the server's answer and the screen both describe. */
function movementOf(row: MovementRow) {
  return {
    replayed: false,
    movementId: row.id,
    depositId: row.deposit_id,
    invoiceId: row.invoice_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    reason: row.reason,
    method: row.method,
    paymentId: row.payment_id ?? '',
    journalEntryId: row.journal_entry_id,
  }
}

/** Queue the move for the server, when this edition has one to sync to. */
function queueMovement(
  c: RouteHandlerContext,
  payload: Record<string, unknown>,
  clientId: string,
): boolean {
  if (c.headers?.['x-hisabche-queue'] !== '1') return false
  const enqueue = buildEnqueue({
    entity: 'order_deposits',
    operation: 'create',
    clientId,
    payload,
    userId: c.headers?.['x-hisabche-user-id'] ?? c.ctx.userId,
    workspaceId: c.ctx.workspaceId,
  })
  c.db.run(enqueue.sql, enqueue.params)
  return true
}

/**
 * The ledger entry for one move: Dr customer advances / Cr the other side.
 *
 * A chart of accounts that cannot express it refuses the whole move
 * (`DEPOSIT_ACCOUNTS_MISSING`) — the server's own code for the same condition.
 */
function postMovement(
  c: RouteHandlerContext,
  input: {
    sourceType: 'payment'
    sourceId: string
    date: string
    description: string
    reference: string
    branches: string | null
    otherRole: AccountRole
    amount: number
  },
): string {
  const roles: AccountRole[] = ['customer_advances', input.otherRole]
  const { accounts, missing } = ensureAccountsForRoles(c.db, c.ctx.workspaceId, roles)
  // Bound to locals: an index read is `string | undefined` under
  // `noUncheckedIndexedAccess`, and the check below is what makes them real.
  const advancesAccount = accounts.customer_advances
  const otherAccount = accounts[input.otherRole]
  if (missing.length > 0 || !advancesAccount || !otherAccount) {
    throw new ConflictError('DEPOSIT_ACCOUNTS_MISSING', 'DEPOSIT_ACCOUNTS_MISSING')
  }
  const outcome = postDocument(c.db, c.ctx, {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    date: input.date,
    description: input.description,
    reference: input.reference,
    branchId: input.branches,
    lines: [
      { accountId: advancesAccount, debit: input.amount, credit: 0 },
      { accountId: otherAccount, debit: 0, credit: input.amount },
    ],
  })
  // `skipped` would mean an account vanished between the lookup and the post;
  // the move did not happen, so it must not be recorded as if it had.
  if (outcome.status === 'skipped') {
    throw new ConflictError('DEPOSIT_ACCOUNTS_MISSING', 'DEPOSIT_ACCOUNTS_MISSING')
  }
  return outcome.entryId
}

/** The one order invoice this deposit may settle, checked against the device's own books. */
function requireApplicableInvoice(c: RouteHandlerContext, deposit: DepositRow, invoiceId: string) {
  const invoice = c.db.get<{
    id: string
    customer_id: string | null
    currency: string | null
    total: number
    paid_amount: number
    status: string
    branch_id: string | null
  }>(
    `SELECT id, customer_id, currency, total, paid_amount, status, branch_id
       FROM invoice
      WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [invoiceId, c.ctx.workspaceId],
  )
  if (!invoice) throw new NotFoundError('Invoice', invoiceId)
  if (invoice.customer_id !== deposit.customer_id) {
    throw new ValidationError('DEPOSIT_CUSTOMER_MISMATCH')
  }
  if (!invoice.currency || invoice.currency !== deposit.currency) {
    throw new ValidationError('DEPOSIT_CURRENCY_MISMATCH')
  }
  if (invoice.status === 'draft' || invoice.status === 'cancelled') {
    throw new ValidationError('DEPOSIT_INVOICE_NOT_FINAL')
  }
  const posted = c.db.get<{ id: string }>(
    `SELECT id FROM journal_entry
      WHERE workspace_id = ? AND source_type = 'invoice' AND source_id = ?
        AND status = 'posted' AND deleted_at IS NULL`,
    [c.ctx.workspaceId, invoice.id],
  )
  if (!posted) throw new ValidationError('DEPOSIT_INVOICE_NOT_POSTED')
  return invoice
}

export function registerOrderDepositsRoutes(router: Router) {
  // ─── The deposits of one order ───────────────────────────────
  router.get('/orders/:id/deposits', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const rows = db.all<DepositRow>(
      `SELECT * FROM order_deposits
        WHERE workspace_id = ? AND order_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [ctx.workspaceId, params.id],
    )
    return { __status: 200, __data: rows.map((row) => viewOf(db, ctx.workspaceId, row)) }
  })

  // ─── The deposits of one customer ────────────────────────────
  //
  // The screen where a person actually meets them: the customer page's
  // payments tab. Same shape as `GET /api/customers/:id/deposits`.
  router.get('/customers/:id/deposits', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const rows = db.all<DepositRow>(
      `SELECT * FROM order_deposits
        WHERE workspace_id = ? AND customer_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [ctx.workspaceId, params.id],
    )
    return { __status: 200, __data: rows.map((row) => viewOf(db, ctx.workspaceId, row)) }
  })

  // ─── Take a deposit (receipt) ────────────────────────────────
  router.post('/orders/:id/deposits', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    requireCapability(ctx, 'invoice.create')
    const orderId = params.id ?? ''
    const raw = (body ?? {}) as Record<string, unknown>
    const customerId = typeof raw.customerId === 'string' ? raw.customerId.trim() : ''
    const amountMinor = Number(raw.amountMinor)
    if (!customerId) throw new ValidationError('customerId is required')
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new ValidationError('DEPOSIT_AMOUNT_INVALID')
    }
    const paymentMethod =
      typeof raw.paymentMethod === 'string' && raw.paymentMethod.trim()
        ? raw.paymentMethod.trim()
        : 'cash'
    // The books currency decides, as on the server — never a default here.
    const currency = ctx.baseCurrency
    const date =
      typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
        ? raw.date
        : nowIso().slice(0, 10)
    const id = typeof raw.id === 'string' && raw.id ? raw.id : generateUuid()
    // V54 5.4: a booking deposit. The money is identical; the server checks the
    // session and records the kind when the receipt arrives.
    const sourceType = raw.sourceType === 'service_session' ? 'service_session' : null
    const now = nowIso()

    return db.transaction(() => {
      db.run(
        `INSERT INTO order_deposits
           (id, workspace_id, order_id, customer_id, amount_minor, payment_method,
            currency, posting_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [id, ctx.workspaceId, orderId, customerId, amountMinor, paymentMethod, currency, now, now],
      )

      // The receipt books Dr cash|bank / Cr customer advances, exactly as the
      // server does. A chart of accounts that cannot express it leaves the
      // deposit at `pending_posting` — an explicit, recoverable state that the
      // screen reports and `POST …/post` fixes.
      const digits = ledgerFractionDigitsOf(currency)
      const major = digits === null ? null : ledgerAmountOf(amountMinor, digits)
      const role: AccountRole = paymentMethod === 'bank' ? 'bank' : 'cash'
      let journalEntryId: string | null = null
      if (major !== null) {
        const { accounts, missing } = ensureAccountsForRoles(db, ctx.workspaceId, [
          role,
          'customer_advances',
        ])
        const debitAccount = accounts[role]
        const advanceAccount = accounts.customer_advances
        if (missing.length === 0 && debitAccount && advanceAccount) {
          const outcome = postDocument(db, ctx, {
            sourceType: 'order_deposit',
            sourceId: id,
            date,
            description: `بیعانه سفارش ${orderId}`,
            reference: orderId,
            branchId: null,
            lines: [
              { accountId: debitAccount, debit: major, credit: 0 },
              { accountId: advanceAccount, debit: 0, credit: major },
            ],
          })
          if (outcome.status !== 'skipped') journalEntryId = outcome.entryId
        }
      }

      db.run(
        `UPDATE order_deposits
            SET posting_status = ?, journal_entry_id = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [journalEntryId ? 'posted' : 'pending_posting', journalEntryId, now, id, ctx.workspaceId],
      )

      // The receipt travels too. Without this a deposit taken at this counter
      // exists only on this device: the next machine would offer the customer
      // a balance the shop already holds, and the server would never book the
      // liability. The id is the deposit's own, so the server writes the same
      // row rather than a second one.
      queueMovement(
        c,
        {
          movement: 'receipt',
          id,
          orderId,
          customerId,
          amountMinor,
          paymentMethod,
          date,
          ...(sourceType ? { sourceType } : {}),
        },
        id,
      )

      const inserted = db.get<DepositRow>('SELECT * FROM order_deposits WHERE id = ?', [id])!
      return { __status: 201, __data: viewOf(db, ctx.workspaceId, inserted) }
    })
  })

  // ─── Re-book a receipt the chart of accounts could not express ───
  router.post('/orders/:id/deposits/:depositId/post', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    requireCapability(ctx, 'invoice.create')
    const deposit = requireDeposit(c, params.id ?? '', params.depositId ?? '')
    const raw = (body ?? {}) as Record<string, unknown>
    const date =
      typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
        ? raw.date
        : nowIso().slice(0, 10)
    const digits = digitsOf(deposit)
    const major = ledgerAmountOf(deposit.amount_minor, digits)
    if (major === null) throw new ValidationError('DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED')
    const role: AccountRole = deposit.payment_method === 'bank' ? 'bank' : 'cash'
    const now = nowIso()

    return db.transaction(() => {
      const { accounts, missing } = ensureAccountsForRoles(db, ctx.workspaceId, [
        role,
        'customer_advances',
      ])
      const debitAccount = accounts[role]
      const advanceAccount = accounts.customer_advances
      if (missing.length > 0 || !debitAccount || !advanceAccount) {
        throw new ConflictError('DEPOSIT_ACCOUNTS_MISSING', 'DEPOSIT_ACCOUNTS_MISSING')
      }
      const outcome = postDocument(db, ctx, {
        sourceType: 'order_deposit',
        sourceId: deposit.id,
        date,
        description: `بیعانه سفارش ${deposit.order_id}`,
        reference: deposit.order_id,
        branchId: null,
        lines: [
          { accountId: debitAccount, debit: major, credit: 0 },
          { accountId: advanceAccount, debit: 0, credit: major },
        ],
      })
      if (outcome.status === 'skipped') {
        throw new ConflictError('DEPOSIT_ACCOUNTS_MISSING', 'DEPOSIT_ACCOUNTS_MISSING')
      }
      db.run(
        `UPDATE order_deposits
            SET posting_status = 'posted', journal_entry_id = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [outcome.entryId, now, deposit.id, ctx.workspaceId],
      )
      const inserted = db.get<DepositRow>('SELECT * FROM order_deposits WHERE id = ?', [
        deposit.id,
      ])!
      return { __status: 200, __data: viewOf(db, ctx.workspaceId, inserted) }
    })
  })

  // ─── Apply part of a deposit to a final invoice ──────────────
  router.post('/orders/:id/deposits/:depositId/apply', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    // Settling an invoice is a sales write, as on the server.
    requireCapability(ctx, 'invoice.create')
    const deposit = requireDeposit(c, params.id ?? '', params.depositId ?? '')
    const raw = (body ?? {}) as Record<string, unknown>
    const invoiceId = typeof raw.invoiceId === 'string' ? raw.invoiceId.trim() : ''
    const amountMinor = Number(raw.amountMinor)
    const idempotencyKey = typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey.trim() : ''
    const digits = digitsOf(deposit)

    const problems = validateApplyDeposit({
      invoiceId,
      amountMinor,
      idempotencyKey,
      fractionDigits: digits,
    })
    if (problems.length > 0) throw new ValidationError(problems[0]!)

    const date =
      typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
        ? raw.date
        : nowIso().slice(0, 10)
    const now = nowIso()

    return db.transaction(() => {
      // A retry of a request that already succeeded answers with that result.
      const existing = db.get<MovementRow>(
        `SELECT * FROM order_deposit_applications
          WHERE workspace_id = ? AND deposit_id = ? AND idempotency_key = ?`,
        [ctx.workspaceId, deposit.id, idempotencyKey],
      )
      if (existing) {
        if (existing.invoice_id !== invoiceId || existing.amount_minor !== amountMinor) {
          throw new ConflictError('DEPOSIT_IDEMPOTENCY_CONFLICT', 'DEPOSIT_IDEMPOTENCY_CONFLICT')
        }
        return {
          __status: 200,
          __data: { ...movementOf(existing), replayed: true },
        }
      }

      if (deposit.posting_status === 'pending_posting') {
        throw new ConflictError('DEPOSIT_PENDING_POSTING', 'DEPOSIT_PENDING_POSTING')
      }
      const receipt = db.get<{ id: string }>(
        `SELECT id FROM journal_entry
          WHERE workspace_id = ? AND source_type = 'order_deposit' AND source_id = ?
            AND status = 'posted' AND deleted_at IS NULL`,
        [ctx.workspaceId, deposit.id],
      )
      if (!receipt) throw new ConflictError('DEPOSIT_NOT_BOOKED', 'DEPOSIT_NOT_BOOKED')

      const invoice = requireApplicableInvoice(c, deposit, invoiceId)

      const major = ledgerAmountOf(amountMinor, digits)
      if (major === null) throw new ValidationError('DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED')

      const outstanding = round2(invoice.total - invoice.paid_amount)
      if (major > outstanding) {
        throw new ConflictError('DEPOSIT_APPLY_EXCEEDS_INVOICE', 'DEPOSIT_APPLY_EXCEEDS_INVOICE')
      }

      const counts = countsAgainstDeposit(db, ctx.workspaceId, deposit.id)
      const balance = depositBalanceOf({
        amountMinor: deposit.amount_minor,
        appliedMinor: counts.appliedMinor,
        refundedMinor: counts.refundedMinor,
      })
      if (!canDrawFromDeposit(balance.remainingMinor, amountMinor)) {
        throw new ConflictError('DEPOSIT_INSUFFICIENT_BALANCE', 'DEPOSIT_INSUFFICIENT_BALANCE')
      }

      // 1. The settlement IS a payment: direction 'in', the deposit as its method,
      //    and one allocation — the same rows `payments_record` writes server-side.
      const paymentId = generateUuid()
      const count = db.get<{ count: number }>(
        "SELECT count(*) AS count FROM payment WHERE workspace_id = ? AND direction = 'in'",
        [ctx.workspaceId],
      )
      const paymentNumber = `RCT-${String((count?.count ?? 0) + 1).padStart(5, '0')}`
      db.run(
        `INSERT INTO payment (
           id, workspace_id, payment_number, direction, party_type, party_id,
           amount, currency, method, entry_date, reference, notes, status,
           created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, 'in', 'customer', ?, ?, ?, 'order_deposit', ?, ?, ?, 'posted',
                   ?, ?, 'local', 'local_only')`,
        [
          paymentId,
          ctx.workspaceId,
          paymentNumber,
          deposit.customer_id,
          major,
          deposit.currency,
          date,
          `DEPOSIT:${deposit.id}`,
          'Application of order deposit',
          now,
          now,
        ],
      )
      db.run(
        `INSERT INTO payment_allocation (
           id, workspace_id, payment_id, invoice_id, amount,
           created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [generateUuid(), ctx.workspaceId, paymentId, invoice.id, major, now, now],
      )
      const nextPaid = round2(invoice.paid_amount + major)
      db.run(
        'UPDATE invoice SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
        [
          nextPaid,
          nextPaid >= invoice.total ? 'completed' : 'partial',
          now,
          invoice.id,
          ctx.workspaceId,
        ],
      )

      // 2. Dr customer advances / Cr receivable — credited what the invoice is
      //    owed, debited the liability we held.
      const journalEntryId = postMovement(c, {
        sourceType: 'payment',
        sourceId: paymentId,
        date,
        description: `تطبیق بیعانه سفارش با فاکتور ${invoice.id}`,
        reference: paymentNumber,
        branches: invoice.branch_id,
        otherRole: 'receivable',
        amount: major,
      })
      db.run('UPDATE payment SET journal_entry_id = ? WHERE id = ? AND workspace_id = ?', [
        journalEntryId,
        paymentId,
        ctx.workspaceId,
      ])

      // 3. The movement itself, then the pointer the older screens read.
      const movementId = generateUuid()
      db.run(
        `INSERT INTO order_deposit_applications
           (id, workspace_id, deposit_id, invoice_id, amount_minor, currency, idempotency_key,
            payment_id, journal_entry_id, sync_status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?)`,
        [
          movementId,
          ctx.workspaceId,
          deposit.id,
          invoice.id,
          amountMinor,
          deposit.currency,
          idempotencyKey,
          paymentId,
          journalEntryId,
          ctx.userId,
          now,
          now,
        ],
      )
      db.run(
        `UPDATE order_deposits
            SET applied_invoice_id = COALESCE(applied_invoice_id, ?), updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [invoice.id, now, deposit.id, ctx.workspaceId],
      )

      queueMovement(
        c,
        {
          movement: 'apply',
          orderId: deposit.order_id,
          depositId: deposit.id,
          invoiceId: invoice.id,
          amountMinor,
          currency: deposit.currency,
          idempotencyKey,
          date,
        },
        movementId,
      )

      const inserted = db.get<MovementRow>(
        'SELECT * FROM order_deposit_applications WHERE id = ?',
        [movementId],
      )!
      return { __status: 201, __data: movementOf(inserted) }
    })
  })

  // ─── Refund part (or all) of an unused deposit ──────────────
  router.post('/orders/:id/deposits/:depositId/refund', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    // Money going back out to a customer is a payment, not an invoice edit.
    requireCapability(ctx, 'payment.record')
    const deposit = requireDeposit(c, params.id ?? '', params.depositId ?? '')
    const raw = (body ?? {}) as Record<string, unknown>
    const amountMinor = Number(raw.amountMinor)
    const idempotencyKey = typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey.trim() : ''
    const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
    const method = typeof raw.method === 'string' && raw.method.trim() ? raw.method.trim() : 'cash'
    const digits = digitsOf(deposit)

    const problems = validateRefundDeposit({
      amountMinor,
      idempotencyKey,
      fractionDigits: digits,
      reason,
    })
    if (problems.length > 0) throw new ValidationError(problems[0]!)
    if (method !== 'cash' && method !== 'bank') throw new ValidationError('DEPOSIT_METHOD_INVALID')

    const date =
      typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
        ? raw.date
        : nowIso().slice(0, 10)
    const now = nowIso()

    return db.transaction(() => {
      const existing = db.get<MovementRow>(
        `SELECT * FROM order_deposit_refunds
          WHERE workspace_id = ? AND deposit_id = ? AND idempotency_key = ?`,
        [ctx.workspaceId, deposit.id, idempotencyKey],
      )
      if (existing) {
        if (existing.amount_minor !== amountMinor || existing.reason !== reason) {
          throw new ConflictError('DEPOSIT_IDEMPOTENCY_CONFLICT', 'DEPOSIT_IDEMPOTENCY_CONFLICT')
        }
        return { __status: 200, __data: { ...movementOf(existing), replayed: true } }
      }

      if (deposit.posting_status === 'pending_posting') {
        throw new ConflictError('DEPOSIT_PENDING_POSTING', 'DEPOSIT_PENDING_POSTING')
      }
      const receipt = db.get<{ id: string }>(
        `SELECT id FROM journal_entry
          WHERE workspace_id = ? AND source_type = 'order_deposit' AND source_id = ?
            AND status = 'posted' AND deleted_at IS NULL`,
        [ctx.workspaceId, deposit.id],
      )
      // Nothing is refunded from money that was never booked: debiting advances
      // that were never credited would invent a balance.
      if (!receipt)
        throw new ConflictError('DEPOSIT_REFUND_NOT_POSTED', 'DEPOSIT_REFUND_NOT_POSTED')

      const major = ledgerAmountOf(amountMinor, digits)
      if (major === null) throw new ValidationError('DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED')

      const counts = countsAgainstDeposit(db, ctx.workspaceId, deposit.id)
      const balance = depositBalanceOf({
        amountMinor: deposit.amount_minor,
        appliedMinor: counts.appliedMinor,
        refundedMinor: counts.refundedMinor,
      })
      if (!canDrawFromDeposit(balance.remainingMinor, amountMinor)) {
        throw new ConflictError('DEPOSIT_INSUFFICIENT_BALANCE', 'DEPOSIT_INSUFFICIENT_BALANCE')
      }

      // 1. Money out is a payment with no allocation: it returns the unused
      //    advance, it does not settle anything.
      const paymentId = generateUuid()
      const count = db.get<{ count: number }>(
        "SELECT count(*) AS count FROM payment WHERE workspace_id = ? AND direction = 'out'",
        [ctx.workspaceId],
      )
      const paymentNumber = `VCH-${String((count?.count ?? 0) + 1).padStart(5, '0')}`
      db.run(
        `INSERT INTO payment (
           id, workspace_id, payment_number, direction, party_type, party_id,
           amount, currency, method, entry_date, reference, notes, status,
           created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, 'out', 'customer', ?, ?, ?, ?, ?, ?, ?, 'posted',
                   ?, ?, 'local', 'local_only')`,
        [
          paymentId,
          ctx.workspaceId,
          paymentNumber,
          deposit.customer_id,
          major,
          deposit.currency,
          method,
          date,
          `DEPOSIT:${deposit.id}`,
          reason,
          now,
          now,
        ],
      )

      // 2. Dr customer advances / Cr cash | bank.
      const journalEntryId = postMovement(c, {
        sourceType: 'payment',
        sourceId: paymentId,
        date,
        description: `بازگرداندن بیعانه سفارش ${deposit.order_id}`,
        reference: paymentNumber,
        branches: null,
        otherRole: method === 'bank' ? 'bank' : 'cash',
        amount: major,
      })
      db.run('UPDATE payment SET journal_entry_id = ? WHERE id = ? AND workspace_id = ?', [
        journalEntryId,
        paymentId,
        ctx.workspaceId,
      ])

      // 3. The refund row — reason included, as the column requires.
      const movementId = generateUuid()
      db.run(
        `INSERT INTO order_deposit_refunds
           (id, workspace_id, deposit_id, amount_minor, currency, method, reason,
            idempotency_key, payment_id, journal_entry_id, sync_status, created_by,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?)`,
        [
          movementId,
          ctx.workspaceId,
          deposit.id,
          amountMinor,
          deposit.currency,
          method,
          reason,
          idempotencyKey,
          paymentId,
          journalEntryId,
          ctx.userId,
          now,
          now,
        ],
      )

      queueMovement(
        c,
        {
          movement: 'refund',
          orderId: deposit.order_id,
          depositId: deposit.id,
          amountMinor,
          currency: deposit.currency,
          reason,
          method,
          idempotencyKey,
          date,
        },
        movementId,
      )

      const inserted = db.get<MovementRow>('SELECT * FROM order_deposit_refunds WHERE id = ?', [
        movementId,
      ])!
      return { __status: 201, __data: movementOf(inserted) }
    })
  })
}
