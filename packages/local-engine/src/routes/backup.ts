// ============================================
// packages/local-engine/src/routes/backup.ts
//
// Workspace data backup and export.
// Returns a full dump of local SQLite records in JSON format.
// Built dynamically from localTableSchema + sync_queue.
// ============================================

import { localTableSchema } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { restoreArchive } from '../export'
import type { ExportPackage } from '../export/types'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RestoreBody {
  archive?: unknown
}

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

  // ─── POST /workspaces/restore ─────────────────────────────────
  // The missing half of portability. The diagnostic dump above is
  // deliberately NOT restorable; this endpoint takes the checksummed portable
  // archive from `createExportPackage` and restores it into the current
  // workspace. The archive is validated before any write and the write is one
  // transaction, so a refused or interrupted restore leaves no half business.
  //
  // The workspace id is the caller's CONTEXT, never a field in the archive: a
  // file can be copied anywhere, but it can only land in the workspace the
  // signed-in device is currently pointing at.
  router.post('/workspaces/restore', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'backup.manage')

    const body = c.body as RestoreBody | null
    const archive = body?.archive as ExportPackage | undefined
    if (!archive || typeof archive !== 'object' || !archive.sections || !archive.metadata) {
      throw new ValidationError('RESTORE_ARCHIVE_MISSING')
    }

    try {
      return restoreArchive(c.db, archive, { expectedWorkspaceId: c.ctx.workspaceId })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = /^(RESTORE_[A-Z_]+)/.exec(message)?.[1] ?? 'RESTORE_FAILED'
      throw new ValidationError(message, undefined, code)
    }
  })
}
