// ============================================
// packages/local-engine/src/routes/invoices.ts
//
// Invoices management, atomic invoice creation with:
// 1. Line total derivation via computeItemTotal
// 2. Next invoice number from invoice_counter
// 3. Stock movements and warehouse inventory update
// 4. FIFO cost layer consumption (sales) / layer creation (purchases)
// 5. Balanced General Ledger posting
// 6. Reverse effects on cancellation
// ============================================

import {
  computeItemTotal,
  createInvoiceSchema,
  invoiceLedgerLines,
  planConsumption,
  round2,
  roundInvoiceMoney,
  sumInvoiceLines,
  type CostingMethod,
} from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface InvoiceRow {
  id: string
  workspace_id: string
  invoice_number: string | null
  external_number: string | null
  type: string
  customer_id: string | null
  customer_name: string | null
  supplier_id: string | null
  branch_id: string | null
  date: string
  due_date: string | null
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  paid_amount: number
  payment_method: string | null
  currency: string
  exchange_rate: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface InvoiceItemRow {
  id: string
  workspace_id: string
  invoice_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit: string | null
  unit_label: string | null
  weight_grams: number | null
  unit_price: number
  buy_price: number
  discount: number
  total_price: number
  notes: string | null
  sort_order: number
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

export function mapInvoiceItem(row: InvoiceItemRow) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoice_id: row.invoice_id,
    productId: row.product_id,
    product_id: row.product_id,
    productName: row.product_name,
    product_name: row.product_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPrice: row.unit_price,
    unit_price: row.unit_price,
    buyPrice: row.buy_price,
    buy_price: row.buy_price,
    discount: row.discount,
    totalPrice: row.total_price,
    total_price: row.total_price,
    notes: row.notes,
    sortOrder: row.sort_order,
  }
}

export function mapInvoice(
  row: InvoiceRow,
  items: InvoiceItemRow[] = [],
  customer?: { id: string; full_name: string; phone?: string | null; email?: string | null } | null,
) {
  const mappedItems = items.map(mapInvoiceItem)
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoice_number: row.invoice_number,
    externalNumber: row.external_number,
    type: row.type,
    customerId: row.customer_id,
    customer_id: row.customer_id,
    customerName: customer?.full_name || row.customer_name || null,
    customer: customer || null,
    supplierId: row.supplier_id,
    supplier_id: row.supplier_id,
    branchId: row.branch_id,
    date: row.date,
    dueDate: row.due_date,
    due_date: row.due_date,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    discount_total: row.discount_total,
    taxTotal: row.tax_total,
    tax_total: row.tax_total,
    total: row.total,
    paidAmount: row.paid_amount,
    paid_amount: row.paid_amount,
    paymentMethod: row.payment_method,
    payment_method: row.payment_method,
    currency: row.currency,
    exchangeRate: row.exchange_rate,
    exchange_rate: row.exchange_rate,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
    items: mappedItems,
    invoice_items: mappedItems,
  }
}

export function ensureDefaultAccounts(db: RouteHandlerContext['db'], workspaceId: string) {
  const defaults = [
    { code: '1010', name: 'صندوق نقدی', type: 'asset', role: 'cash' },
    { code: '1030', name: 'موجودی کالا (انبار)', type: 'asset', role: 'inventory' },
    { code: '1050', name: 'حساب‌های دریافتنی', type: 'asset', role: 'receivable' },
    { code: '2010', name: 'حساب‌های پرداختنی', type: 'liability', role: 'payable' },
    { code: '4010', name: 'درآمد فروش', type: 'revenue', role: 'sales' },
    { code: '5010', name: 'بهای تمام شده کالای فروش رفته', type: 'expense', role: 'cogs' },
  ]

  const now = new Date().toISOString()
  const accountMap: Record<string, string> = {}

  for (const acc of defaults) {
    let existing = db.get<{ id: string }>(
      'SELECT id FROM account WHERE workspace_id = ? AND code = ? AND deleted_at IS NULL',
      [workspaceId, acc.code],
    )
    if (!existing) {
      const id = generateUuid()
      db.run(
        `INSERT INTO account (id, workspace_id, code, name, type, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, workspaceId, acc.code, acc.name, acc.type, acc.role, now, now],
      )
      existing = { id }
    }
    accountMap[acc.role] = existing.id
  }

  return accountMap
}

export function registerInvoiceRoutes(router: Router): void {
  // ─── GET /invoices ──────────────────────────────────────────
  router.get('/invoices', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const { workspaceId } = ctx

    const search = query.search?.trim()
    const type = query.type?.trim()
    const status = query.status?.trim()
    const customerId = query.customerId?.trim()
    const supplierId = query.supplierId?.trim()
    const currency = query.currency?.trim()
    const dateFrom = query.dateFrom?.trim()
    const dateTo = query.dateTo?.trim()
    const minTotal = query.minTotal ? Number(query.minTotal) : undefined
    const maxTotal = query.maxTotal ? Number(query.maxTotal) : undefined
    const outstanding = query.outstanding === 'true' || query.outstanding === '1'
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
    const page = Math.max(Number(query.page) || 1, 1)
    const offset = (page - 1) * limit

    const clauses: string[] = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [workspaceId]

    if (search) {
      clauses.push('(invoice_number LIKE ? OR customer_name LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (type) {
      clauses.push('type = ?')
      params.push(type)
    }
    if (status) {
      clauses.push('status = ?')
      params.push(status)
    }
    if (customerId) {
      clauses.push('customer_id = ?')
      params.push(customerId)
    }
    if (supplierId) {
      clauses.push('supplier_id = ?')
      params.push(supplierId)
    }
    if (currency) {
      clauses.push('currency = ?')
      params.push(currency)
    }
    if (dateFrom) {
      clauses.push('date >= ?')
      params.push(dateFrom)
    }
    if (dateTo) {
      clauses.push('date <= ?')
      params.push(dateTo)
    }
    if (minTotal !== undefined) {
      clauses.push('total >= ?')
      params.push(minTotal)
    }
    if (maxTotal !== undefined) {
      clauses.push('total <= ?')
      params.push(maxTotal)
    }
    if (outstanding) {
      clauses.push('total > paid_amount AND status <> "cancelled"')
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    const countRow = db.get<{ count: number }>(
      `SELECT count(*) as count FROM invoice ${where}`,
      params,
    )
    const total = countRow?.count ?? 0

    const rows = db.all<InvoiceRow>(
      `SELECT * FROM invoice ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )

    // Load items for each invoice
    const invoices = rows.map((inv) => {
      const items = db.all<InvoiceItemRow>(
        'SELECT * FROM invoice_item WHERE invoice_id = ? AND workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC',
        [inv.id, workspaceId],
      )
      let customer = null
      if (inv.customer_id) {
        const cust = db.get<{
          id: string
          full_name: string
          phone: string | null
          email: string | null
        }>('SELECT id, full_name, phone, email FROM customer WHERE id = ?', [inv.customer_id])
        if (cust) customer = cust
      }
      return mapInvoice(inv, items, customer)
    })

    return {
      invoices,
      total,
      hasMore: offset + limit < total,
      nextCursor: null,
      limit,
    }
  })

  // ─── GET /invoices/:id ──────────────────────────────────────
  router.get('/invoices/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const inv = db.get<InvoiceRow>(
      'SELECT * FROM invoice WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!inv) throw new NotFoundError('Invoice', id)

    const items = db.all<InvoiceItemRow>(
      'SELECT * FROM invoice_item WHERE invoice_id = ? AND workspace_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC',
      [id, workspaceId],
    )

    let customer = null
    if (inv.customer_id) {
      const cust = db.get<{
        id: string
        full_name: string
        phone: string | null
        email: string | null
      }>('SELECT id, full_name, phone, email FROM customer WHERE id = ?', [inv.customer_id])
      if (cust) customer = cust
    }

    return mapInvoice(inv, items, customer)
  })

  // ─── GET /invoices/:id/related ──────────────────────────────
  router.get('/invoices/:id/related', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const inv = db.get<InvoiceRow>(
      'SELECT id, invoice_number, total, paid_amount, currency FROM invoice WHERE id = ? AND workspace_id = ?',
      [id, workspaceId],
    )
    if (!inv) throw new NotFoundError('Invoice', id)

    const allocations = db.all<{
      payment_id: string
      amount: number
      created_at: string
      payment_number: string
      entry_date: string
      method: string
    }>(
      `SELECT pa.payment_id, pa.amount, pa.created_at, p.payment_number, p.entry_date, p.method
       FROM payment_allocation pa
       JOIN payment p ON p.id = pa.payment_id
       WHERE pa.invoice_id = ? AND pa.workspace_id = ? AND pa.deleted_at IS NULL`,
      [id, workspaceId],
    )

    const journalEntry = db.get<{
      id: string
      entry_number: string
      date: string
      status: string
    }>(
      `SELECT id, entry_number, date, status
       FROM journal_entry
       WHERE source_type = 'invoice' AND source_id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [id, workspaceId],
    )

    return {
      payments: allocations.map((a) => ({
        paymentId: a.payment_id,
        paymentNumber: a.payment_number,
        amount: a.amount,
        entryDate: a.entry_date,
        method: a.method,
      })),
      journalEntry: journalEntry
        ? {
            id: journalEntry.id,
            entryNumber: journalEntry.entry_number,
            date: journalEntry.date,
            status: journalEntry.status,
          }
        : null,
    }
  })

  // ─── POST /invoices ─────────────────────────────────────────
  router.post('/invoices', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const { workspaceId } = ctx
    const raw = (body || {}) as Record<string, unknown>

    const parsed = createInvoiceSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new ValidationError(msg)
    }
    const data = parsed.data

    const type = data.type || 'sale'
    const booksCurrency = ctx.baseCurrency
    const currency = data.currency?.trim() || booksCurrency
    const isForeign = currency !== booksCurrency
    const rawRate =
      data.exchangeRate ??
      (typeof raw.exchange_rate === 'number' || typeof raw.exchange_rate === 'string'
        ? Number(raw.exchange_rate)
        : undefined)
    const exchangeRate = isForeign ? Number(rawRate) : 1.0

    if (isForeign && (!(exchangeRate > 0) || !Number.isFinite(exchangeRate))) {
      throw new ValidationError('INVOICE_EXCHANGE_RATE_REQUIRED')
    }
    const storedExchangeRate = isForeign ? exchangeRate : null

    const now = new Date().toISOString()
    const date = typeof data.date === 'string' ? data.date.slice(0, 10) : now.slice(0, 10)
    const dueDate = typeof data.dueDate === 'string' ? data.dueDate.slice(0, 10) : null
    const customerId = data.customerId || null
    const supplierId = data.supplierId || null
    const branchId = data.branchId || null
    const notes = data.notes || null
    const paymentMethod = data.paymentMethod || 'cash'
    const rawItems = data.items

    return db.transaction(() => {
      // 1. Next invoice number from counter
      const prefix = type === 'purchase' ? 'PUR' : 'INV'
      const counterRow = db.get<{ next: number }>(
        'SELECT next FROM invoice_counter WHERE workspace_id = ? AND prefix = ?',
        [workspaceId, prefix],
      )
      const nextNum = counterRow ? counterRow.next : 1
      const invoiceNumber =
        (typeof raw.invoiceNumber === 'string' ? raw.invoiceNumber : undefined) ||
        (typeof raw.invoice_number === 'string' ? raw.invoice_number : undefined) ||
        `${prefix}-${String(nextNum).padStart(5, '0')}`

      db.run(
        `INSERT INTO invoice_counter (workspace_id, prefix, next, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(workspace_id, prefix) DO UPDATE SET next = next + 1, updated_at = excluded.updated_at`,
        [workspaceId, prefix, nextNum + 1, now],
      )

      // 2. Derive line totals with computeItemTotal and calculate header totals
      const derivedItems = rawItems.map((item, index) => {
        const qty = Number(item.quantity) || 0
        const unitPrice = Number(item.unitPrice) || 0
        const discount = Number(item.discount) || 0
        const derivedTotal = computeItemTotal({ quantity: qty, unitPrice, discount })
        const roundedTotal = roundInvoiceMoney(derivedTotal, currency)

        return {
          id: item.id || generateUuid(),
          productId: item.productId || null,
          productName: String(item.productName || 'کالا').trim(),
          quantity: qty,
          unit: (item.unit as string) || 'piece',
          unitPrice,
          buyPrice: 0,
          discount,
          totalPrice: roundedTotal,
          notes: item.notes || null,
          sortOrder: index,
        }
      })

      const lineTotals = derivedItems.map((i) => i.totalPrice)
      const calculatedMoney = sumInvoiceLines({
        lineTotals,
        discountTotal: Number(raw.discountTotal ?? raw.discount_total) || 0,
        taxRate: Number(raw.taxRate ?? raw.tax_rate) || 0,
        taxTotal: Number(raw.taxTotal ?? raw.tax_total) || 0,
        currency,
      })

      const subtotal = calculatedMoney.subtotal
      const discountTotal = calculatedMoney.discountTotal
      const taxTotal = calculatedMoney.taxTotal
      const total = calculatedMoney.total

      const invoiceId = (raw.id as string) || generateUuid()

      // Customer name resolution
      let customerName = (raw.customerName as string) || (raw.customer_name as string) || null
      if (customerId && !customerName) {
        const cust = db.get<{ full_name: string }>('SELECT full_name FROM customer WHERE id = ?', [
          customerId,
        ])
        if (cust) customerName = cust.full_name
      }

      // 3. Insert invoice row
      db.run(
        `INSERT INTO invoice (
          id, workspace_id, invoice_number, external_number, type, customer_id, customer_name,
          supplier_id, branch_id, date, due_date, subtotal, discount_total, tax_total, total,
          paid_amount, payment_method, currency, exchange_rate, status, notes, created_at, updated_at,
          origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'pending', ?, ?, ?, 'local', 'local_only')`,
        [
          invoiceId,
          workspaceId,
          invoiceNumber,
          (typeof raw.externalNumber === 'string' ? raw.externalNumber : null) || null,
          type,
          customerId,
          customerName,
          supplierId,
          branchId,
          date,
          dueDate,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          paymentMethod,
          currency,
          storedExchangeRate,
          notes,
          now,
          now,
        ],
      )

      // 4. Insert invoice items
      for (const item of derivedItems) {
        db.run(
          `INSERT INTO invoice_item (
            id, workspace_id, invoice_id, product_id, product_name, quantity, unit,
            unit_price, buy_price, discount, total_price, notes, sort_order,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [
            item.id,
            workspaceId,
            invoiceId,
            item.productId,
            item.productName,
            item.quantity,
            item.unit,
            item.unitPrice,
            item.buyPrice,
            item.discount,
            item.totalPrice,
            item.notes,
            item.sortOrder,
            now,
            now,
          ],
        )

        // 5. Stock movements & Warehouse inventory
        if (item.productId && item.quantity > 0) {
          const movId = generateUuid()
          const movType = type === 'purchase' ? 'purchase' : 'sale'
          db.run(
            `INSERT INTO inventory_movement (
              id, workspace_id, product_id, type, quantity, reference, date,
              created_at, updated_at, origin, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
            [
              movId,
              workspaceId,
              item.productId,
              movType,
              item.quantity,
              invoiceNumber,
              date,
              now,
              now,
            ],
          )

          // Update product total quantity
          const qtyDelta = type === 'purchase' ? item.quantity : -item.quantity
          db.run(
            'UPDATE product SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
            [qtyDelta, now, item.productId, workspaceId],
          )

          // Target warehouse
          const targetWh = data.warehouseId || null
          if (targetWh) {
            db.run(
              `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(workspace_id, product_id, warehouse_id) DO UPDATE SET qty = qty + ?, updated_at = excluded.updated_at`,
              [generateUuid(), workspaceId, item.productId, targetWh, qtyDelta, now, now, qtyDelta],
            )
          }
        }
      }

      // 6. Cost layers (FIFO or AVCO based on inventory_settings)
      let costOfGoodsSold = 0

      const setting = db.get<{ costing_method: string }>(
        'SELECT costing_method FROM inventory_settings WHERE workspace_id = ?',
        [workspaceId],
      )
      const costingMethod = (setting?.costing_method as CostingMethod) || 'fifo'

      if (type === 'purchase') {
        // Purchases create cost layers (in books currency)
        for (const item of derivedItems) {
          if (item.productId && item.quantity > 0) {
            const layerId = generateUuid()
            const layerUnitCost = round2(item.unitPrice * exchangeRate)
            db.run(
              `INSERT INTO cost_layer (
                id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line,
                received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at,
                origin, sync_state
              ) VALUES (?, ?, ?, ?, 'invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
              [
                layerId,
                workspaceId,
                item.productId,
                data.warehouseId || null,
                invoiceId,
                item.id,
                item.quantity,
                item.quantity,
                layerUnitCost,
                booksCurrency,
                date,
                now,
                now,
              ],
            )
          }
        }
      } else {
        // Sales consume cost layers via configured costing method (FIFO or AVCO)
        for (const item of derivedItems) {
          if (item.productId && item.quantity > 0) {
            const layers = db.all<{
              id: string
              product_id: string
              warehouse_id: string | null
              remaining_qty: number
              unit_cost: number
              entry_date: string
              created_at: string
            }>(
              `SELECT id, product_id, warehouse_id, remaining_qty, unit_cost, entry_date, created_at
               FROM cost_layer
               WHERE workspace_id = ? AND product_id = ? AND remaining_qty > 0 AND deleted_at IS NULL
               ORDER BY entry_date ASC, created_at ASC`,
              [workspaceId, item.productId],
            )

            const plan = planConsumption(
              layers.map((l) => ({
                id: l.id,
                productId: l.product_id,
                warehouseId: l.warehouse_id,
                remainingQty: Number(l.remaining_qty),
                unitCost: l.unit_cost,
                entryDate: l.entry_date,
                createdAt: l.created_at,
              })),
              item.quantity,
              { method: costingMethod },
            )

            costOfGoodsSold += plan.totalCost

            for (const step of plan.steps) {
              if (step.layerId && step.quantity > 0) {
                db.run(
                  'UPDATE cost_layer SET remaining_qty = remaining_qty - ?, updated_at = ? WHERE id = ?',
                  [step.quantity, now, step.layerId],
                )

                db.run(
                  `INSERT INTO cost_consumption (
                    id, workspace_id, layer_id, product_id, warehouse_id, consumer_type,
                    consumer_id, consumer_line, quantity, unit_cost, currency, entry_date,
                    created_at, updated_at, origin, sync_state
                  ) VALUES (?, ?, ?, ?, ?, 'invoice', ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
                  [
                    generateUuid(),
                    workspaceId,
                    step.layerId,
                    item.productId,
                    data.warehouseId || null,
                    invoiceId,
                    item.id,
                    step.quantity,
                    step.unitCost,
                    booksCurrency,
                    date,
                    now,
                    now,
                  ],
                )
              }
            }
          }
        }
      }

      // 7. General Ledger Posting
      const accounts = ensureDefaultAccounts(db, workspaceId)
      const ledgerLines = invoiceLedgerLines({
        isPurchase: type === 'purchase',
        total: roundInvoiceMoney(total * exchangeRate, booksCurrency),
        costOfGoodsSold:
          costOfGoodsSold > 0 ? roundInvoiceMoney(costOfGoodsSold, booksCurrency) : undefined,
        accounts,
      })

      if (ledgerLines.length > 0) {
        const journalId = generateUuid()
        const journalNumber = `J-${date.slice(0, 4)}-${invoiceNumber}`

        db.run(
          `INSERT INTO journal_entry (
            id, workspace_id, entry_number, date, description, reference, status,
            source_type, source_id, posted_at, created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'invoice', ?, ?, ?, ?, 'local', 'local_only')`,
          [
            journalId,
            workspaceId,
            journalNumber,
            date,
            `فاکتور ${invoiceNumber}`,
            invoiceNumber,
            invoiceId,
            now,
            now,
            now,
          ],
        )

        for (const line of ledgerLines) {
          db.run(
            `INSERT INTO journal_line (
              id, workspace_id, journal_id, account_id, debit, credit, description,
              created_at, updated_at, origin, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
            [
              generateUuid(),
              workspaceId,
              journalId,
              line.accountId,
              line.debit,
              line.credit,
              `فاکتور ${invoiceNumber}`,
              now,
              now,
            ],
          )
        }
      }

      // 8. Payment settlement if paidAmount > 0 or payments array provided
      const paidInput = Number(raw.paidAmount ?? raw.paid_amount) || 0
      if (paidInput > 0) {
        const paymentAmount = Math.min(paidInput, total)
        const paymentId = generateUuid()
        const paymentNumber = `PAY-${invoiceNumber}`
        const partyType = type === 'purchase' ? 'supplier' : 'customer'
        const partyId = type === 'purchase' ? supplierId : customerId
        const direction = type === 'purchase' ? 'out' : 'in'

        db.run(
          `INSERT INTO payment (
            id, workspace_id, payment_number, direction, party_type, party_id,
            amount, currency, method, entry_date, reference, notes, status,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?, 'local', 'local_only')`,
          [
            paymentId,
            workspaceId,
            paymentNumber,
            direction,
            partyType,
            partyId,
            paymentAmount,
            currency,
            paymentMethod,
            date,
            invoiceNumber,
            'پرداخت در زمان ثبت فاکتور',
            now,
            now,
          ],
        )

        db.run(
          `INSERT INTO payment_allocation (
            id, workspace_id, payment_id, invoice_id, amount,
            created_at, updated_at, origin, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
          [generateUuid(), workspaceId, paymentId, invoiceId, paymentAmount, now, now],
        )

        const newStatus = paymentAmount >= total ? 'completed' : 'partial'
        db.run('UPDATE invoice SET paid_amount = ?, status = ?, updated_at = ? WHERE id = ?', [
          paymentAmount,
          newStatus,
          now,
          invoiceId,
        ])
      }

      const created = db.get<InvoiceRow>('SELECT * FROM invoice WHERE id = ?', [invoiceId])
      const createdItems = db.all<InvoiceItemRow>(
        'SELECT * FROM invoice_item WHERE invoice_id = ? ORDER BY sort_order ASC',
        [invoiceId],
      )

      return mapInvoice(created!, createdItems)
    })
  })

  // ─── POST /invoices/:id/cancel ─── & ─── DELETE /invoices/:id ─────────────────
  const cancelHandler = (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const { id } = params
    const { workspaceId } = ctx

    const inv = db.get<InvoiceRow>(
      'SELECT * FROM invoice WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [id, workspaceId],
    )
    if (!inv) throw new NotFoundError('Invoice', id)
    if (inv.status === 'cancelled') return { success: true }

    const now = new Date().toISOString()

    return db.transaction(() => {
      // 1. Reverse stock movements & product quantities
      const items = db.all<InvoiceItemRow>(
        'SELECT * FROM invoice_item WHERE invoice_id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [id, workspaceId],
      )

      // Determine assigned warehouse from cost records if present
      const assignedWarehouse =
        (inv.type === 'purchase'
          ? db.get<{ warehouse_id: string }>(
              "SELECT warehouse_id FROM cost_layer WHERE source_type = 'invoice' AND source_id = ? AND workspace_id = ? AND warehouse_id IS NOT NULL LIMIT 1",
              [id, workspaceId],
            )?.warehouse_id
          : db.get<{ warehouse_id: string }>(
              "SELECT warehouse_id FROM cost_consumption WHERE consumer_type = 'invoice' AND consumer_id = ? AND workspace_id = ? AND warehouse_id IS NOT NULL LIMIT 1",
              [id, workspaceId],
            )?.warehouse_id) ?? null

      for (const item of items) {
        if (item.product_id && item.quantity > 0) {
          const qtyDelta = inv.type === 'purchase' ? -item.quantity : item.quantity

          db.run(
            'UPDATE product SET quantity = quantity + ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
            [qtyDelta, now, item.product_id, workspaceId],
          )

          // Reverse in product_stock if warehouse was assigned
          if (assignedWarehouse) {
            db.run(
              `UPDATE product_stock SET qty = qty + ?, updated_at = ?
               WHERE workspace_id = ? AND product_id = ? AND warehouse_id = ? AND deleted_at IS NULL`,
              [qtyDelta, now, workspaceId, item.product_id, assignedWarehouse],
            )
          }
        }
      }

      // Delete/archive invoice movements
      db.run('DELETE FROM inventory_movement WHERE reference = ? AND workspace_id = ?', [
        inv.invoice_number,
        workspaceId,
      ])

      // 2. Release cost layers
      if (inv.type === 'purchase') {
        // Delete or zero cost layers created by this purchase
        db.run(
          "UPDATE cost_layer SET remaining_qty = 0, deleted_at = ?, updated_at = ? WHERE source_type = 'invoice' AND source_id = ? AND workspace_id = ?",
          [now, now, id, workspaceId],
        )
      } else {
        // Restore remaining_qty for consumed layers
        const consumptions = db.all<{ layer_id: string; quantity: number }>(
          "SELECT layer_id, quantity FROM cost_consumption WHERE consumer_type = 'invoice' AND consumer_id = ? AND workspace_id = ?",
          [id, workspaceId],
        )
        for (const cons of consumptions) {
          db.run(
            'UPDATE cost_layer SET remaining_qty = remaining_qty + ?, updated_at = ? WHERE id = ?',
            [cons.quantity, now, cons.layer_id],
          )
        }
        db.run(
          "DELETE FROM cost_consumption WHERE consumer_type = 'invoice' AND consumer_id = ? AND workspace_id = ?",
          [id, workspaceId],
        )
      }

      // 3. Reverse journal entry
      const journalEntry = db.get<{ id: string }>(
        "SELECT id FROM journal_entry WHERE source_type = 'invoice' AND source_id = ? AND workspace_id = ? AND status = 'posted'",
        [id, workspaceId],
      )
      if (journalEntry) {
        db.run("UPDATE journal_entry SET status = 'reversed', updated_at = ? WHERE id = ?", [
          now,
          journalEntry.id,
        ])
      }

      // 4. Cancel payment allocations
      const allocations = db.all<{ id: string; payment_id: string }>(
        'SELECT id, payment_id FROM payment_allocation WHERE invoice_id = ? AND workspace_id = ?',
        [id, workspaceId],
      )
      for (const a of allocations) {
        db.run("UPDATE payment SET status = 'cancelled', updated_at = ? WHERE id = ?", [
          now,
          a.payment_id,
        ])
        db.run('DELETE FROM payment_allocation WHERE id = ?', [a.id])
      }

      // 5. Mark invoice cancelled
      db.run(
        "UPDATE invoice SET status = 'cancelled', paid_amount = 0, updated_at = ? WHERE id = ?",
        [now, id],
      )

      return { success: true }
    })
  }

  router.post('/invoices/:id/cancel', cancelHandler)
  router.delete('/invoices/:id', (c: RouteHandlerContext) => {
    cancelHandler(c)
    return { __status: 204, __data: null }
  })
}
