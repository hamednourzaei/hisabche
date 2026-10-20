// ============================================
// packages/local-engine/src/routes/accounting.ts
//
// General Ledger, Trial Balance, Journal Entries,
// Chart of Accounts, Period Locks, and Profit Report.
// Trial balance computes debit/credit balances per account.
// Profit report uses shared buildProfitReport from @hisabche/validation.
// ============================================

import {
  buildProfitReport,
  createAccountSchema,
  createJournalEntrySchema,
  dateOnly,
  naturalBalance,
  periodLockSchema,
  reverseJournalEntrySchema,
  round2,
  type AccountRootType,
  type ProfitConsumption,
  type ProfitInvoice,
  type ProfitLine,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface AccountRow {
  id: string
  workspace_id: string
  code: string
  name: string
  type: AccountRootType
  role: string | null
  parent_id: string | null
  is_group: number
  is_active: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface JournalEntryRow {
  id: string
  workspace_id: string
  entry_number: string | null
  date: string
  description: string
  reference: string
  status: string
  source_type: string | null
  source_id: string | null
  reversal_of: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface JournalLineRow {
  id: string
  workspace_id: string
  journal_id: string
  account_id: string
  debit: number
  credit: number
  description: string | null
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

export function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    role: row.role,
    parentId: row.parent_id,
    isGroup: Boolean(row.is_group),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerAccountingRoutes(router: Router): void {
  // ─── GET /accounting/accounts ───────────────────────────────
  router.get('/accounting/accounts', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<AccountRow>(
      'SELECT * FROM account WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY code ASC',
      [ctx.workspaceId],
    )
    return rows.map(mapAccount)
  })

  // ─── POST /accounting/accounts ──────────────────────────────
  router.post('/accounting/accounts', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = createAccountSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const code = data.code.trim()
    const name = data.name.trim()
    const type = data.type as AccountRootType

    const existing = db.get<{ id: string }>(
      'SELECT id FROM account WHERE workspace_id = ? AND code = ? AND deleted_at IS NULL',
      [workspaceId, code],
    )
    if (existing) throw new ConflictError('ACCOUNT_CODE_DUPLICATE', 'Account code already exists')

    const now = new Date().toISOString()
    const id = (raw.id as string) || generateUuid()
    const role = data.role || null
    const parentId = data.parentId || null
    const isGroup = data.isGroup ? 1 : 0
    const isActive = data.isActive !== false ? 1 : 0

    db.run(
      `INSERT INTO account (
        id, workspace_id, code, name, type, role, parent_id, is_group,
        is_active, created_at, updated_at, origin, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [id, workspaceId, code, name, type, role, parentId, isGroup, isActive, now, now],
    )

    const created = db.get<AccountRow>('SELECT * FROM account WHERE id = ?', [id])
    return mapAccount(created!)
  })

  // ─── GET /accounting/journal ────────────────────────────────
  router.get('/accounting/journal', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId } = ctx

    const status = query.status?.trim()
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)

    const clauses: string[] = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [workspaceId]

    if (status) {
      clauses.push('status = ?')
      params.push(status)
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    const entries = db.all<JournalEntryRow>(
      `SELECT * FROM journal_entry ${where} ORDER BY date DESC, created_at DESC LIMIT ?`,
      [...params, limit],
    )

    const result = entries.map((entry) => {
      const lines = db.all<
        JournalLineRow & { account_code: string; account_name: string; account_type: string }
      >(
        `SELECT jl.*, a.code as account_code, a.name as account_name, a.type as account_type
         FROM journal_line jl
         JOIN account a ON a.id = jl.account_id
         WHERE jl.journal_id = ? AND jl.workspace_id = ? AND jl.deleted_at IS NULL`,
        [entry.id, workspaceId],
      )

      return {
        id: entry.id,
        entryNumber: entry.entry_number,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        sourceType: entry.source_type,
        sourceId: entry.source_id,
        postedAt: entry.posted_at,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
        lines: lines.map((l) => ({
          id: l.id,
          accountId: l.account_id,
          accountCode: l.account_code,
          accountName: l.account_name,
          accountType: l.account_type,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
      }
    })

    return { entries: result }
  })

  // ─── POST /accounting/journal ───────────────────────────────
  router.post('/accounting/journal', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const now = new Date().toISOString()
    const isoDate = raw.date
      ? String(raw.date).includes('T')
        ? String(raw.date)
        : new Date(String(raw.date) + 'T00:00:00.000Z').toISOString()
      : now

    // Pre-resolve accountCode to accountId if lines provide accountCode
    const rawLines = Array.isArray(raw.lines) ? (raw.lines as Array<Record<string, unknown>>) : []
    const resolvedLines = rawLines.map((l) => {
      let accountId = typeof l.accountId === 'string' ? l.accountId : undefined
      if (!accountId && typeof l.accountCode === 'string') {
        const found = db.get<{ id: string }>(
          'SELECT id FROM account WHERE workspace_id = ? AND code = ? AND deleted_at IS NULL',
          [workspaceId, l.accountCode],
        )
        if (found) accountId = found.id
      }
      return { ...l, accountId }
    })

    const parsed = createJournalEntrySchema.safeParse({
      ...raw,
      date: isoDate,
      lines: resolvedLines,
    })
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data
    const date = data.date.slice(0, 10)
    const description = data.description?.trim() || ''
    const reference = data.reference?.trim() || ''

    // Check period lock
    const lockRow = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
      'period_lock',
    ])
    if (lockRow?.value && date <= lockRow.value) {
      throw new ConflictError(
        'ACCOUNTING_PERIOD_LOCKED',
        `Accounting period is locked through ${lockRow.value}`,
      )
    }

    // Check line balance
    let totalDebit = 0
    let totalCredit = 0

    for (const l of rawLines) {
      const debit = Number(l.debit) || 0
      const credit = Number(l.credit) || 0
      if (debit < 0 || credit < 0) throw new ValidationError('Negative amounts are not allowed')
      if (debit > 0 && credit > 0)
        throw new ValidationError('Line cannot have both debit and credit')
      totalDebit += debit
      totalCredit += credit
    }

    if (totalDebit !== totalCredit) {
      throw new ConflictError(
        'JOURNAL_ENTRY_UNBALANCED',
        `Entry does not balance: total debit ${totalDebit} does not equal total credit ${totalCredit}`,
      )
    }

    return db.transaction(() => {
      const entryId = (raw.id as string) || generateUuid()
      const year = date.slice(0, 4)
      const count = db.get<{ count: number }>(
        'SELECT count(*) as count FROM journal_entry WHERE workspace_id = ? AND date LIKE ?',
        [workspaceId, `${year}%`],
      )
      const seq = (count?.count ?? 0) + 1
      const entryNumber =
        (raw.entryNumber as string) || `JV-${year}-${String(seq).padStart(6, '0')}`

      db.run(
        `INSERT INTO journal_entry (
          id, workspace_id, entry_number, date, description, reference, status,
          source_type, source_id, posted_at, created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'manual', NULL, ?, ?, ?, 'local', 'local_only')`,
        [entryId, workspaceId, entryNumber, date, description, reference, now, now, now],
      )

      for (const line of rawLines) {
        let accountId = line.accountId || ''
        if (!accountId && line.accountCode) {
          const acc = db.get<{ id: string }>(
            'SELECT id FROM account WHERE code = ? AND workspace_id = ? AND deleted_at IS NULL',
            [line.accountCode, workspaceId],
          )
          accountId = acc?.id || line.accountCode
        }

        db.run(
          `INSERT INTO journal_line (
            id, workspace_id, journal_id, account_id, debit, credit, description,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            generateUuid(),
            workspaceId,
            entryId,
            accountId,
            Number(line.debit) || 0,
            Number(line.credit) || 0,
            line.description || description,
            now,
            now,
          ],
        )
      }

      return {
        id: entryId,
        entryNumber,
        date,
        status: 'posted',
        totalDebit,
        totalCredit,
      }
    })
  })

  // ─── POST /accounting/journal/:id/reverse ───────────────────
  router.post('/accounting/journal/:id/reverse', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const { id } = params
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>
    const parsed = reverseJournalEntrySchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const data = parsed.data

    const entry = db.get<JournalEntryRow>(
      'SELECT * FROM journal_entry WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!entry) throw new NotFoundError('Journal entry', id)
    if (entry.status === 'reversed') throw new ConflictError('Entry is already reversed')

    const now = new Date().toISOString()
    const revDate = (data.date as string)?.slice(0, 10) || now.slice(0, 10)
    const reason = (data.reason as string) || `Reversal of ${entry.entry_number}`

    return db.transaction(() => {
      const lines = db.all<JournalLineRow>(
        'SELECT * FROM journal_line WHERE journal_id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [id, workspaceId],
      )

      const revId = generateUuid()
      const revNumber = `REV-${entry.entry_number || entry.id}`

      db.run(
        `INSERT INTO journal_entry (
          id, workspace_id, entry_number, date, description, reference, status,
          source_type, source_id, reversal_of, posted_at, created_at, updated_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'reversal', ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          revId,
          workspaceId,
          revNumber,
          revDate,
          reason,
          entry.entry_number || '',
          entry.source_id,
          id,
          now,
          now,
          now,
        ],
      )

      // Invert debit and credit lines
      for (const line of lines) {
        db.run(
          `INSERT INTO journal_line (
            id, workspace_id, journal_id, account_id, debit, credit, description,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            generateUuid(),
            workspaceId,
            revId,
            line.account_id,
            line.credit, // Debit becomes old Credit
            line.debit, // Credit becomes old Debit
            `Reversal of line in ${entry.entry_number}`,
            now,
            now,
          ],
        )
      }

      db.run("UPDATE journal_entry SET status = 'reversed', updated_at = ? WHERE id = ?", [now, id])

      return {
        id: revId,
        entryNumber: revNumber,
        reversalOf: id,
        status: 'posted',
      }
    })
  })

  // ─── GET /accounting/trial-balance ──────────────────────────
  router.get('/accounting/trial-balance', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId, baseCurrency } = ctx

    const toDate = query.date
      ? dateOnly(query.date)
      : query.toDate
        ? dateOnly(query.toDate)
        : dateOnly(new Date())
    const fromDate = query.fromDate ? dateOnly(query.fromDate) : null

    const dateClauses = ['je.date <= ?']
    const dateParams: unknown[] = [toDate]
    if (fromDate) {
      dateClauses.push('je.date >= ?')
      dateParams.push(fromDate)
    }

    const rows = db.all<{
      account_id: string
      code: string
      name: string
      type: AccountRootType
      debit: number
      credit: number
    }>(
      `SELECT
        a.id as account_id,
        a.code,
        a.name,
        a.type,
        coalesce(sum(jl.debit), 0) as debit,
        coalesce(sum(jl.credit), 0) as credit
       FROM account a
       LEFT JOIN journal_line jl ON jl.account_id = a.id AND jl.deleted_at IS NULL
       LEFT JOIN journal_entry je ON je.id = jl.journal_id AND je.status = 'posted' AND je.deleted_at IS NULL AND ${dateClauses.join(' AND ')}
       WHERE a.workspace_id = ? AND a.deleted_at IS NULL
       GROUP BY a.id, a.code, a.name, a.type
       ORDER BY a.code ASC`,
      [...dateParams, workspaceId],
    )

    let totalDebit = 0
    let totalCredit = 0
    let totalDebitBalance = 0
    let totalCreditBalance = 0

    const trialRows = rows.map((r) => {
      const debit = Number(r.debit) || 0
      const credit = Number(r.credit) || 0
      const net = round2(debit - credit)
      const debitBalance = net > 0 ? net : 0
      const creditBalance = net < 0 ? round2(-net) : 0
      const balance = naturalBalance(r.type, debit, credit)

      totalDebit += debit
      totalCredit += credit
      totalDebitBalance += debitBalance
      totalCreditBalance += creditBalance

      return {
        accountId: r.account_id,
        accountCode: r.code,
        accountName: r.name,
        accountType: r.type,
        debit,
        credit,
        balance,
        debitBalance,
        creditBalance,
        abnormal: balance < 0,
      }
    })

    totalDebit = round2(totalDebit)
    totalCredit = round2(totalCredit)
    totalDebitBalance = round2(totalDebitBalance)
    totalCreditBalance = round2(totalCreditBalance)

    const difference = round2(totalDebit - totalCredit)
    const isBalanced = difference === 0

    return {
      rows: trialRows,
      accounts: trialRows,
      totalDebit,
      totalCredit,
      difference,
      totalDebitBalance,
      totalCreditBalance,
      isBalanced,
      fromDate,
      toDate,
      currency: baseCurrency,
    }
  })

  // ─── GET /accounting/profit-report ──────────────────────────
  router.get('/accounting/profit-report', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId, baseCurrency } = ctx

    const from = query.from ? dateOnly(query.from) : `${dateOnly(new Date()).slice(0, 7)}-01`
    const to = query.to ? dateOnly(query.to) : dateOnly(new Date())
    const currency = query.currency?.trim() || baseCurrency

    // Fetch invoices in period
    const invoiceRows = db.all<{
      id: string
      currency: string
      subtotal: number
      discount_total: number
    }>(
      `SELECT id, currency, subtotal, discount_total
       FROM invoice
       WHERE workspace_id = ? AND date >= ? AND date <= ? AND status <> 'cancelled' AND deleted_at IS NULL AND type = 'sale'`,
      [workspaceId, from, to],
    )

    const matchingInvoices: ProfitInvoice[] = invoiceRows
      .filter((inv) => inv.currency === currency)
      .map((inv) => ({
        id: inv.id,
        currency: inv.currency,
        subtotal: inv.subtotal,
        discountTotal: inv.discount_total,
      }))

    const matchingIds = matchingInvoices.map((i) => i.id)
    const linesByInvoice = new Map<string, ProfitLine[]>()

    if (matchingIds.length > 0) {
      const placeholders = matchingIds.map(() => '?').join(', ')
      const lineRows = db.all<{
        invoice_id: string
        product_id: string | null
        product_name: string
        quantity: number
        total_price: number
      }>(
        `SELECT invoice_id, product_id, product_name, quantity, total_price
         FROM invoice_item
         WHERE invoice_id IN (${placeholders}) AND workspace_id = ? AND deleted_at IS NULL`,
        [...matchingIds, workspaceId],
      )

      for (const line of lineRows) {
        const list = linesByInvoice.get(line.invoice_id) ?? []
        list.push({
          invoiceId: line.invoice_id,
          productId: line.product_id,
          productName: line.product_name,
          quantity: Number(line.quantity),
          totalPrice: line.total_price,
        })
        linesByInvoice.set(line.invoice_id, list)
      }
    }

    // Fetch consumptions for these invoices
    let consumptions: ProfitConsumption[] = []
    if (matchingIds.length > 0) {
      const placeholders = matchingIds.map(() => '?').join(', ')
      const consRows = db.all<{
        consumer_id: string | null
        product_id: string
        quantity: number
        unit_cost: number
        is_shortfall: number
      }>(
        `SELECT consumer_id, product_id, quantity, unit_cost, is_shortfall
         FROM cost_consumption
         WHERE consumer_id IN (${placeholders}) AND workspace_id = ? AND deleted_at IS NULL`,
        [...matchingIds, workspaceId],
      )

      consumptions = consRows.map((r) => ({
        invoiceId: r.consumer_id,
        productId: r.product_id,
        amount: round2(Number(r.quantity) * Number(r.unit_cost)),
        isEstimated: Boolean(r.is_shortfall),
        quantity: Number(r.quantity),
      }))
    }

    const allLines: ProfitLine[] = Array.from(linesByInvoice.values()).flat()

    const report = buildProfitReport({
      from,
      to,
      currency,
      invoices: matchingInvoices,
      lines: allLines,
      consumptions,
      payrolls: [],
    })

    return report
  })

  // ─── GET /accounting/period-lock ─── & ─── PUT /accounting/period-lock ────────
  router.get('/accounting/period-lock', (c: RouteHandlerContext) => {
    const { db } = c
    const row = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['period_lock'])
    return { lockedUntil: row?.value ?? null }
  })

  router.put('/accounting/period-lock', (c: RouteHandlerContext) => {
    const { db, body } = c
    const raw = (body || {}) as Record<string, unknown>
    if (!raw.lockedUntil) {
      db.run('DELETE FROM meta WHERE key = ?', ['period_lock'])
      return { lockedUntil: null }
    }

    const isoDate = String(raw.lockedUntil).includes('T')
      ? String(raw.lockedUntil)
      : new Date(String(raw.lockedUntil) + 'T00:00:00.000Z').toISOString()

    const parsed = periodLockSchema.safeParse({ ...raw, lockedUntil: isoDate })
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      )
    }
    const lockedUntil = parsed.data.lockedUntil.slice(0, 10)

    db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['period_lock', lockedUntil])

    return { lockedUntil }
  })
}
