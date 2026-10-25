// ============================================
// packages/local-engine/src/routes/till.ts
//
// The till (POS) on the device: open a drawer, take orders, move cash, count,
// close and book it.
//
// NO RULE LIVES HERE. What a drawer should hold, whether an order/movement/close
// is allowed, the abandoned-session rule (`pos.domain`) and how rows become a
// session, an order or a movement, what is frozen at the close, which ledger
// lines a closed session books and how a day's cash flow is assembled
// (`till-view`) are @hisabche/validation — the very functions the server's
// `PosService` calls. This file reads SQLite rows into them and writes the
// answer back.
//
// ⚠️ THE ORDER RECORDS THE TILL'S FACTS, NOT A SALE. The invoice is made by the
// invoice route (`POST /invoices`); an order only says «this invoice was paid
// at this drawer, in these methods». `orderRef` is made once on the device and
// is unique, so a retried order returns the one that exists.
// ⚠️ VOIDED, NEVER DELETED. A closed till is never touched. An EMPTY till can be
// removed; one that saw money is CLOSED.
// ============================================

import {
  attachDrawerMargins,
  buildCashFlowView,
  buildDrawerLedger,
  buildPosting,
  cashFlowSince,
  checkSuspendChange,
  closeColumns,
  currencyCodeSchema,
  findAbandoned,
  invoiceMargins,
  OPENING_CAPITAL_REASON,
  openingCapitalLines,
  SESSION_POSTING_ROLES,
  sessionPostingLines,
  summarise,
  tillMinorToMajor,
  TILL_TRANSFER_DESCRIPTION,
  toCashMovement,
  toCashSettlement,
  toPosOrder,
  toPosSession,
  toShiftHistoryRow,
  transferLines,
  validateClose,
  validateMovement,
  validateOrder,
  type CashMovement,
  type CashSettlement,
  type PosOrder,
  type PosSession,
  type SessionStatus,
} from '@hisabche/validation'
import { z } from 'zod'
import type { LocalDb } from '../db'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { LocalContext, RouteHandlerContext } from '../types'
import { derivedId } from './derived-id'
import { ensureAccountsForRoles, postDocument } from './local-ledger'
import { profitSourcesForInvoice } from './report-sources'

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : derivedId('local', 'id', String(Date.now()), String(Math.random()))

const nowIso = () => new Date().toISOString()

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new ValidationError(result.error.errors[0]?.message ?? 'Validation failed')
  }
  return result.data
}

const isUnique = (error: unknown) =>
  /UNIQUE/i.test(error instanceof Error ? error.message : String(error))

// ─── Reads ───────────────────────────────────────────────────────────────────

type SessionRow = Record<string, unknown>

function sessionRow(db: LocalDb, ctx: LocalContext, id: string): SessionRow | undefined {
  return db.get<SessionRow>('SELECT * FROM pos_session WHERE workspace_id = ? AND id = ?', [
    ctx.workspaceId,
    id,
  ])
}

function getSession(db: LocalDb, ctx: LocalContext, id: string): PosSession {
  const row = sessionRow(db, ctx, id)
  if (!row) throw new NotFoundError('Till session')
  return toPosSession(row, ctx.baseCurrency)
}

function loadOrders(db: LocalDb, ctx: LocalContext, sessionId: string): PosOrder[] {
  const orders = db.all<Record<string, unknown>>(
    `SELECT id, order_ref, total_minor, change_minor, status, created_at
     FROM pos_order WHERE workspace_id = ? AND session_id = ? ORDER BY id ASC`,
    [ctx.workspaceId, sessionId],
  )
  return orders.map((order) =>
    toPosOrder({
      ...order,
      payments: db.all(
        'SELECT method, amount_minor FROM pos_order_payment WHERE workspace_id = ? AND order_id = ?',
        [ctx.workspaceId, order.id],
      ),
    }),
  )
}

function loadMovements(db: LocalDb, ctx: LocalContext, sessionId: string): CashMovement[] {
  return db
    .all<Record<string, unknown>>(
      `SELECT id, kind, amount_minor, reason, created_at
       FROM pos_cash_movement WHERE workspace_id = ? AND session_id = ? ORDER BY id ASC`,
      [ctx.workspaceId, sessionId],
    )
    .map(toCashMovement)
}

/** The cash payments of THIS till: the ones that NAME it (payment.pos_session_id). */
function loadSettlements(db: LocalDb, ctx: LocalContext, sessionId: string): CashSettlement[] {
  return db
    .all<Record<string, unknown>>(
      `SELECT id, payment_number, direction, till_amount_minor, created_at
       FROM payment
       WHERE workspace_id = ? AND pos_session_id = ? AND status = 'posted' AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC`,
      [ctx.workspaceId, sessionId],
    )
    .map(toCashSettlement)
}

function loadContents(db: LocalDb, ctx: LocalContext, sessionId: string) {
  return {
    orders: loadOrders(db, ctx, sessionId),
    movements: loadMovements(db, ctx, sessionId),
    settlements: loadSettlements(db, ctx, sessionId),
  }
}

function totalsOf(db: LocalDb, ctx: LocalContext, session: PosSession) {
  const { orders, movements, settlements } = loadContents(db, ctx, session.id)
  return summarise(session, orders, movements, settlements)
}

/** The open tills of the person, oldest first. */
function openSessionsOf(db: LocalDb, ctx: LocalContext): PosSession[] {
  return db
    .all<SessionRow>(
      `SELECT * FROM pos_session
       WHERE workspace_id = ? AND opened_by = ? AND status = 'open'
       ORDER BY opened_at ASC LIMIT 50`,
      [ctx.workspaceId, ctx.userId],
    )
    .map((row) => toPosSession(row, ctx.baseCurrency))
}

function abandoned(
  db: LocalDb,
  ctx: LocalContext,
  staleAfterHours: number,
  statuses: SessionStatus[],
) {
  const rows = db.all<SessionRow>(
    `SELECT * FROM pos_session WHERE workspace_id = ? AND status IN (${statuses
      .map(() => '?')
      .join(', ')}) LIMIT 200`,
    [ctx.workspaceId, ...statuses],
  )
  const sessions = rows.map((row) => {
    const session = toPosSession(row, ctx.baseCurrency)
    return { session, ...loadContents(db, ctx, session.id) }
  })
  return findAbandoned(sessions, nowIso(), staleAfterHours)
}

// ─── Schemas (the server's, field for field) ─────────────────────────────────

const openSchema = z.object({
  openingFloatMinor: z.number().int().min(0),
  branchId: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1).max(80).nullable().optional(),
  currency: currencyCodeSchema.optional(),
})

const orderSchema = z.object({
  /** Generated on the device, stable across retries. The idempotency key. */
  orderRef: z.string().min(4).max(80),
  totalMinor: z.number().int(),
  changeMinor: z.number().int().min(0).default(0),
  invoiceId: z.string().uuid().nullable().optional(),
  currency: currencyCodeSchema.optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['cash', 'card', 'transfer', 'credit', 'other']),
        amountMinor: z.number().int(),
      }),
    )
    .min(1),
})

const movementSchema = z.object({
  kind: z.enum(['cash_in', 'cash_out']),
  amountMinor: z.number().int().positive(),
  reason: z.string().min(1).max(300),
  movementId: z.string().uuid().optional(),
  currency: currencyCodeSchema.optional(),
})

const closeSchema = z.object({
  countedCashMinor: z.number().int().min(0),
  varianceReason: z.string().max(500).optional(),
  force: z.boolean().optional(),
})

const ok = (data: unknown, status = 200) => ({ __status: status, __data: data })

export function registerTillRoutes(router: Router): void {
  // ─── Reads (the literal paths first: `current`, `history`, … are not ids) ──
  router.get('/pos/sessions/current', ({ db, ctx, query }: RouteHandlerContext) => {
    const { currency } = parse(z.object({ currency: currencyCodeSchema.optional() }), query)
    const sessions = openSessionsOf(db, ctx)
    // Asked for a currency: that till or none. Not asked: the books-currency
    // till; failing that, the oldest.
    const wanted = currency ?? ctx.baseCurrency
    const match = sessions.find((session) => session.currency === wanted)
    const session = match ?? (currency ? null : (sessions[0] ?? null))
    if (!session) return { session: null }
    return { session, totals: totalsOf(db, ctx, session) }
  })

  router.get('/pos/sessions/history', ({ db, ctx, query }: RouteHandlerContext) => {
    const limit = Math.min(Number(query.limit) || 50, 200)
    return db
      .all<SessionRow>(
        `SELECT * FROM pos_session
         WHERE workspace_id = ? AND status IN ('closed', 'force_closed')
         ORDER BY closed_at DESC LIMIT ?`,
        [ctx.workspaceId, limit],
      )
      .map(toShiftHistoryRow)
  })

  router.get('/pos/sessions/open', ({ db, ctx }: RouteHandlerContext) =>
    abandoned(db, ctx, 0, ['open', 'suspended']),
  )

  router.get('/pos/sessions/abandoned', ({ db, ctx, query }: RouteHandlerContext) =>
    abandoned(db, ctx, Number(query.hours) || 24, ['open']),
  )

  router.get('/pos/sessions/labels', ({ db, ctx }: RouteHandlerContext) => {
    const labels: Record<string, string> = {}
    for (const row of db.all<{ id: string; label: string }>(
      `SELECT id, label FROM pos_session
       WHERE workspace_id = ? AND status IN ('open', 'suspended', 'closing') AND label IS NOT NULL`,
      [ctx.workspaceId],
    )) {
      labels[row.id] = row.label
    }
    return { configured: true, labels }
  })

  router.get('/pos/sessions/:id', ({ db, ctx, params }: RouteHandlerContext) => {
    const session = getSession(db, ctx, params.id ?? '')
    return { session, totals: totalsOf(db, ctx, session) }
  })

  router.get('/pos/cash-flow', ({ db, ctx, query }: RouteHandlerContext) => {
    const parsed = parse(
      z.object({
        days: z.coerce
          .number()
          .int()
          .refine((d) => d === 7 || d === 30 || d === 90)
          .default(7),
        offsetMinutes: z.coerce.number().int().min(-720).max(840).default(270),
        currency: currencyCodeSchema.optional(),
      }),
      query,
    )
    const booksCurrency = ctx.baseCurrency
    const since = cashFlowSince(parsed.days, parsed.offsetMinutes)
    const sessionCurrencies = new Map(
      db
        .all<{ id: string; currency: string | null }>(
          'SELECT id, currency FROM pos_session WHERE workspace_id = ?',
          [ctx.workspaceId],
        )
        .map((row) => [row.id, row.currency ?? booksCurrency]),
    )
    const orders = db
      .all<Record<string, unknown>>(
        `SELECT id, session_id, change_minor, status, created_at FROM pos_order
         WHERE workspace_id = ? AND status = 'completed' AND created_at >= ?`,
        [ctx.workspaceId, since],
      )
      .map((order) => ({
        ...order,
        payments: db.all('SELECT method, amount_minor FROM pos_order_payment WHERE order_id = ?', [
          order.id,
        ]),
      }))
    return buildCashFlowView({
      payments: db.all<Record<string, unknown>>(
        `SELECT id, direction, amount, currency, created_at FROM payment
         WHERE workspace_id = ? AND method = 'cash' AND status = 'posted' AND deleted_at IS NULL
           AND created_at >= ?`,
        [ctx.workspaceId, since],
      ),
      movements: db.all<Record<string, unknown>>(
        `SELECT id, session_id, kind, amount_minor, created_at FROM pos_cash_movement
         WHERE workspace_id = ? AND created_at >= ?`,
        [ctx.workspaceId, since],
      ),
      orders,
      sessionCurrencies,
      booksCurrency,
      targetCurrency: parsed.currency ?? booksCurrency,
      days: parsed.days,
      offsetMinutes: parsed.offsetMinutes,
    })
  })

  router.get('/pos/sessions/:id/ledger', ({ db, ctx, params }: RouteHandlerContext) => {
    const session = getSession(db, ctx, params.id ?? '')
    const { orders, movements, settlements } = loadContents(db, ctx, session.id)
    const drawer = buildDrawerLedger(session, orders, movements, settlements)

    // Profit % of each cash receipt, through the accounting core's invoice margins.
    const receiptIds = drawer.entries
      .filter((entry) => entry.kind === 'settlement_in' && entry.sourceId)
      .map((entry) => entry.sourceId as string)
    if (receiptIds.length === 0) return drawer

    const invoicesByPayment = new Map<string, string[]>()
    for (const row of db.all<{ payment_id: string; invoice_id: string }>(
      `SELECT payment_id, invoice_id FROM payment_allocation
       WHERE workspace_id = ? AND payment_id IN (${receiptIds.map(() => '?').join(', ')})`,
      [ctx.workspaceId, ...receiptIds],
    )) {
      invoicesByPayment.set(row.payment_id, [
        ...(invoicesByPayment.get(row.payment_id) ?? []),
        row.invoice_id,
      ])
    }
    const margins = new Map<string, { revenue: number; cost: number; costMissing: boolean }>()
    for (const invoiceId of new Set([...invoicesByPayment.values()].flat())) {
      const sources = profitSourcesForInvoice(db, ctx.workspaceId, invoiceId, ctx.baseCurrency)
      for (const [id, margin] of invoiceMargins(
        sources.invoices,
        sources.lines,
        sources.consumptions,
      )) {
        margins.set(id, margin)
      }
    }
    return attachDrawerMargins(drawer, invoicesByPayment, margins)
  })

  // ─── Open ──────────────────────────────────────────────────
  router.post('/pos/sessions', ({ db, ctx, body }: RouteHandlerContext) => {
    const input = parse(openSchema, body ?? {})
    const booksCurrency = ctx.baseCurrency
    const targetCurrency = input.currency ? input.currency.toUpperCase() : booksCurrency
    const label = input.label?.trim() ? input.label.trim() : null
    if (label !== null && label.length > 80) throw new ValidationError('POS_LABEL_INVALID')

    const id = newId()
    const now = nowIso()
    try {
      db.run(
        `INSERT INTO pos_session
           (id, workspace_id, branch_id, status, currency, label, opening_float_minor,
            opened_at, opened_by, created_at, updated_at)
         VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.workspaceId,
          input.branchId ?? null,
          // NULL = the books currency: writing the code here would let one person
          // hold two open books-currency tills (the index compares NULL and 'AFN').
          targetCurrency === booksCurrency ? null : targetCurrency,
          label,
          input.openingFloatMinor,
          now,
          ctx.userId,
          now,
          now,
        ],
      )
    } catch (error) {
      if (isUnique(error)) throw new ConflictError('POS_SESSION_ALREADY_OPEN')
      throw error
    }
    return { ...getSession(db, ctx, id), currency: targetCurrency }
  })

  // ─── Orders ────────────────────────────────────────────────
  router.post('/pos/sessions/:id/orders', ({ db, ctx, params, body }: RouteHandlerContext) => {
    const sessionId = params.id ?? ''
    const input = parse(orderSchema, body ?? {})
    const session = getSession(db, ctx, sessionId)

    const problems = validateOrder(session, input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    if (input.invoiceId) {
      const invoice = db.get<{ currency: string | null }>(
        'SELECT currency FROM invoice WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL',
        [ctx.workspaceId, input.invoiceId],
      )
      if (!invoice) throw new NotFoundError('Invoice')
      const invoiceCurrency = invoice.currency ?? ctx.baseCurrency
      if (invoiceCurrency !== (session.currency ?? ctx.baseCurrency)) {
        throw new ValidationError('POS_CURRENCY_MISMATCH')
      }
    }

    const orderId = db.transaction(() => {
      // Re-checked inside the write: a close that landed since the read above
      // must not let the order join a session that has already posted.
      const status = db.get<{ status: string }>(
        'SELECT status FROM pos_session WHERE workspace_id = ? AND id = ?',
        [ctx.workspaceId, sessionId],
      )?.status
      if (status === undefined) throw new ConflictError('POS_SESSION_NOT_FOUND')
      if (status !== 'open') throw new ConflictError('POS_SESSION_NOT_OPEN')

      // Already taken: hand back what exists — the device is retrying something that worked.
      const existing = db.get<{ id: string }>(
        'SELECT id FROM pos_order WHERE workspace_id = ? AND order_ref = ?',
        [ctx.workspaceId, input.orderRef],
      )
      if (existing) return existing.id

      const id = newId()
      db.run(
        `INSERT INTO pos_order
           (id, workspace_id, session_id, order_ref, invoice_id, total_minor, change_minor,
            status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [
          id,
          ctx.workspaceId,
          sessionId,
          input.orderRef,
          input.invoiceId ?? null,
          input.totalMinor,
          input.changeMinor,
          nowIso(),
        ],
      )
      for (const payment of input.payments) {
        db.run(
          `INSERT INTO pos_order_payment (id, workspace_id, order_id, method, amount_minor)
           VALUES (?, ?, ?, ?, ?)`,
          [newId(), ctx.workspaceId, id, payment.method, payment.amountMinor],
        )
      }
      return id
    })

    return loadOrders(db, ctx, sessionId).find((order) => order.id === orderId)
  })

  router.post('/pos/orders/:id/void', ({ db, ctx, params }: RouteHandlerContext) => {
    const orderId = params.id ?? ''
    const order = db.get<{ session_id: string; status: string }>(
      'SELECT session_id, status FROM pos_order WHERE workspace_id = ? AND id = ?',
      [ctx.workspaceId, orderId],
    )
    if (!order) throw new NotFoundError('PosOrder')
    // Voiding twice is one void, not an error.
    if (order.status === 'voided') return ok({ voided: orderId })

    // ONLY WHILE THE TILL IS OPEN: a closed till has been counted and its totals posted.
    const session = getSession(db, ctx, order.session_id)
    if (session.status !== 'open' && session.status !== 'suspended') {
      throw new ConflictError('POS_SESSION_NOT_OPEN')
    }
    db.run(
      `UPDATE pos_order SET status = 'voided'
       WHERE workspace_id = ? AND id = ? AND status = 'completed'`,
      [ctx.workspaceId, orderId],
    )
    return ok({ voided: orderId })
  })

  // ─── Cash ──────────────────────────────────────────────────
  router.post('/pos/sessions/:id/cash', ({ db, ctx, params, body }: RouteHandlerContext) => {
    const sessionId = params.id ?? ''
    const input = parse(movementSchema, body ?? {})
    const session = getSession(db, ctx, sessionId)
    const problems = validateMovement(session, input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const id = input.movementId ?? newId()
    try {
      db.run(
        `INSERT INTO pos_cash_movement
           (id, workspace_id, session_id, kind, amount_minor, reason, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.workspaceId,
          sessionId,
          input.kind,
          input.amountMinor,
          input.reason,
          ctx.userId,
          nowIso(),
        ],
      )
    } catch (error) {
      // The same key again: this movement is already in the drawer — answer with it,
      // scoped to this workspace and session so a key cannot read another's.
      if (isUnique(error) && input.movementId) {
        const existing = loadMovements(db, ctx, sessionId).find((m) => m.id === input.movementId)
        if (!existing) throw new ConflictError('POS_MOVEMENT_ID_TAKEN')
        return existing
      }
      throw error
    }
    return loadMovements(db, ctx, sessionId).find((m) => m.id === id)
  })

  router.post(
    '/pos/sessions/:id/bank-transfer',
    ({ db, ctx, params, body }: RouteHandlerContext) => {
      const sessionId = params.id ?? ''
      const input = parse(
        z.object({
          transferId: z.string().uuid(),
          direction: z.enum(['to_bank', 'from_bank']),
          amountMinor: z.number().int().positive(),
          reason: z.string().trim().min(1).max(500),
        }),
        body ?? {},
      )
      const session = getSession(db, ctx, sessionId)
      const problems = validateMovement(session, input)
      if (problems.length > 0) throw new ValidationError(problems.join(', '))

      return db.transaction(() => {
        if (input.direction === 'to_bank') {
          // The drawer cannot send more than it should hold.
          const { orders, movements, settlements } = loadContents(db, ctx, sessionId)
          const expected = summarise(session, orders, movements, settlements).expectedCashMinor
          const alreadyThis = movements.some((m) => m.id === input.transferId)
          if (!alreadyThis && input.amountMinor > expected) {
            throw new ValidationError('POS_TRANSFER_EXCEEDS_CASH')
          }
        }

        const { accounts, missing } = ensureAccountsForRoles(db, ctx.workspaceId, ['cash', 'bank'])
        if (missing.length > 0 || !accounts.cash || !accounts.bank) {
          throw new ValidationError(`POS_TRANSFER_ACCOUNTS_MISSING: ${missing.join(', ')}`)
        }
        const amount = tillMinorToMajor(input.amountMinor, session.currency ?? ctx.baseCurrency)
        const outcome = postDocument(db, ctx, {
          sourceType: 'till_transfer',
          sourceId: input.transferId,
          date: nowIso().slice(0, 10),
          description: TILL_TRANSFER_DESCRIPTION[input.direction],
          reference: input.reason.trim().slice(0, 200),
          lines: transferLines(
            input.direction,
            { cash: accounts.cash, bank: accounts.bank },
            amount,
          ),
        })
        if (outcome.status === 'skipped') {
          throw new ValidationError(`POS_TRANSFER_ACCOUNTS_MISSING: ${outcome.missing.join(', ')}`)
        }

        db.run(
          `INSERT OR IGNORE INTO pos_cash_movement
             (id, workspace_id, session_id, kind, amount_minor, reason, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.transferId,
            ctx.workspaceId,
            sessionId,
            input.direction === 'to_bank' ? 'transfer_to_bank' : 'transfer_from_bank',
            input.amountMinor,
            input.reason.trim(),
            ctx.userId,
            nowIso(),
          ],
        )
        return {
          transferId: input.transferId,
          entryId: outcome.entryId,
          alreadyRecorded: outcome.status === 'already_posted',
        }
      })
    },
  )

  router.post('/pos/opening-capital', ({ db, ctx, body }: RouteHandlerContext) => {
    const input = parse(
      z.object({
        entryId: z.string().uuid(),
        amountMinor: z.number().int().positive(),
        into: z.enum(['till', 'bank']),
        sessionId: z.string().uuid().optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
      body ?? {},
    )
    const reason = OPENING_CAPITAL_REASON

    if (input.into === 'till') {
      if (!input.sessionId) throw new ValidationError('OPENING_CAPITAL_TILL_REQUIRED')
      const session = getSession(db, ctx, input.sessionId)
      const problems = validateMovement(session, { amountMinor: input.amountMinor, reason })
      if (problems.length > 0) throw new ValidationError(problems.join(', '))
      // The ledger is in the books currency and there is no rate here to convert with.
      if ((session.currency ?? ctx.baseCurrency) !== ctx.baseCurrency) {
        throw new ValidationError('OPENING_CAPITAL_TILL_CURRENCY')
      }
    }

    return db.transaction(() => {
      const asset = input.into === 'till' ? ('cash' as const) : ('bank' as const)
      const { accounts } = ensureAccountsForRoles(db, ctx.workspaceId, [asset, 'owner_capital'])
      const assetAccount = accounts[asset]
      const capitalAccount = accounts.owner_capital
      if (!assetAccount || !capitalAccount)
        throw new ConflictError('OPENING_CAPITAL_NOT_CONFIGURED')

      const outcome = postDocument(db, ctx, {
        sourceType: 'opening_capital',
        sourceId: input.entryId,
        date: (input.date ?? nowIso()).slice(0, 10),
        description: reason,
        reference: reason,
        lines: openingCapitalLines(
          assetAccount,
          capitalAccount,
          tillMinorToMajor(input.amountMinor, ctx.baseCurrency),
        ),
      })
      if (outcome.status === 'skipped') throw new ConflictError('OPENING_CAPITAL_NOT_CONFIGURED')

      if (input.into === 'till' && input.sessionId) {
        db.run(
          `INSERT OR IGNORE INTO pos_cash_movement
             (id, workspace_id, session_id, kind, amount_minor, reason, created_by, created_at)
           VALUES (?, ?, ?, 'opening_capital', ?, ?, ?, ?)`,
          [
            input.entryId,
            ctx.workspaceId,
            input.sessionId,
            input.amountMinor,
            reason,
            ctx.userId,
            nowIso(),
          ],
        )
      }
      return {
        entryId: input.entryId,
        journalEntryId: outcome.entryId,
        alreadyRecorded: outcome.status === 'already_posted',
      }
    })
  })

  // ─── Close ─────────────────────────────────────────────────
  router.post('/pos/sessions/:id/close', ({ db, ctx, params, body }: RouteHandlerContext) => {
    const sessionId = params.id ?? ''
    const input = parse(closeSchema, body ?? {})
    const session = getSession(db, ctx, sessionId)
    const { orders, movements, settlements } = loadContents(db, ctx, sessionId)
    const totals = summarise(session, orders, movements, settlements)

    const problems = validateClose(session, totals, { ...input, role: ctx.role })
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const closed: PosSession = { ...session, countedCashMinor: input.countedCashMinor }
    const finalTotals = summarise(closed, orders, movements, settlements)
    const columns = closeColumns({
      finalTotals,
      countedCashMinor: input.countedCashMinor,
      varianceReason: input.varianceReason,
      force: input.force,
      closedAt: nowIso(),
      closedBy: ctx.userId,
    })

    const isForeign = Boolean(session.currency && session.currency !== ctx.baseCurrency)

    return db.transaction(() => {
      // Only an OPEN (or suspended) session closes: two devices closing at once
      // means the second finds nothing to update rather than posting twice.
      const result = db.run(
        `UPDATE pos_session SET
           status = ?, counted_cash_minor = ?, variance_reason = ?, closed_at = ?, closed_by = ?,
           was_forced = ?, expected_cash_minor = ?, cash_sales_minor = ?, cash_in_minor = ?,
           cash_out_minor = ?, variance_minor = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND status IN ('open', 'closing', 'suspended')`,
        [
          columns.status,
          columns.counted_cash_minor,
          columns.variance_reason,
          columns.closed_at,
          columns.closed_by,
          columns.was_forced ? 1 : 0,
          columns.expected_cash_minor,
          columns.cash_sales_minor,
          columns.cash_in_minor,
          columns.cash_out_minor,
          columns.variance_minor,
          columns.closed_at,
          ctx.workspaceId,
          sessionId,
        ],
      )
      if (result.changes === 0) throw new ConflictError('POS_SESSION_NOT_OPEN')

      let posted = false
      let ledgerResult: { status: string; reason?: string }
      if (isForeign) {
        ledgerResult = { status: 'not_posted', reason: 'POS_FOREIGN_CURRENCY_NOT_IN_LEDGER' }
      } else {
        const posting = buildPosting(closed, finalTotals)
        const { accounts, missing } = ensureAccountsForRoles(
          db,
          ctx.workspaceId,
          SESSION_POSTING_ROLES,
        )
        const booked = sessionPostingLines({
          posting,
          tillCurrency: session.currency ?? ctx.baseCurrency,
          accounts,
          missing,
        })
        if (!('required' in booked)) {
          const outcome = postDocument(db, ctx, {
            sourceType: 'pos_session',
            sourceId: sessionId,
            date: nowIso().slice(0, 10),
            description: `بستن صندوق ${sessionId.slice(0, 8)}`,
            reference: sessionId,
            lines: booked.lines,
          })
          if (outcome.status !== 'skipped') {
            db.run(
              'UPDATE pos_session SET journal_entry_id = ? WHERE workspace_id = ? AND id = ?',
              [outcome.entryId, ctx.workspaceId, sessionId],
            )
            posted = true
          }
        }
        ledgerResult = { status: posted ? 'posted' : 'not_posted' }
      }

      return ok({
        session: getSession(db, ctx, sessionId),
        totals: finalTotals,
        posted,
        ledger: ledgerResult,
      })
    })
  })

  // ─── Suspend / resume / name / remove ──────────────────────
  const setSuspended =
    (suspended: boolean) =>
    ({ db, ctx, params }: RouteHandlerContext) => {
      const sessionId = params.id ?? ''
      const session = getSession(db, ctx, sessionId)
      const refusal = checkSuspendChange(session.status, suspended ? 'suspended' : 'open')
      if (refusal) throw new ConflictError(refusal)
      try {
        const result = db.run(
          `UPDATE pos_session SET status = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ? AND status = ?`,
          [suspended ? 'suspended' : 'open', nowIso(), ctx.workspaceId, sessionId, session.status],
        )
        if (result.changes === 0) {
          throw new ConflictError(suspended ? 'POS_SESSION_NOT_OPEN' : 'POS_SESSION_NOT_SUSPENDED')
        }
      } catch (error) {
        // Resuming while this person already has another open till here.
        if (isUnique(error)) throw new ConflictError('POS_SESSION_ALREADY_OPEN')
        throw error
      }
      return ok(getSession(db, ctx, sessionId))
    }
  router.post('/pos/sessions/:id/suspend', setSuspended(true))
  router.post('/pos/sessions/:id/resume', setSuspended(false))

  router.patch('/pos/sessions/:id/label', ({ db, ctx, params, body }: RouteHandlerContext) => {
    const sessionId = params.id ?? ''
    const { label } = parse(
      z.object({ label: z.string().trim().min(1).max(80).nullable() }).strict(),
      body ?? {},
    )
    // Scoped to the workspace: another business's till answers «not found».
    getSession(db, ctx, sessionId)
    db.run('UPDATE pos_session SET label = ?, updated_at = ? WHERE workspace_id = ? AND id = ?', [
      label,
      nowIso(),
      ctx.workspaceId,
      sessionId,
    ])
    return { id: sessionId, label }
  })

  router.delete('/pos/sessions/:id', ({ db, ctx, params }: RouteHandlerContext) => {
    const sessionId = params.id ?? ''
    const session = getSession(db, ctx, sessionId)
    if (session.status !== 'open' && session.status !== 'suspended') {
      throw new ConflictError('POS_SESSION_IN_USE')
    }
    // ONLY AN EMPTY ONE: a till that saw money is CLOSED, never removed.
    const contents = loadContents(db, ctx, sessionId)
    if (
      contents.orders.length > 0 ||
      contents.movements.length > 0 ||
      contents.settlements.length > 0
    ) {
      throw new ConflictError('POS_SESSION_IN_USE')
    }
    const result = db.run(
      `DELETE FROM pos_session WHERE workspace_id = ? AND id = ? AND status IN ('open', 'suspended')`,
      [ctx.workspaceId, sessionId],
    )
    if (result.changes === 0) throw new ConflictError('POS_SESSION_IN_USE')
    return { id: sessionId }
  })
}
