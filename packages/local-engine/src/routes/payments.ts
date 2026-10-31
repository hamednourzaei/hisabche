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
  partyActivityInvoices,
  statementDocumentsOf,
  type EntryInput,
  type PartyInvoiceRow,
  type PartyLineRow,
  type PartyPaymentRow,
  type PartyType,
  paymentPosting,
  recordPaymentSchema,
  settlesInCurrency,
  tillAmountMinor,
  validateAllocations,
  type OpenInvoice,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import { requireCapability } from '../auth'
import { buildEnqueue } from '@hisabche/app-bridge'
import type { Router } from '../router'
import { ensureDefaultAccounts } from './invoices'
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
    const { workspaceId, baseCurrency } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = recordPaymentSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

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
      const amountMinor = tillAmountMinor({
        amount,
        currency,
        tillCurrency: row.currency ?? baseCurrency,
        bookCurrency: baseCurrency,
        rate: Number(data.exchangeRate) > 0 ? Number(data.exchangeRate) : 1,
      })
      if (amountMinor === null) throw new ValidationError('PAYMENT_TILL_CURRENCY_MISMATCH')
      till = { sessionId: row.id, amountMinor }
    }

    return db.transaction(() => {
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
        }>(
          `SELECT id, invoice_number, total, paid_amount, currency, date, due_date, status
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

      // 5. Post General Ledger lines
      const accounts = ensureDefaultAccounts(db, workspaceId)
      const paymentRate = Number(data.exchangeRate) > 0 ? Number(data.exchangeRate) : 1.0

      const posting = paymentPosting({
        direction,
        amount,
        paymentRate,
        allocations: rawAllocations.map((a) => ({ amount: a.amount, rate: paymentRate })),
      })

      const journalId = generateUuid()
      const journalNumber = `J-${entryDate.slice(0, 4)}-${paymentNumber}`

      db.run(
        `INSERT INTO journal_entry (
          id, workspace_id, entry_number, date, description, reference, status,
          source_type, source_id, posted_at, created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'payment', ?, ?, ?, ?, 'local', 'local_only')`,
        [
          journalId,
          workspaceId,
          journalNumber,
          entryDate,
          `پرداخت ${paymentNumber}`,
          paymentNumber,
          paymentId,
          now,
          now,
          now,
        ],
      )

      const partyAccount = partyType === 'supplier' ? accounts.payable! : accounts.receivable!
      const cashAccount = accounts.cash!

      if (direction === 'in') {
        // Debit Cash, Credit Accounts Receivable
        db.run(
          `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            generateUuid(),
            workspaceId,
            journalId,
            cashAccount,
            posting.cash,
            paymentNumber,
            now,
            now,
          ],
        )
        db.run(
          `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [
            generateUuid(),
            workspaceId,
            journalId,
            partyAccount,
            posting.party,
            paymentNumber,
            now,
            now,
          ],
        )
      } else {
        // Debit Accounts Payable, Credit Cash
        db.run(
          `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [
            generateUuid(),
            workspaceId,
            journalId,
            partyAccount,
            posting.party,
            paymentNumber,
            now,
            now,
          ],
        )
        db.run(
          `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [
            generateUuid(),
            workspaceId,
            journalId,
            cashAccount,
            posting.cash,
            paymentNumber,
            now,
            now,
          ],
        )
      }

      db.run('UPDATE payment SET journal_entry_id = ? WHERE id = ?', [journalId, paymentId])

      if (c.headers?.['x-hisabche-queue'] === '1') {
        const enqueue = buildEnqueue({
          entity: 'payment',
          operation: 'create',
          clientId: paymentId,
          payload: { id: paymentId, ...data },
          userId: c.headers?.['x-hisabche-user-id'] ?? ctx.userId,
          workspaceId,
        })
        db.run(enqueue.sql, enqueue.params)
      }

      const inserted = db.get<PaymentRow>('SELECT * FROM payment WHERE id = ?', [paymentId])
      return mapPayment(inserted!)
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
      if (payment.journal_entry_id) {
        db.run("UPDATE journal_entry SET status = 'reversed', updated_at = ? WHERE id = ?", [
          now,
          payment.journal_entry_id,
        ])
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
