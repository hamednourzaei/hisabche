// ============================================
// packages/local-engine/src/routes/payments.ts
//
// Payments and settlement engine.
// Enforces currency matching on allocation (settlesInCurrency).
// Updates invoice paid_amount and settlement status atomically.
// Posts cash/receivable/exchange-difference ledger entries via paymentPosting.
// ============================================

import {
  buildOpenInvoicesView,
  buildPartyActivity,
  buildCustomerAccounting,
  buildPartyLedger,
  buildPartySummary,
  cancelPaymentSchema,
  invoicesOfAnotherParty,
  resolveBookingRate,
  unallocatedOf,
  partyActivityInvoices,
  statementDocumentsOf,
  type EntryInput,
  type PartyInvoiceRow,
  type PartyLineRow,
  type PartyPaymentRow,
  type PartyType,
  moneyAccountRole,
  paymentPosting,
  type AccountRole,
  recordPaymentSchema,
  settlesInCurrency,
  tillAmountMinor,
  validateAllocations,
  type OpenInvoice,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, OfflineNotAvailableError, ValidationError } from '../errors'
import {
  assertPeriodOpen,
  branchOfInvoices,
  ensureAccountsForRoles,
  postDocument,
  reverseLedgerEntry,
} from './local-ledger'
import { requireCapability } from '../auth'
import { buildEnqueue } from '@hisabche/app-bridge'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface PaymentRow {
  id: string
  workspace_id: string
  payment_number: string | null
  direction: 'in' | 'out'
  party_type: 'customer' | 'supplier'
  party_id: string | null
  amount: number
  currency: string
  method: string
  entry_date: string
  reference: string
  notes: string
  status: string
  journal_entry_id: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function mapPayment(row: PaymentRow) {
  return {
    id: row.id,
    paymentNumber: row.payment_number,
    payment_number: row.payment_number,
    direction: row.direction,
    partyType: row.party_type,
    party_type: row.party_type,
    partyId: row.party_id,
    party_id: row.party_id,
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    entryDate: row.entry_date,
    entry_date: row.entry_date,
    reference: row.reference,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  }
}

export function registerPaymentRoutes(router: Router): void {
  // ─── GET /payments ──────────────────────────────────────────
  router.get('/payments', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId } = ctx

    const direction = query.direction?.trim()
    const partyId = query.partyId?.trim() || query.customerId?.trim()
    const currency = query.currency?.trim()
    const status = query.status?.trim()
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
    const page = Math.max(Number(query.page) || 1, 1)
    const offset = (page - 1) * limit

    const clauses: string[] = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [workspaceId]

    if (direction) {
      clauses.push('direction = ?')
      params.push(direction)
    }
    if (partyId) {
      clauses.push('party_id = ?')
      params.push(partyId)
    }
    if (currency) {
      clauses.push('currency = ?')
      params.push(currency)
    }
    if (status) {
      clauses.push('status = ?')
      params.push(status)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = db.all<PaymentRow>(
      `SELECT * FROM payment ${where} ORDER BY entry_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    // A plain array, as the server sends (payments.repository listPayments):
    // `usePayments` hands it straight to a list. An object here broke the
    // customer page offline.
    return rows.map(mapPayment)
  })

  // ─── GET /payments/cheques (server-only) ────────────────────
  router.get('/payments/cheques', () => {
    throw new OfflineNotAvailableError('payments.cheques')
  })

  // ─── GET /payments/:id ──────────────────────────────────────
  router.get('/payments/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const payment = db.get<PaymentRow>(
      'SELECT * FROM payment WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!payment) throw new NotFoundError('Payment', id)

    const allocations = db.all<{
      id: string
      invoice_id: string
      amount: number
    }>(
      'SELECT id, invoice_id, amount FROM payment_allocation WHERE payment_id = ? AND workspace_id = ?',
      [id, workspaceId],
    )

    return {
      ...mapPayment(payment),
      allocations: allocations.map((a) => ({
        id: a.id,
        invoiceId: a.invoice_id,
        amount: a.amount,
      })),
    }
  })

  // ─── POST /payments ─────────────────────────────────────────
  router.post('/payments', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    requireCapability(ctx, 'payment.record')
    const { workspaceId, baseCurrency } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = recordPaymentSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data
    // The fee is booked by the server (a separate ledger line and a smaller till movement). The device has no
    // such booking, and the fee travels in the queued payload: recording it here without the line would make the
    // two books differ. Refused, not dropped.
    if (data.feeAmount && data.feeAmount > 0) throw new ValidationError('PAYMENT_FEE_ONLINE_ONLY')

    const amount = Number(data.amount) || 0
    const direction = data.direction || 'in'
    const partyType = data.partyType || 'customer'
    const partyId =
      data.partyId || (typeof raw.customerId === 'string' ? raw.customerId : null) || null
    const currency = data.currency?.trim() || baseCurrency
    const method = data.method?.trim() || 'cash'
    const now = new Date().toISOString()
    const entryDate = data.entryDate?.slice(0, 10) || now.slice(0, 10)
    const reference = data.reference?.trim() || ''
    const notes = data.notes?.trim() || ''
    const paymentId = (raw.id as string) || generateUuid()

    const key = (c.headers?.['idempotency-key'] as string) || (raw.id as string) || null
    if (key) {
      const existing = db.get<PaymentRow>(
        'SELECT * FROM payment WHERE workspace_id = ? AND (id = ? OR reference = ?)',
        [workspaceId, key, key],
      )
      if (existing) {
        if (
          existing.direction !== data.direction ||
          existing.amount !== amount ||
          (partyId && existing.party_id !== partyId) ||
          (data.currency && existing.currency !== currency)
        ) {
          throw new ConflictError(
            'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
            'An existing payment with this idempotency key has different parameters',
          )
        }
        return {
          success: true,
          payment: existing,
          replayed: true,
        }
      }
    }

    const rawAllocations = data.allocations || []

    // The ONE rate this payment is booked at — the server's rule (resolveBookingRate): the body, else the frozen rate of the
    // invoices it names. The till movement and the ledger both read it; a second reading of the body is how a dollar payment
    // went into the drawer at 1 while the books had it at 70. null = no rate, refused by the caller.
    const bookingRateOf = (): number | null => {
      const namedRates = rawAllocations.length
        ? db.all<{ exchange_rate: number | null }>(
            `SELECT exchange_rate FROM invoice WHERE workspace_id = ? AND id IN (${rawAllocations
              .map(() => '?')
              .join(', ')})`,
            [workspaceId, ...rawAllocations.map((a) => a.invoiceId)],
          )
        : []
      return resolveBookingRate({
        currency,
        bookCurrency: baseCurrency,
        given: data.exchangeRate,
        invoiceRates: namedRates.map((row) => row.exchange_rate),
      })
    }

    // The till this cash goes into (money in) or comes out of (money out): a
    // REQUEST, read and checked here. Cash only; the till must be open; what
    // moves is stored in the till's own currency (payments.pos_session_id /
    // till_amount_minor). Absent = no till is touched — nothing is inferred.
    let till: { sessionId: string; amountMinor: number } | null = null
    if (data.tillSessionId) {
      if (method !== 'cash') throw new ValidationError('PAYMENT_TILL_ONLY_CASH')
      const row = db.get<{ id: string; status: string; currency: string | null }>(
        'SELECT id, status, currency FROM pos_session WHERE workspace_id = ? AND id = ?',
        [workspaceId, data.tillSessionId],
      )
      // A till of another business reads as no till: its existence is not said.
      if (!row) throw new ValidationError('PAYMENT_TILL_NOT_FOUND')
      // Closed, being counted, or suspended: its count must not move under it.
      if (row.status !== 'open')
        throw new ConflictError('PAYMENT_TILL_NOT_OPEN', 'PAYMENT_TILL_NOT_OPEN')
      const tillRate = bookingRateOf()
      if (tillRate === null) throw new ValidationError('PAYMENT_EXCHANGE_RATE_REQUIRED')
      const amountMinor = tillAmountMinor({
        amount,
        currency,
        tillCurrency: row.currency ?? baseCurrency,
        bookCurrency: baseCurrency,
        rate: tillRate,
      })
      if (amountMinor === null) throw new ValidationError('PAYMENT_TILL_CURRENCY_MISMATCH')
      till = { sessionId: row.id, amountMinor }
    }

    return db.transaction(() => {
      // 0. A payment dated inside a closed period is refused, as on the server — the company's lock, and the lock of the
      //    branch of the invoices it settles.
      assertPeriodOpen(
        db,
        entryDate,
        branchOfInvoices(
          db,
          workspaceId,
          rawAllocations.map((a) => a.invoiceId),
        ),
      )

      // 1. Fetch target open invoices if allocations requested
      if (rawAllocations.length > 0) {
        const invoiceIds = rawAllocations.map((a) => a.invoiceId)
        const placeholders = invoiceIds.map(() => '?').join(', ')
        const openInvoices = db.all<{
          id: string
          invoice_number: string
          total: number
          paid_amount: number
          currency: string
          date: string
          due_date: string | null
          status: string
          customer_id: string | null
          supplier_id: string | null
        }>(
          `SELECT id, invoice_number, total, paid_amount, currency, date, due_date, status, customer_id, supplier_id
           FROM invoice
           WHERE id IN (${placeholders}) AND workspace_id = ? AND status <> 'cancelled'`,
          [...invoiceIds, workspaceId],
        )

        // Validate currency: payment can only allocate to invoice of its own currency or books currency
        for (const rawAlloc of rawAllocations) {
          const inv = openInvoices.find((i) => i.id === rawAlloc.invoiceId)
          if (!inv) throw new NotFoundError('Invoice', rawAlloc.invoiceId)

          if (!settlesInCurrency({ currency: inv.currency }, currency, baseCurrency)) {
            throw new ConflictError(
              'PAYMENT_CURRENCY_MISMATCH',
              `Payment in ${currency} cannot settle invoice in ${inv.currency}`,
            )
          }
        }

        // One customer's debt is not settled with another customer's money (the server's own rule).
        if (
          invoicesOfAnotherParty(
            partyType,
            partyId,
            openInvoices.map((inv) => ({
              invoiceId: inv.id,
              customerId: inv.customer_id,
              supplierId: inv.supplier_id,
            })),
          ).length > 0
        ) {
          throw new ValidationError('PAYMENT_ALLOCATION_PARTY_MISMATCH')
        }

        // Validate allocation limits
        const domainInvoices: OpenInvoice[] = openInvoices.map((inv) => ({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number || inv.id,
          total: inv.total,
          allocated: inv.paid_amount,
          dueDate: inv.due_date || inv.date,
          invoiceDate: inv.date,
          currency: inv.currency,
        }))

        const problems = validateAllocations(amount, rawAllocations, domainInvoices)
        if (problems.length > 0) {
          throw new ConflictError(problems[0]!, problems[0]!)
        }
      }

      // 1b. The rate this payment is booked at — the server's rule, decided BEFORE anything is written.
      //     No rate = refused; a foreign payment is never booked as if it were the books currency.
      const bookingRate = bookingRateOf()
      if (bookingRate === null) throw new ValidationError('PAYMENT_EXCHANGE_RATE_REQUIRED')

      // 2. Generate payment number
      const prefix = direction === 'in' ? 'RCT' : 'VCH'
      const countRow = db.get<{ count: number }>(
        'SELECT count(*) as count FROM payment WHERE workspace_id = ? AND direction = ?',
        [workspaceId, direction],
      )
      const nextNum = (countRow?.count ?? 0) + 1
      const paymentNumber =
        (raw.paymentNumber as string) ||
        (raw.payment_number as string) ||
        `${prefix}-${String(nextNum).padStart(5, '0')}`

      // 3. Insert payment row
      db.run(
        `INSERT INTO payment (
          id, workspace_id, payment_number, direction, party_type, party_id,
          amount, currency, method, entry_date, reference, notes, status,
          created_at, updated_at, origin, sync_state, pos_session_id, till_amount_minor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, 'local', 'local_only', ?, ?)`,
        [
          paymentId,
          workspaceId,
          paymentNumber,
          direction,
          partyType,
          partyId,
          amount,
          currency,
          method,
          entryDate,
          reference,
          notes,
          now,
          now,
          till?.sessionId ?? null,
          till?.amountMinor ?? null,
        ],
      )

      // 4. Record allocations and update invoices
      for (const alloc of rawAllocations) {
        if (alloc.amount > 0) {
          db.run(
            `INSERT INTO payment_allocation (
              id, workspace_id, payment_id, invoice_id, amount,
              created_at, updated_at, origin, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
            [generateUuid(), workspaceId, paymentId, alloc.invoiceId, alloc.amount, now, now],
          )

          const inv = db.get<{ total: number; paid_amount: number }>(
            'SELECT total, paid_amount FROM invoice WHERE id = ?',
            [alloc.invoiceId],
          )
          if (inv) {
            const nextPaid = inv.paid_amount + alloc.amount
            const newStatus = nextPaid >= inv.total ? 'completed' : 'partial'
            db.run('UPDATE invoice SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ?', [
              nextPaid,
              newStatus,
              now,
              alloc.invoiceId,
            ])
          }
        }
      }

      // 5. Post the ledger entry — line for line what the server's `bookPayment` writes
      //    (payments.service.ts), through the same shared rules:
      //    · the money side is cash for cash and the bank for any other method (`moneyAccountRole`);
      //    · a foreign payment settles each invoice at THAT invoice's frozen rate and the gap goes to
      //      `fx_gain_loss` (`paymentPosting` with `allocationRates` as the server reads them).
      //    Until 16 Nov 2026 the device posted every allocation at the payment's own rate and always to
      //    cash: a dollar receipt against a dollar invoice booked no exchange difference here while the
      //    server did, and a bank transfer moved the drawer. The fee is refused above, so it is 0.
      const allocationRates = (() => {
        if (currency === baseCurrency || rawAllocations.length === 0) {
          return rawAllocations.map((a) => ({ amount: a.amount, rate: null as number | null }))
        }
        const rows = db.all<{ id: string; exchange_rate: number | null }>(
          `SELECT id, exchange_rate FROM invoice WHERE workspace_id = ? AND id IN (${rawAllocations
            .map(() => '?')
            .join(', ')})`,
          [workspaceId, ...rawAllocations.map((a) => a.invoiceId)],
        )
        const rateOf = new Map(rows.map((row) => [row.id, row.exchange_rate]))
        return rawAllocations.map((a) => ({
          amount: a.amount,
          rate: rateOf.get(a.invoiceId) ?? null,
        }))
      })()
      const posting = paymentPosting({
        direction,
        amount,
        paymentRate: bookingRate,
        allocations: allocationRates,
      })

      const isIncoming = direction === 'in'
      // Money out to a CUSTOMER is a refund closing what the business owes on receivables (server rule).
      const partyRole = isIncoming
        ? partyType === 'supplier'
          ? 'payable'
          : 'receivable'
        : partyType === 'customer'
          ? 'receivable'
          : 'payable'
      const moneyRole = moneyAccountRole(method)
      const roles: AccountRole[] = [moneyRole, partyRole]
      if (posting.difference !== 0) roles.push('fx_gain_loss')
      const { accounts } = ensureAccountsForRoles(db, workspaceId, roles)
      const differenceLine =
        posting.difference === 0
          ? []
          : posting.difference > 0
            ? [{ accountId: accounts.fx_gain_loss!, debit: 0, credit: posting.difference }]
            : [{ accountId: accounts.fx_gain_loss!, debit: -posting.difference, credit: 0 }]

      const outcome = postDocument(db, ctx, {
        sourceType: 'payment',
        sourceId: paymentId,
        date: entryDate,
        description: `${isIncoming ? 'دریافت' : 'پرداخت'} ${paymentNumber}`,
        reference: paymentNumber,
        lines: isIncoming
          ? [
              { accountId: accounts[moneyRole]!, debit: posting.cash, credit: 0 },
              { accountId: accounts[partyRole]!, debit: 0, credit: posting.party },
              ...differenceLine,
            ]
          : [
              { accountId: accounts[partyRole]!, debit: posting.party, credit: 0 },
              { accountId: accounts[moneyRole]!, debit: 0, credit: posting.cash },
              ...differenceLine,
            ],
      })
      const journalId = outcome.status === 'skipped' ? null : outcome.entryId
      db.run('UPDATE payment SET journal_entry_id = ? WHERE id = ?', [journalId, paymentId])

      if (c.headers?.['x-hisabche-queue'] === '1') {
        const enqueue = buildEnqueue({
          entity: 'payment',
          operation: 'create',
          clientId: paymentId,
          // `autoAllocate: false`: the allocations above are final — the server settles nothing else on sync.
          payload: { id: paymentId, ...data, autoAllocate: false },
          userId: c.headers?.['x-hisabche-user-id'] ?? ctx.userId,
          workspaceId,
        })
        db.run(enqueue.sql, enqueue.params)
      }

      const inserted = db.get<PaymentRow>('SELECT * FROM payment WHERE id = ?', [paymentId])
      return {
        ...mapPayment(inserted!),
        // What no invoice was named for: visible, traceable, and nothing was settled on its behalf.
        unallocated: unallocatedOf(amount, rawAllocations),
      }
    })
  })

  // ─── POST /payments/:id/confirm-server ──────────────────────
  //
  // V70 §8: the server accepted a payment this device recorded first — the
  // mirror of `POST /invoices/:id/confirm-server`.
  //
  // The device wrote it under its own id and number. The server answered the
  // push with ITS id and number. Both land on the device's row at once, and
  // everything hung on the device id (allocations, the journal entry's source,
  // deposit applications and refunds) moves to the server's id in ONE
  // transaction — otherwise a later «cancel this payment» would queue the
  // device id, the server would answer 404, and the push treats a 404 cancel
  // as already done: the payment would stay on the server's books for good.
  //
  // It moves references and nothing else: no amount or balance is recomputed.
  // `confirmed: false` is an answer, not an error.
  router.post('/payments/:id/confirm-server', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    requireCapability(ctx, 'payment.record')
    const { workspaceId } = ctx
    const clientId = params.id
    const body = (c.body ?? {}) as Record<string, unknown>
    const serverId = typeof body.serverId === 'string' ? body.serverId.trim() : ''
    const paymentNumber = typeof body.paymentNumber === 'string' ? body.paymentNumber.trim() : ''
    if (!serverId) throw new ValidationError('CONFIRM_SERVER_PAYMENT_INCOMPLETE: serverId')

    return db.transaction(() => {
      const mine = db.get<{ id: string; payment_number: string | null }>(
        'SELECT id, payment_number FROM payment WHERE id = ? AND workspace_id = ?',
        [clientId, workspaceId],
      )
      if (!mine) return { confirmed: false, reason: 'NOT_ON_DEVICE' }

      const now = new Date().toISOString()
      const number = paymentNumber || mine.payment_number

      if (serverId !== clientId) {
        // The server's row is already here under its own id: two rows for one
        // payment is the one thing this must never leave.
        const there = db.get<{ id: string }>('SELECT id FROM payment WHERE id = ?', [serverId])
        if (there) return { confirmed: false, reason: 'ALREADY_PRESENT' }

        db.run('UPDATE payment_allocation SET payment_id = ? WHERE payment_id = ?', [
          serverId,
          clientId,
        ])
        db.run(
          "UPDATE journal_entry SET source_id = ? WHERE source_type = 'payment' AND source_id = ?",
          [serverId, clientId],
        )
        db.run('UPDATE order_deposit_applications SET payment_id = ? WHERE payment_id = ?', [
          serverId,
          clientId,
        ])
        db.run('UPDATE order_deposit_refunds SET payment_id = ? WHERE payment_id = ?', [
          serverId,
          clientId,
        ])
      }
      db.run(
        `UPDATE payment SET id = ?, payment_number = ?, sync_state = 'synced', updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [serverId, number, now, clientId, workspaceId],
      )
      return { confirmed: true, id: serverId, paymentNumber: number }
    })
  })

  // ─── POST /payments/:id/cancel ──────────────────────────────
  router.post('/payments/:id/cancel', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    requireCapability(ctx, 'payment.cancel')

    const raw = (c.body || {}) as Record<string, unknown>
    const parsed = cancelPaymentSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }

    const payment = db.get<PaymentRow>(
      'SELECT * FROM payment WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!payment) throw new NotFoundError('Payment', id)
    if (payment.status === 'cancelled') return { success: true }

    const now = new Date().toISOString()

    return db.transaction(() => {
      // 1. Revert allocations on invoices (Scenario 05C: atomic delta update)
      const allocations = db.all<{ id: string; invoice_id: string; amount: number }>(
        'SELECT id, invoice_id, amount FROM payment_allocation WHERE payment_id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [id, workspaceId],
      )

      for (const a of allocations) {
        db.run(
          `UPDATE invoice
              SET paid_amount = MAX(0, paid_amount - ?),
                  status = CASE WHEN MAX(0, paid_amount - ?) = 0 THEN 'unpaid' ELSE 'partial' END,
                  updated_at = ?
            WHERE id = ?`,
          [a.amount, a.amount, now, a.invoice_id],
        )
      }

      // Scenario 05B Fix: soft delete allocations instead of hard DELETE
      db.run(
        'UPDATE payment_allocation SET deleted_at = ?, updated_at = ? WHERE payment_id = ? AND deleted_at IS NULL',
        [now, now, id],
      )

      // 2. Reverse journal entry
      // A dated reversal entry, never an in-place edit; a closed day refuses the whole cancel.
      if (payment.journal_entry_id) {
        reverseLedgerEntry(db, ctx, payment.journal_entry_id, {
          date: now.slice(0, 10),
          reason: parsed.data.reason,
          now,
          branchId: branchOfInvoices(
            db,
            workspaceId,
            allocations.map((a) => a.invoice_id),
          ),
        })
      }

      // 3. Mark payment cancelled
      db.run("UPDATE payment SET status = 'cancelled', updated_at = ? WHERE id = ?", [now, id])

      if (c.headers?.['x-hisabche-queue'] === '1') {
        const enqueue = buildEnqueue({
          entity: 'payment',
          operation: 'delete',
          clientId: `${id}-cancel-${Date.now()}`,
          payload: { id },
          userId: c.headers?.['x-hisabche-user-id'] ?? ctx.userId,
          workspaceId,
        })
        db.run(enqueue.sql, enqueue.params)
      }

      return { success: true }
    })
  })
}

// ─── The statement of one party ──────────────────────────────
// The same rows the server reads (payments.repository partyMovements), handed
// to the same assembly (@hisabche/validation party-statement).

function partyOf(c: RouteHandlerContext): { partyType: PartyType; partyId: string } {
  const { partyType, partyId } = c.params
  if (partyType !== 'customer' && partyType !== 'supplier') {
    throw new ValidationError('Invalid party')
  }
  return { partyType, partyId: partyId ?? '' }
}

function partyMovements(c: RouteHandlerContext, partyType: PartyType, partyId: string) {
  const { db, ctx } = c
  const partyColumn = partyType === 'customer' ? 'customer_id' : 'supplier_id'
  const invoices = db.all<PartyInvoiceRow>(
    `SELECT id, invoice_number, type, status, total, paid_amount, date, due_date, currency
     FROM invoice
     WHERE workspace_id = ? AND ${partyColumn} = ? AND deleted_at IS NULL AND status <> 'cancelled'
     ORDER BY date ASC, id ASC`,
    [ctx.workspaceId, partyId],
  )
  const payments = db.all<PartyPaymentRow>(
    `SELECT id, payment_number, direction, amount, entry_date, currency, method
     FROM payment
     WHERE workspace_id = ? AND party_id = ? AND deleted_at IS NULL AND status = 'posted'
     ORDER BY entry_date ASC, id ASC`,
    [ctx.workspaceId, partyId],
  )
  // Only customers carry an opening balance.
  const openingBalance =
    partyType === 'customer'
      ? Number(
          db.get<{ opening_balance: number }>(
            'SELECT opening_balance FROM customer WHERE id = ? AND workspace_id = ?',
            [partyId, ctx.workspaceId],
          )?.opening_balance,
        ) || 0
      : 0
  return { invoices, payments, openingBalance }
}

export function registerPartyStatementRoutes(router: Router): void {
  router.get('/payments/open-invoices/:partyType/:partyId', (c: RouteHandlerContext) => {
    const { partyType, partyId } = partyOf(c)
    const partyColumn = partyType === 'customer' ? 'customer_id' : 'supplier_id'
    const rows = c.db.all<{
      id: string
      invoice_number: string | null
      total: number
      paid_amount: number
      due_date: string | null
      date: string
      currency: string | null
    }>(
      `SELECT id, invoice_number, total, paid_amount, due_date, date, currency
       FROM invoice
       WHERE workspace_id = ? AND ${partyColumn} = ? AND type = ? AND deleted_at IS NULL
         AND status <> 'cancelled' AND total - paid_amount > 0
       ORDER BY due_date ASC`,
      [c.ctx.workspaceId, partyId, partyType === 'customer' ? 'sale' : 'purchase'],
    )
    return buildOpenInvoicesView(
      rows.map((row) => ({
        invoiceId: row.id,
        invoiceNumber: row.invoice_number ?? '',
        total: Number(row.total) || 0,
        allocated: Number(row.paid_amount) || 0,
        dueDate: String(row.due_date ?? '').slice(0, 10),
        invoiceDate: String(row.date ?? '').slice(0, 10),
        currency: row.currency ? String(row.currency) : null,
      })),
    )
  })

  router.get('/payments/summary/:partyType/:partyId', (c: RouteHandlerContext) => {
    const { partyType, partyId } = partyOf(c)
    const asOf = c.query.asOf
    return buildPartySummary({
      rows: partyMovements(c, partyType, partyId),
      bookCurrency: c.ctx.baseCurrency,
      asOf: asOf && /^d{4}-d{2}-d{2}$/.test(asOf) ? asOf : new Date().toISOString().slice(0, 10),
    })
  })

  router.get('/payments/activity/:partyType/:partyId', (c: RouteHandlerContext) => {
    const { partyType, partyId } = partyOf(c)
    const rows = partyMovements(c, partyType, partyId)
    const ids = partyActivityInvoices(partyType, rows.invoices).map((invoice) => invoice.id)
    const lines =
      ids.length === 0
        ? []
        : c.db.all<PartyLineRow>(
            `SELECT invoice_id, product_id, product_name, unit, unit_label, quantity, total_price
             FROM invoice_item
             WHERE workspace_id = ? AND deleted_at IS NULL AND invoice_id IN (${ids.map(() => '?').join(', ')})
             ORDER BY id ASC`,
            [c.ctx.workspaceId, ...ids],
          )
    return buildPartyActivity({
      partyType,
      rows,
      lines,
      asOf: new Date().toISOString().slice(0, 10),
    })
  })

  router.get('/payments/ledger/:partyType/:partyId', (c: RouteHandlerContext) => {
    const { partyType, partyId } = partyOf(c)
    return buildPartyLedger({
      partyType,
      partyId,
      rows: partyMovements(c, partyType, partyId),
      bookCurrency: c.ctx.baseCurrency,
    })
  })

  // ─── GET /customers/:id/accounting ──────────────────────────
  // Every statement document of the customer with the journal entries that
  // account for it (the same rule the server's customer profile uses).
  router.get('/customers/:id/accounting', (c: RouteHandlerContext) => {
    const customerId = c.params.id ?? ''
    const exists = c.db.get<{ id: string }>(
      'SELECT id FROM customer WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [customerId, c.ctx.workspaceId],
    )
    if (!exists) throw new NotFoundError('CUSTOMER_NOT_FOUND')

    const ledger = buildPartyLedger({
      partyType: 'customer',
      partyId: customerId,
      rows: partyMovements(c, 'customer', customerId),
      bookCurrency: c.ctx.baseCurrency,
    })
    const documents = statementDocumentsOf(ledger.movements)

    const entries: EntryInput[] = []
    for (const type of ['invoice', 'payment'] as const) {
      const ids = [
        ...new Set(documents.filter((d) => d.sourceType === type).map((d) => d.sourceId)),
      ]
      if (ids.length === 0) continue
      const rows = c.db.all<{
        id: string
        entry_number: string | null
        date: string
        status: string
        source_type: string | null
        source_id: string | null
        reversal_of: string | null
      }>(
        `SELECT id, entry_number, date, status, source_type, source_id, reversal_of
         FROM journal_entry
         WHERE workspace_id = ? AND source_type = ? AND deleted_at IS NULL
           AND source_id IN (${ids.map(() => '?').join(', ')})
         ORDER BY date ASC, id ASC`,
        [c.ctx.workspaceId, type, ...ids],
      )
      for (const row of rows) {
        entries.push({
          id: row.id,
          entryNumber: row.entry_number,
          date: row.date,
          status: row.status,
          sourceType: row.source_type,
          sourceId: row.source_id,
          reversalOf: row.reversal_of,
          lines: c.db.all<{
            debit: number
            credit: number
            accountCode: string
            accountName: string
          }>(
            `SELECT l.debit AS debit, l.credit AS credit, a.code AS accountCode, a.name AS accountName
             FROM journal_line l JOIN account a ON a.id = l.account_id
             WHERE l.journal_id = ? AND l.workspace_id = ?`,
            [row.id, c.ctx.workspaceId],
          ),
        })
      }
    }
    return buildCustomerAccounting(documents, entries)
  })
}
