// ============================================
// backend/src/services/workspace/backup.service.ts
//
// G7 — a backup that contains the business's actual data.
//
// ---------------------------------------------------------------------------
// WHAT THE BUTTON DID BEFORE
//
// «دانلود پشتیبان» in settings called `useBackupStore().exportData()`, which
// returns:
//
//     JSON.stringify({ backups: state.backups, auditLog: state.auditLog, … })
//
// `state.backups` is the LIST OF PREVIOUS BACKUP ENTRIES held in localStorage.
// So the file was a list of metadata about backups that had never contained
// anything, plus a client-side audit log. Zero invoices. Zero customers. Zero
// products. Zero payments.
//
// It downloaded successfully, it was named `hisabche-backup-<date>.json`, and
// it would have been discovered worthless at exactly the moment someone needed
// it. That is worse than having no backup button at all, because a shopkeeper
// who has one does not look for another.
//
// ---------------------------------------------------------------------------
// WHAT THIS EXPORTS, AND WHAT IT DELIBERATELY DOES NOT
//
// Included: the rows a business would need to reconstruct its books —
// documents, parties, catalogue, money, and the ledger.
//
// NOT included:
//   • Anything from another workspace. Every query is `.eq('workspace_id', …)`
//     and the id comes from the verified request context, never the request.
//   • Projections that are DERIVED and would conflict on restore —
//     `warehouse_stock` is a projection of `stock_movements` (Phase C) and
//     `paid_amount` of `payment_allocations` (Phase F). The sources are
//     exported; the caches are not, because a restore that loaded both could
//     load them disagreeing.
//   • Credentials of any kind. No tokens, no API keys, no password hashes.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS IS AN EXPORT, NOT A RESTORE
//
// There is no import path, and this does not pretend there is. The file is a
// record a person can read, hand to an accountant, or use to rebuild by hand.
// Calling it a backup while nothing can read it back would be the same lie one
// level further on — so the response says so, in `restorable: false`.
// ============================================

import { supabase } from '../../db'
import { ForbiddenError } from '../../errors/auth.error'
import type { TenancyContext } from '../tenancy.service'

/**
 * Per-table cap.
 *
 * A single unbounded select over a large workspace's invoices would hold the
 * whole table in memory and time out behind a proxy. Capped, reported, and the
 * caller is TOLD which tables were cut — a silently short backup is the same
 * failure mode as the empty one this replaces.
 */
const ROW_CAP = 5000

interface TableSpec {
  /** Key in the exported object. */
  name: string
  /** Physical table. */
  table: string
  /** Columns, or `*`. Named where secrets or noise must be left out. */
  columns: string
  /** Column to order by, so two exports of unchanged data compare equal. */
  orderBy: string
}

/**
 * What gets exported.
 *
 * Ordered roughly parent-before-child so a human reading the file top to bottom
 * meets a customer before the invoice that names them.
 */
const TABLES: TableSpec[] = [
  { name: 'customers', table: 'customers', columns: '*', orderBy: 'created_at' },
  { name: 'suppliers', table: 'suppliers', columns: '*', orderBy: 'created_at' },
  { name: 'products', table: 'products', columns: '*', orderBy: 'created_at' },
  { name: 'warehouses', table: 'warehouses', columns: '*', orderBy: 'created_at' },
  { name: 'invoices', table: 'invoices', columns: '*', orderBy: 'created_at' },
  { name: 'invoiceItems', table: 'invoice_items', columns: '*', orderBy: 'id' },
  { name: 'payments', table: 'payments', columns: '*', orderBy: 'created_at' },
  {
    name: 'paymentAllocations',
    table: 'payment_allocations',
    columns: '*',
    orderBy: 'created_at',
  },
  // The source of truth for quantity (Phase C). `warehouse_stock` and
  // `products.quantity` are projections of these rows and are not exported
  // separately — see the header.
  { name: 'stockMovements', table: 'stock_movements', columns: '*', orderBy: 'created_at' },
  { name: 'accounts', table: 'accounts', columns: '*', orderBy: 'code' },
  { name: 'journalEntries', table: 'journal_entries', columns: '*', orderBy: 'date' },
  { name: 'journalLines', table: 'journal_lines', columns: '*', orderBy: 'id' },
  { name: 'employees', table: 'employees', columns: '*', orderBy: 'created_at' },
  { name: 'branches', table: 'branches', columns: '*', orderBy: 'created_at' },
  { name: 'purchaseOrders', table: 'purchase_orders', columns: '*', orderBy: 'created_at' },
]

export interface BackupTableResult {
  rows: unknown[]
  count: number
  /** True when `ROW_CAP` cut the table short. */
  truncated: boolean
  /** Present when the table could not be read — a missing migration, say. */
  error?: string
}

export interface WorkspaceBackup {
  meta: {
    workspaceId: string
    exportedAt: string
    /** Bumped when the SHAPE changes, so a reader can tell versions apart. */
    schemaVersion: string
    /**
     * ⚠️ FALSE. There is no import path. Stated in the file itself so nobody
     * discovers it at the moment they need it.
     */
    restorable: false
    /** Tables that hit the cap, by name. Empty means the export is complete. */
    truncatedTables: string[]
    /** Tables that could not be read at all, with the reason. */
    failedTables: { name: string; error: string }[]
    totalRows: number
  }
  data: Record<string, unknown[]>
}

export class BackupService {
  async export(ctx: TenancyContext): Promise<WorkspaceBackup> {
    // Owner only. A backup is every figure in the business in one file — the
    // most concentrated export the product can produce, and not something a
    // seller should be able to walk out with.
    if (ctx.role !== 'owner') {
      // `ForbiddenError` — 403. Not a `DatabaseError`, which is a 500 and would
      // report a deliberate refusal as a server fault.
      throw new ForbiddenError('BACKUP_FORBIDDEN: only a workspace owner may export a backup')
    }

    const results = await Promise.all(
      TABLES.map(async (spec) => ({ spec, result: await this.readTable(ctx, spec) })),
    )

    const data: Record<string, unknown[]> = {}
    const truncatedTables: string[] = []
    const failedTables: { name: string; error: string }[] = []
    let totalRows = 0

    for (const { spec, result } of results) {
      data[spec.name] = result.rows
      totalRows += result.count
      if (result.truncated) truncatedTables.push(spec.name)
      if (result.error) failedTables.push({ name: spec.name, error: result.error })
    }

    return {
      meta: {
        workspaceId: ctx.workspaceId,
        exportedAt: new Date().toISOString(),
        schemaVersion: '1',
        restorable: false,
        truncatedTables,
        failedTables,
        totalRows,
      },
      data,
    }
  }

  /**
   * One table's rows for this workspace.
   *
   * A failure on ONE table does not fail the export. A workspace that has not
   * run every migration is missing a table, and refusing the whole backup over
   * it would leave that business with nothing — which is the state this
   * feature exists to end. The gap is reported in `meta.failedTables` instead,
   * so the file says what it is missing rather than pretending to be complete.
   */
  private async readTable(ctx: TenancyContext, spec: TableSpec): Promise<BackupTableResult> {
    const { data, error } = await supabase
      .from(spec.table)
      .select(spec.columns)
      .eq('workspace_id', ctx.workspaceId)
      .order(spec.orderBy, { ascending: true })
      .limit(ROW_CAP + 1)

    if (error) {
      return { rows: [], count: 0, truncated: false, error: error.message }
    }

    const rows = data ?? []
    const truncated = rows.length > ROW_CAP

    return {
      // The extra row is fetched only to DETECT the cap, never returned — a
      // count of exactly ROW_CAP with `truncated: false` would be ambiguous.
      rows: truncated ? rows.slice(0, ROW_CAP) : rows,
      count: truncated ? ROW_CAP : rows.length,
      truncated,
    }
  }
}
