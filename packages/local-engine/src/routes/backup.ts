// ============================================
// packages/local-engine/src/routes/backup.ts
//
// Workspace data backup and export.
// Returns a full dump of local SQLite records in JSON format.
// ============================================

import { requireCapability } from '../auth'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export function registerBackupRoutes(router: Router): void {
  // ─── GET /workspaces/backup ──────────────────────────────────
  router.get('/workspaces/backup', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const ws = ctx.workspaceId

    requireCapability(ctx, 'backup.manage')

    const customers = db.all(
      'SELECT * FROM customer WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const products = db.all(
      'SELECT * FROM product WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const warehouses = db.all(
      'SELECT * FROM warehouse WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const invoices = db.all(
      'SELECT * FROM invoice WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const invoiceItems = db.all(
      'SELECT * FROM invoice_item WHERE workspace_id = ? ORDER BY id ASC',
      [ws],
    )
    const payments = db.all(
      'SELECT * FROM payment WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const paymentAllocations = db.all(
      'SELECT * FROM payment_allocation WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const stockMovements = db.all(
      'SELECT * FROM inventory_movement WHERE workspace_id = ? ORDER BY created_at ASC',
      [ws],
    )
    const accounts = db.all('SELECT * FROM account WHERE workspace_id = ? ORDER BY code ASC', [ws])
    const journalEntries = db.all(
      'SELECT * FROM journal_entry WHERE workspace_id = ? ORDER BY date ASC',
      [ws],
    )
    const journalLines = db.all(
      'SELECT * FROM journal_line WHERE workspace_id = ? ORDER BY id ASC',
      [ws],
    )
    const exchangeRates = db.all(
      'SELECT * FROM exchange_rate WHERE workspace_id = ? ORDER BY rate_date ASC',
      [ws],
    )

    const totalRows =
      customers.length +
      products.length +
      warehouses.length +
      invoices.length +
      invoiceItems.length +
      payments.length +
      paymentAllocations.length +
      stockMovements.length +
      accounts.length +
      journalEntries.length +
      journalLines.length +
      exchangeRates.length

    return {
      meta: {
        workspaceId: ws,
        exportedAt: new Date().toISOString(),
        schemaVersion: '3.0',
        restorable: false,
        truncatedTables: [],
        failedTables: [],
        totalRows,
      },
      customers,
      products,
      warehouses,
      invoices,
      invoiceItems,
      payments,
      paymentAllocations,
      stockMovements,
      accounts,
      journalEntries,
      journalLines,
      exchangeRates,
    }
  })
}
