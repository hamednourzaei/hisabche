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
  advanceUsageOf,
  canDrawFromDeposit,
  DEFAULT_DEPOSIT_FORFEITURE_POLICY,
  decideDepositForfeiture,
  depositBalanceOf,
  ledgerAmountOf,
  ledgerFractionDigitsOf,
  round2,
  validateApplyDeposit,
  validateRefundDeposit,
  type AccountRole,
  type DepositForfeiturePolicy,
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
  /** NULL on a pre_purchase advance: the supplier is the party, not the customer. */
  customer_id: string | null
  /** The supplier side of a pre_purchase advance; NULL for every customer deposit. */
  supplier_id: string | null
  /** `sales_order` | `service_session` | `pre_sale` | `pre_purchase`. */
  source_type: string | null
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

/** Which side of the books a deposit lives on. The KIND decides, never the presence of an id. */
type DepositSide = 'customer' | 'supplier'

function sideOf(deposit: DepositRow): DepositSide {
  return deposit.source_type === 'pre_purchase' ? 'supplier' : 'customer'
}

/**
 * The party this deposit belongs to, or a refusal.
 *
 * ⚠️ NEVER A GUESS. A pulled pre_purchase row whose party could not be mapped
 * carries `supplier_id = NULL` on purpose (docs/FINDING-advances-party-identity.sql).
 * Falling back to `customer_id` — the old column that held the supplier id
 * before advances-04 — would move the money under whatever party happens to
 * share that UUID. The screen gets a code it can explain instead.
 */
function partyOf(deposit: DepositRow): string {
  if (sideOf(deposit) === 'supplier') {
    if (!deposit.supplier_id) throw new ValidationError('ADVANCE_PARTY_UNKNOWN')
    return deposit.supplier_id
  }
  if (!deposit.customer_id) throw new ValidationError('DEPOSIT_PARTY_UNKNOWN')
  return deposit.customer_id
}

/** The advances account this deposit's receipt credited. */
function advancesRoleOf(deposit: DepositRow): 'customer_advances' | 'supplier_advances' {
  return sideOf(deposit) === 'supplier' ? 'supplier_advances' : 'customer_advances'
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
    supplierId: row.supplier_id ?? null,
    sourceType: row.source_type ?? 'sales_order',
    amountMinor: balance.amountMinor,
    appliedMinor: balance.appliedMinor,
    refundedMinor: balance.refundedMinor,
    remainingMinor: balance.remainingMinor,
    currency: row.currency,
    paymentMethod: row.payment_method,
    postingStatus: row.posting_status,
    journalEntryId: row.journal_entry_id,
    status: statusOf(row.posting_status, balance),
    // WP-05: the usage model beside the receipt state and the document, never
    // instead of either. Null when a figure could not be read.
    usage: advanceUsageOf(balance),
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
 * The ledger entry for one move: the advances line against the other side.
 *
 * `advancesOnDebit` says WHICH SIDE the advances account sits on. It is not a
 * property of the kind, which is why it is a parameter and not a lookup:
 *
 *   receipt   (either kind) Dr advances      / Cr cash | bank   → true
 *   sale apply              Dr customer adv. / Cr receivable    → true
 *   purchase apply          Dr payable       / Cr supplier adv. → false
 *   refund    (either kind) Dr advances      / Cr cash | bank   → true, except
 *   purchase refund         Dr cash | bank   / Cr supplier adv. → false
 *
 * A chart of accounts that cannot express it refuses the whole move
 * (`DEPOSIT_ACCOUNTS_MISSING`) — the server's own code for the same condition.
 */
function postMovement(
  c: RouteHandlerContext,
  input: {
    sourceType: 'order_deposit' | 'payment'
    sourceId: string
    date: string
    description: string
    reference: string
    branches: string | null
    advanceRole: 'customer_advances' | 'supplier_advances'
    advancesOnDebit: boolean
    otherRole: AccountRole
    amount: number
  },
): string {
  const roles: AccountRole[] = [input.advanceRole, input.otherRole]
  const { accounts, missing } = ensureAccountsForRoles(c.db, c.ctx.workspaceId, roles)
  // Bound to locals: an index read is `string | undefined` under
  // `noUncheckedIndexedAccess`, and the check below is what makes them real.
  const advancesAccount = accounts[input.advanceRole]
  const otherAccount = accounts[input.otherRole]
  if (missing.length > 0 || !advancesAccount || !otherAccount) {
    throw new ConflictError('DEPOSIT_ACCOUNTS_MISSING', 'DEPOSIT_ACCOUNTS_MISSING')
  }
  const lines = input.advancesOnDebit
    ? [
        { accountId: advancesAccount, debit: input.amount, credit: 0 },
        { accountId: otherAccount, debit: 0, credit: input.amount },
      ]
    : [
        { accountId: otherAccount, debit: input.amount, credit: 0 },
        { accountId: advancesAccount, debit: 0, credit: input.amount },
      ]
  const outcome = postDocument(c.db, c.ctx, {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    date: input.date,
    description: input.description,
    reference: input.reference,
    branchId: input.branches,
    lines,
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
    type: string | null
    customer_id: string | null
    supplier_id: string | null
    currency: string | null
    total: number
    paid_amount: number
    status: string
    branch_id: string | null
  }>(
    `SELECT id, type, customer_id, supplier_id, currency, total, paid_amount, status, branch_id
       FROM invoice
      WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [invoiceId, c.ctx.workspaceId],
  )
  if (!invoice) throw new NotFoundError('Invoice', invoiceId)

  // ── The side decides which invoice can take the money ─────────────────────
  //
  // A customer advance settles a SALE for that customer; a supplier advance
  // settles a PURCHASE from that supplier. Comparing customer_id on both sides
  // was the old conflation — a purchase invoice whose `customer_id` happened to
  // be NULL matched a pre_purchase advance whose `customer_id` was also NULL
  // (`null = null`), which is exactly how money moves to a walk-in sale.
  if (sideOf(deposit) === 'supplier') {
    if (invoice.type !== 'purchase') throw new ValidationError('ADVANCE_INVOICE_NOT_PURCHASE')
    if (invoice.supplier_id !== deposit.supplier_id) {
      throw new ValidationError('DEPOSIT_SUPPLIER_MISMATCH')
    }
  } else {
    if (invoice.customer_id !== deposit.customer_id) {
      throw new ValidationError('DEPOSIT_CUSTOMER_MISMATCH')
    }
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
  // ─── WP-13: preview a deposit forfeiture before applying it ───
  // A cancelled order must not silently take the customer's money. This route
  // returns the SHARED decision; applying it stays with the caller, under its
  // own locks, so the device and the server cannot drift apart.
  router.post('/orders/:id/deposits/:depositId/forfeiture-decision', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.read')
    const row = c.db.get<{ id: string; amount_minor: number }>(
      `SELECT id, amount_minor FROM order_deposits
       WHERE id = ? AND workspace_id = ? AND order_id = ? AND deleted_at IS NULL`,
      [c.params.depositId, c.ctx.workspaceId, c.params.id],
    )
    if (!row) throw new NotFoundError('Order deposit', c.params.depositId ?? '')
    const body = (c.body || {}) as {
      reason?: unknown
      cancelledOn?: unknown
      asOf?: unknown
      alreadyAppliedMinor?: unknown
      policy?: Partial<DepositForfeiturePolicy>
    }
    const decision = decideDepositForfeiture(
      {
        depositAmountMinor: Number(row.amount_minor),
        alreadyAppliedMinor: Number(body.alreadyAppliedMinor ?? 0),
        cancelledOn: String(body.cancelledOn ?? ''),
        asOf: String(body.asOf ?? new Date().toISOString().slice(0, 10)),
        reason: typeof body.reason === 'string' ? body.reason : null,
      },
      { ...DEFAULT_DEPOSIT_FORFEITURE_POLICY, ...(body.policy ?? {}) },
    )
    return { __status: 200, __data: decision }
  })

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
          AND COALESCE(source_type, 'sales_order') <> 'pre_purchase'
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
    const supplierId = typeof raw.supplierId === 'string' ? raw.supplierId.trim() : ''
    const amountMinor = Number(raw.amountMinor)
    // A receipt is for a customer (an order deposit) or for a supplier (an
    // advance paid before the goods). The KIND names the party; neither id is
    // ever a stand-in for the other.
    const sourceType =
      raw.sourceType === 'service_session' ||
      raw.sourceType === 'pre_sale' ||
      raw.sourceType === 'pre_purchase'
        ? raw.sourceType
        : 'sales_order'
    const isSupplierAdvance = sourceType === 'pre_purchase'
    if (isSupplierAdvance) {
      if (!supplierId) throw new ValidationError('supplierId is required')
      if (customerId) throw new ValidationError('ADVANCE_PARTY_CONFLICT')
    } else if (!customerId) {
      throw new ValidationError('customerId is required')
    }
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
    const now = nowIso()

    return db.transaction(() => {
      db.run(
        `INSERT INTO order_deposits
           (id, workspace_id, order_id, customer_id, supplier_id, source_type, amount_minor,
            payment_method, currency, posting_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          id,
          ctx.workspaceId,
          orderId,
          isSupplierAdvance ? null : customerId,
          isSupplierAdvance ? supplierId : null,
          sourceType,
          amountMinor,
          paymentMethod,
          currency,
          now,
          now,
        ],
      )

      // The receipt books Dr cash|bank / Cr customer advances, exactly as the
      // server does. A chart of accounts that cannot express it leaves the
      // deposit at `pending_posting` — an explicit, recoverable state that the
      // screen reports and `POST …/post` fixes.
      const digits = ledgerFractionDigitsOf(currency)
      const major = digits === null ? null : ledgerAmountOf(amountMinor, digits)
      const role: AccountRole = paymentMethod === 'bank' ? 'bank' : 'cash'
      const advanceRole: AccountRole = isSupplierAdvance ? 'supplier_advances' : 'customer_advances'
      let journalEntryId: string | null = null
      if (major !== null) {
        const { accounts, missing } = ensureAccountsForRoles(db, ctx.workspaceId, [
          role,
          advanceRole,
        ])
        const debitAccount = accounts[role]
        const advanceAccount = accounts[advanceRole]
        if (missing.length === 0 && debitAccount && advanceAccount) {
          const outcome = postDocument(db, ctx, {
            sourceType: 'order_deposit',
            sourceId: id,
            date,
            description: isSupplierAdvance
              ? `پیش‌پرداخت تأمین‌کننده ${supplierId}`
              : `بیعانه سفارش ${orderId}`,
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
          ...(isSupplierAdvance ? { supplierId } : { customerId }),
          amountMinor,
          paymentMethod,
          date,
          sourceType,
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
    // The party must be real before a receipt is (re)booked under its name.
    partyOf(deposit)
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
      const journalEntryId = postMovement(c, {
        sourceType: 'order_deposit',
        sourceId: deposit.id,
        date,
        description:
          sideOf(deposit) === 'supplier'
            ? `پیش‌پرداخت تأمین‌کننده ${partyOf(deposit)}`
            : `بیعانه سفارش ${deposit.order_id}`,
        reference: deposit.order_id,
        branches: null,
        advanceRole: advancesRoleOf(deposit),
        advancesOnDebit: true,
        otherRole: role,
        amount: major,
      })
      db.run(
        `UPDATE order_deposits
            SET posting_status = 'posted', journal_entry_id = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [journalEntryId, now, deposit.id, ctx.workspaceId],
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
    const side = sideOf(deposit)
    // Resolved before anything is written: an unresolved advance must not book
    // half a settlement under a party the device had to guess.
    const partyId = partyOf(deposit)
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
      // ⚠️ A PULLED DEPOSIT WAS BOOKED ON THE SERVER, NOT HERE. The device's
      // journal holds no entry for it, but `posting_status = 'posted'` is the
      // server's own statement that the receipt exists in the books. Only a row
      // that is neither booked locally nor marked posted is refused — a NULL
      // status is a row older than the column, and its receipt is unknown.
      const receipt = db.get<{ id: string }>(
        `SELECT id FROM journal_entry
          WHERE workspace_id = ? AND source_type = 'order_deposit' AND source_id = ?
            AND status = 'posted' AND deleted_at IS NULL`,
        [ctx.workspaceId, deposit.id],
      )
      if (!receipt && deposit.posting_status !== 'posted') {
        throw new ConflictError('DEPOSIT_NOT_BOOKED', 'DEPOSIT_NOT_BOOKED')
      }

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

      // 1. The settlement IS a payment: a supplier advance settles a purchase
      //    with money OUT, a customer deposit settles a sale with money already
      //    IN — and one allocation, the same rows `payments_record` writes
      //    server-side.
      const paymentId = generateUuid()
      const direction = side === 'supplier' ? 'out' : 'in'
      const count = db.get<{ count: number }>(
        'SELECT count(*) AS count FROM payment WHERE workspace_id = ? AND direction = ?',
        [ctx.workspaceId, direction],
      )
      const paymentNumber = `${side === 'supplier' ? 'VCH' : 'RCT'}-${String(
        (count?.count ?? 0) + 1,
      ).padStart(5, '0')}`
      db.run(
        `INSERT INTO payment (
           id, workspace_id, payment_number, direction, party_type, party_id,
           amount, currency, method, entry_date, reference, notes, status,
           created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted',
                   ?, ?, 'local', 'local_only')`,
        [
          paymentId,
          ctx.workspaceId,
          paymentNumber,
          direction,
          side === 'supplier' ? 'supplier' : 'customer',
          partyId,
          major,
          deposit.currency,
          side === 'supplier' ? 'supplier_advance' : 'order_deposit',
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

      // 2. Customer: Dr customer advances / Cr receivable — credited what the
      //    invoice is owed, debited the liability we held.
      //    Supplier: Dr payable / Cr supplier advances — the payable the
      //    purchase created is settled by money that already left.
      const journalEntryId = postMovement(c, {
        sourceType: 'payment',
        sourceId: paymentId,
        date,
        description:
          side === 'supplier'
            ? `تطبیق پیش‌پرداخت با فاکتور خرید ${invoice.id}`
            : `تطبیق بیعانه سفارش با فاکتور ${invoice.id}`,
        reference: paymentNumber,
        branches: invoice.branch_id,
        advanceRole: advancesRoleOf(deposit),
        advancesOnDebit: side === 'customer',
        otherRole: side === 'supplier' ? 'payable' : 'receivable',
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
    const side = sideOf(deposit)
    const partyId = partyOf(deposit)
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
      // The same rule as an application: a pulled deposit says `posted` because
      // the SERVER booked its receipt; only an unknown/pending receipt refuses.
      if (!receipt && deposit.posting_status !== 'posted') {
        throw new ConflictError('DEPOSIT_REFUND_NOT_POSTED', 'DEPOSIT_REFUND_NOT_POSTED')
      }

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
      //    advance, it does not settle anything. The supplier side is the
      //    mirror — the supplier returns money, which comes back IN.
      const paymentId = generateUuid()
      const direction = side === 'supplier' ? 'in' : 'out'
      const count = db.get<{ count: number }>(
        'SELECT count(*) AS count FROM payment WHERE workspace_id = ? AND direction = ?',
        [ctx.workspaceId, direction],
      )
      const paymentNumber = `${side === 'supplier' ? 'RCT' : 'VCH'}-${String(
        (count?.count ?? 0) + 1,
      ).padStart(5, '0')}`
      db.run(
        `INSERT INTO payment (
           id, workspace_id, payment_number, direction, party_type, party_id,
           amount, currency, method, entry_date, reference, notes, status,
           created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted',
                   ?, ?, 'local', 'local_only')`,
        [
          paymentId,
          ctx.workspaceId,
          paymentNumber,
          direction,
          side === 'supplier' ? 'supplier' : 'customer',
          partyId,
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

      // 2. Customer: Dr customer advances / Cr cash | bank.
      //    Supplier: Dr cash | bank / Cr supplier advances — the asset comes
      //    back, it is not credited as a liability.
      const journalEntryId = postMovement(c, {
        sourceType: 'payment',
        sourceId: paymentId,
        date,
        description:
          side === 'supplier'
            ? `بازگرداندن پیش‌پرداخت تأمین‌کننده ${deposit.order_id}`
            : `بازگرداندن بیعانه سفارش ${deposit.order_id}`,
        reference: paymentNumber,
        branches: null,
        advanceRole: advancesRoleOf(deposit),
        advancesOnDebit: side === 'customer',
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
