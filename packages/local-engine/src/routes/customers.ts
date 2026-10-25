// ============================================
// packages/local-engine/src/routes/customers.ts
//
// Customer party management and balance calculations.
// Balances are computed per currency using the shared
// partyBalancesByCurrency rule from @hisabche/validation.
// ============================================

import {
  createCustomerSchema,
  matchesRole,
  mergeRole,
  partyBalancesByCurrency,
  resolveEffectiveRole,
  runningLedger,
  updateCustomerSchema,
  type CurrencyBalance,
  type DeclaredRole,
  type LedgerMovement,
  type PartyRole,
} from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface CustomerRow {
  id: string
  workspace_id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  opening_balance: number
  type: string | null
  declared_role: string | null
  is_active: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function mapCustomer(raw: CustomerRow) {
  return {
    id: raw.id,
    fullName: raw.full_name,
    phone: raw.phone || '',
    email: raw.email || '',
    address: raw.address,
    notes: raw.notes || '',
    openingBalance: raw.opening_balance,
    isActive: Boolean(raw.is_active),
    type: raw.type || 'individual',
    declaredRole: raw.declared_role ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
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

export function registerCustomerRoutes(router: Router): void {
  // ─── GET /customers ─────────────────────────────────────────
  router.get('/customers', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId } = ctx

    const search = query.search?.trim()
    const type = query.type?.trim()
    const isActive =
      query.isActive !== undefined ? query.isActive === 'true' || query.isActive === '1' : undefined
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
    const page = Math.max(Number(query.page) || 1, 1)
    const offset = (page - 1) * limit

    const clauses: string[] = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [workspaceId]

    if (search) {
      // ⚠️ THE SERVER'S RULE, NOT A SECOND ONE: `ilike('full_name', …)`
      // (backend/src/services/customer.service.ts:250). The server does not
      // search the phone, so this route does not either — one rule, two hosts.
      clauses.push('full_name LIKE ?')
      params.push(`%${search}%`)
    }
    if (type) {
      clauses.push('type = ?')
      params.push(type)
    }
    if (isActive !== undefined) {
      clauses.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }
    // The server's rule (customer.service): an opening balance owed, or none.
    if (query.hasBalance === 'true' || query.hasBalance === 'false') {
      clauses.push(query.hasBalance === 'true' ? 'opening_balance > 0' : 'opening_balance = 0')
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    // «مشتری / تأمین‌کننده». The role is not a column: it is what the person
    // declared merged with what their invoices say, so it filters FIRST and the
    // page is cut AFTER — the server's order, and its rule (resolveEffectiveRole).
    // Before this the device ignored `role` and every tab listed everybody.
    const role = query.role === 'buyer' ? 'buyer' : query.role === 'seller' ? 'seller' : undefined
    if (role) {
      const derived = new Map<string, PartyRole>()
      const invoiceRows = db.all<{ customer_id: string; type: string | null }>(
        `SELECT customer_id, type FROM invoice
         WHERE workspace_id = ? AND deleted_at IS NULL AND customer_id IS NOT NULL`,
        [workspaceId],
      )
      for (const invoice of invoiceRows) {
        derived.set(
          invoice.customer_id,
          mergeRole(
            derived.get(invoice.customer_id) ?? 'none',
            invoice.type === 'purchase' ? 'seller' : 'buyer',
          ),
        )
      }

      const everyone = db.all<CustomerRow>(
        `SELECT * FROM customer ${where} ORDER BY created_at DESC, id DESC`,
        params,
      )
      const matching = everyone
        .map((row) => ({
          ...mapCustomer(row),
          role: resolveEffectiveRole(
            row.declared_role as DeclaredRole | null,
            derived.get(row.id) ?? 'none',
          ),
        }))
        .filter((customer) => matchesRole(customer.role, role))

      const from = (page - 1) * limit
      return {
        customers: matching.slice(from, from + limit),
        total: matching.length,
        hasMore: from + limit < matching.length,
        nextCursor: null,
        limit,
      }
    }

    const countRow = db.get<{ count: number }>(
      `SELECT count(*) as count FROM customer ${where}`,
      params,
    )
    const total = countRow?.count ?? 0

    const rows = db.all<CustomerRow>(
      `SELECT * FROM customer ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    return {
      customers: rows.map(mapCustomer),
      total,
      hasMore: offset + limit < total,
      nextCursor: null,
      limit,
    }
  })

  // ─── GET /customers/:id ─────────────────────────────────────
  router.get('/customers/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const row = db.get<CustomerRow>(
      'SELECT * FROM customer WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Customer', id)
    return mapCustomer(row)
  })

  // ─── POST /customers ────────────────────────────────────────
  router.post('/customers', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const normalized = {
      ...raw,
      fullName: (raw.fullName as string)?.trim() || (raw.name as string)?.trim(),
    }

    const parsed = createCustomerSchema.safeParse(normalized)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const now = new Date().toISOString()
    const id = (raw.id as string) || generateUuid()
    const fullName = data.fullName.trim()
    const phone = data.phone?.trim() || null
    const email = data.email?.trim() || null
    const address = typeof data.address === 'string' ? data.address.trim() : null
    const notes = data.notes?.trim() || null
    const openingBalance = Number(data.openingBalance) || 0
    const type = data.type || 'cash'
    const declaredRole = data.declaredRole || null
    const isActive = data.isActive !== false ? 1 : 0

    db.run(
      `INSERT INTO customer (
        id, workspace_id, full_name, phone, email, address, notes,
        opening_balance, type, declared_role, is_active, created_at, updated_at,
        origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        id,
        workspaceId,
        fullName,
        phone,
        email,
        address,
        notes,
        openingBalance,
        type,
        declaredRole,
        isActive,
        now,
        now,
      ],
    )

    const row = db.get<CustomerRow>('SELECT * FROM customer WHERE id = ? AND workspace_id = ?', [
      id,
      workspaceId,
    ])
    return mapCustomer(row!)
  })

  // ─── PATCH /customers/:id ───────────────────────────────────
  router.patch('/customers/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id } = params
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const normalized = {
      id,
      ...raw,
      ...(raw.name && !raw.fullName ? { fullName: raw.name } : {}),
    }

    const parsed = updateCustomerSchema.safeParse(normalized)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const existing = db.get<CustomerRow>(
      'SELECT * FROM customer WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!existing) throw new NotFoundError('Customer', id)

    const now = new Date().toISOString()
    const fullName = data.fullName !== undefined ? String(data.fullName).trim() : existing.full_name
    const phone =
      data.phone !== undefined ? (data.phone ? String(data.phone).trim() : null) : existing.phone
    const email =
      data.email !== undefined ? (data.email ? String(data.email).trim() : null) : existing.email
    const address =
      data.address !== undefined
        ? typeof data.address === 'string'
          ? data.address.trim()
          : null
        : existing.address
    const notes =
      data.notes !== undefined ? (data.notes ? String(data.notes).trim() : null) : existing.notes
    const openingBalance =
      data.openingBalance !== undefined ? Number(data.openingBalance) : existing.opening_balance
    const type =
      data.type !== undefined ? (data.type ? String(data.type).trim() : null) : existing.type
    const declaredRole =
      data.declaredRole !== undefined
        ? data.declaredRole
          ? String(data.declaredRole).trim()
          : null
        : existing.declared_role
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active

    db.run(
      `UPDATE customer SET
        full_name = ?, phone = ?, email = ?, address = ?, notes = ?,
        opening_balance = ?, type = ?, declared_role = ?, is_active = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [
        fullName,
        phone,
        email,
        address,
        notes,
        openingBalance,
        type,
        declaredRole,
        isActive,
        now,
        id,
        workspaceId,
      ],
    )

    const updated = db.get<CustomerRow>(
      'SELECT * FROM customer WHERE id = ? AND workspace_id = ?',
      [id, workspaceId],
    )
    return mapCustomer(updated!)
  })

  // ─── GET /customers/:id/balance ─────────────────────────────
  router.get('/customers/:id/balance', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId, baseCurrency } = ctx

    const customer = db.get<CustomerRow>(
      'SELECT * FROM customer WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!customer) throw new NotFoundError('Customer', id)

    // Collect invoices
    const invoices = db.all<{
      id: string
      invoice_number: string
      total: number
      currency: string
      date: string
      type: string
    }>(
      `SELECT id, invoice_number, total, currency, date, type
       FROM invoice
       WHERE customer_id = ? AND workspace_id = ? AND status <> 'cancelled' AND deleted_at IS NULL
       ORDER BY date ASC`,
      [id, workspaceId],
    )

    // Collect payments
    const payments = db.all<{
      id: string
      payment_number: string
      amount: number
      currency: string
      entry_date: string
      direction: string
    }>(
      `SELECT id, payment_number, amount, currency, entry_date, direction
       FROM payment
       WHERE party_id = ? AND workspace_id = ? AND status <> 'cancelled' AND deleted_at IS NULL
       ORDER BY entry_date ASC`,
      [id, workspaceId],
    )

    const movements: LedgerMovement[] = [
      ...invoices.map((inv) => ({
        date: inv.date.slice(0, 10),
        kind: (inv.type === 'sale' ? 'sale' : 'purchase') as LedgerMovement['kind'],
        amount: inv.total,
        reference: inv.invoice_number || inv.id,
        currency: inv.currency || baseCurrency,
      })),
      ...payments.map((p) => ({
        date: p.entry_date.slice(0, 10),
        kind: (p.direction === 'in' ? 'payment_in' : 'payment_out') as LedgerMovement['kind'],
        amount: p.amount,
        reference: p.payment_number || p.id,
        currency: p.currency || baseCurrency,
      })),
    ]

    const balances = partyBalancesByCurrency(movements, baseCurrency, customer.opening_balance)
    const primaryBalance =
      balances.find((b: CurrencyBalance) => b.currency === baseCurrency)?.balance ??
      customer.opening_balance

    return {
      customerId: id,
      currency: baseCurrency,
      balance: primaryBalance,
      balances,
      isDebtor: balances.some((b: CurrencyBalance) => b.balance > 0),
    }
  })

  // ─── GET /customers/:id/statement ───────────────────────────
  router.get('/customers/:id/statement', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId, baseCurrency } = ctx

    const customer = db.get<CustomerRow>(
      'SELECT * FROM customer WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!customer) throw new NotFoundError('Customer', id)

    const invoices = db.all<{
      id: string
      invoice_number: string
      total: number
      currency: string
      date: string
      type: string
    }>(
      `SELECT id, invoice_number, total, currency, date, type
       FROM invoice
       WHERE customer_id = ? AND workspace_id = ? AND status <> 'cancelled' AND deleted_at IS NULL
       ORDER BY date ASC`,
      [id, workspaceId],
    )

    const payments = db.all<{
      id: string
      payment_number: string
      amount: number
      currency: string
      entry_date: string
      direction: string
    }>(
      `SELECT id, payment_number, amount, currency, entry_date, direction
       FROM payment
       WHERE party_id = ? AND workspace_id = ? AND status <> 'cancelled' AND deleted_at IS NULL
       ORDER BY entry_date ASC`,
      [id, workspaceId],
    )

    const movements: LedgerMovement[] = [
      ...invoices.map((inv) => ({
        date: inv.date.slice(0, 10),
        kind: (inv.type === 'sale' ? 'invoice_sale' : 'invoice_purchase') as LedgerMovement['kind'],
        amount: inv.total,
        reference: inv.invoice_number || inv.id,
        currency: inv.currency || baseCurrency,
      })),
      ...payments.map((p) => ({
        date: p.entry_date.slice(0, 10),
        kind: (p.direction === 'in' ? 'payment_in' : 'payment_out') as LedgerMovement['kind'],
        amount: p.amount,
        reference: p.payment_number || p.id,
        currency: p.currency || baseCurrency,
      })),
    ]

    const balances = partyBalancesByCurrency(movements, baseCurrency, customer.opening_balance)
    const ledgerRows = runningLedger(
      movements.map((m) => ({ ...m, currency: m.currency || baseCurrency })),
    )

    return {
      partyId: id,
      partyType: 'customer',
      openingBalance: customer.opening_balance,
      currency: baseCurrency,
      balance:
        balances.find((b: CurrencyBalance) => b.currency === baseCurrency)?.balance ??
        customer.opening_balance,
      balances,
      movements: ledgerRows,
    }
  })
}
