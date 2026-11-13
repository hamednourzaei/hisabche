// ============================================
// packages/local-engine/src/routes/backup.ts
//
// Workspace data backup and export.
// Returns a full dump of local SQLite records in JSON format.
// Built dynamically from localTableSchema + sync_queue.
// ============================================

import { localTableSchema } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export function registerBackupRoutes(router: Router): void {
  // ─── GET /workspaces/backup ──────────────────────────────────
  router.get('/workspaces/backup', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const ws = ctx.workspaceId

    requireCapability(ctx, 'backup.manage')

    const tableNames: string[] = [...localTableSchema.options, 'sync_queue']
    const resultData: Record<string, unknown[]> = {}
    const failedTables: string[] = []
    const truncatedTables: string[] = []
    let totalRows = 0

    // Fetch master list of actual tables present in SQLite
    const existingTables = new Set(
      db
        .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
        .map((r) => r.name),
    )

    for (const table of tableNames) {
      if (!existingTables.has(table)) {
        // Table not created in this local SQLite schema
        resultData[table] = []
        continue
      }

      try {
        const columns = db.all<{ name: string }>(`PRAGMA table_info("${table}")`).map((c) => c.name)
        const hasWorkspaceId = columns.includes('workspace_id')

        let rows: unknown[]
        if (hasWorkspaceId) {
          const hasCreatedAt = columns.includes('created_at')
          const orderClause = hasCreatedAt ? 'ORDER BY created_at ASC' : ''
          rows = db.all(`SELECT * FROM "${table}" WHERE workspace_id = ? ${orderClause}`, [ws])
        } else {
          rows = db.all(`SELECT * FROM "${table}"`)
        }

        resultData[table] = rows
        totalRows += rows.length
      } catch {
        failedTables.push(table)
        resultData[table] = []
      }
    }

    // Maintain backwards-compatible legacy keys
    resultData.customers = resultData.customer ?? []
    resultData.products = resultData.product ?? []
    resultData.warehouses = resultData.warehouse ?? []
    resultData.invoices = resultData.invoice ?? []
    resultData.invoiceItems = resultData.invoice_item ?? []
    resultData.payments = resultData.payment ?? []
    resultData.paymentAllocations = resultData.payment_allocation ?? []
    resultData.stockMovements = resultData.inventory_movement ?? []
    resultData.accounts = resultData.account ?? []
    resultData.journalEntries = resultData.journal_entry ?? []
    resultData.journalLines = resultData.journal_line ?? []
    resultData.exchangeRates = resultData.exchange_rate ?? []

    return {
      meta: {
        workspaceId: ws,
        exportedAt: new Date().toISOString(),
        schemaVersion: '3.0',
        restorable: false,
        truncatedTables,
        failedTables,
        totalRows,
      },
      ...resultData,
    }
  })
}
