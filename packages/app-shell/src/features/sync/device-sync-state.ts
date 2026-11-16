// ============================================
// What the device knows.
//
// A device that has never pulled a table does not know that the table is
// empty, and it must not say so: a list that answers "nothing here" when the
// device was never filled shows a shopkeeper an empty business.
//
// The sync engine records what it has pulled; the readers ask.
//
// V68.1: the answer is PER WORKSPACE and SURVIVES A RELOAD. It is kept in the
// device's own SQLite (`meta`, through the bridge) next to the rows it
// describes, and the host deletes it in the same transaction that purges those
// rows on a workspace switch — a stamp can never outlive its table.
// ============================================

import type { DeviceOperation } from '@hisabche/api'
import type { LocalTable } from '@hisabche/app-bridge'
import { useWorkspaceStore } from '@hisabche/store'

import { bridge } from '@/shared/lib/bridge'

/** `${workspaceId}:${table}` → pulledAt (ISO). Filled by the pull and by `loadSyncedTables`. */
const synced = new Map<string, string>()

/**
 * Every table the local route of `operation` reads. Closed list per operation.
 *
 * Guarded against the route's own source (`device-operation-reads.test.ts`):
 * a table the route starts reading without a row here turns the suite red.
 */
export const DEVICE_OPERATION_READS: Readonly<Record<DeviceOperation, readonly LocalTable[]>> = {
  'invoice.create': [
    'product',
    'customer',
    'warehouse',
    'inventory_settings',
    'inventory_movement',
    'invoice_counter',
    'cost_layer',
    'cost_consumption',
    'invoice',
    'invoice_item',
    'payment',
    'payment_allocation',
    'exchange_rate',
    'account',
    'journal_entry',
    'journal_line',
    'package_credit_ledger',
    'order_deposits',
    'stock_serials',
    'stock_batches',
    'lot_allocations',
  ],
  'payment.record': [
    'customer',
    'invoice',
    'payment',
    'payment_allocation',
    'account',
    'journal_entry',
    'journal_line',
  ],
  'invoice.return': [
    'invoice',
    'invoice_item',
    'product',
    'customer',
    'cost_layer',
    'cost_consumption',
    'invoice_returns',
    'invoice_return_lines',
    'account',
    'journal_entry',
    'journal_line',
  ],
}

/**
 * The tables the pull delivers — the same list as `DELTA_ENTITIES` in
 * `sync-engine.ts` (the guard compares the two sources).
 *
 * ⚠️ READINESS CAN ONLY BE ASKED OF THESE. A table no pull ever fills can never
 * be stamped, so requiring it would make `deviceReadyFor` false for ever and
 * the whole device-first path dead code with a green suite.
 */
export const PULLED_TABLES: readonly LocalTable[] = [
  'product',
  'customer',
  'warehouse',
  'product_stock',
  'invoice',
  'branch',
  'exchange_rate',
  'order_deposits',
  'order_deposit_applications',
  'order_deposit_refunds',
  // V70.2 closed four of the gaps below: a variant, a delivered session, a
  // package credit entry and a repair ticket now arrive through the same pull.
  // `package_credit_ledger` used to sit in `NOT_PULLED_YET`.
  'product_variants',
  'service_delivery_sessions',
  'package_credit_ledger',
  'repair_tickets',
]

/**
 * Tables a local route reads that the DEVICE writes itself: its own counter,
 * its own movements, its own postings. Nothing to wait for.
 * (`invoice_item` arrives inside the invoice pull.)
 */
export const DEVICE_WRITTEN_TABLES: readonly LocalTable[] = [
  'invoice_item',
  'invoice_counter',
  'inventory_movement',
  'cost_consumption',
  'payment',
  'payment_allocation',
  'journal_entry',
  'journal_line',
  'lot_allocations',
  'invoice_returns',
  'invoice_return_lines',
]

/**
 * ⚠️ THE HONEST GAP: tables the SERVER owns, a local route reads, and no pull
 * delivers today. On a device they hold only what that device wrote.
 *
 * What follows from it, and is enforced where it matters:
 *   - a sale the device ACCEPTS is provisional until the server answers the
 *     push (cost, ledger and batch/serial allocation are the server's);
 *   - a sale the device REFUSES while online is asked of the server instead
 *     (`submitInvoice`) — the device may be refusing for lack of these rows;
 *   - an operation whose route cannot run without them stays on the server.
 *
 * Closing the gap = adding each table to the server change-log and to
 * `DELTA_ENTITIES` (docs/architecture/V70-BACKLOG.md). Then it moves to
 * `PULLED_TABLES` and this list shrinks — the guard forces the move.
 */
export const NOT_PULLED_YET: readonly LocalTable[] = [
  'inventory_settings',
  'cost_layer',
  'account',
  'stock_serials',
  'stock_batches',
]

/**
 * Operations a ready device may run itself.
 *
 * `payment.record` and `invoice.return` are NOT here: nothing proves the local
 * route and the server agree for them yet (no golden parity, and a return
 * reverses cost layers the device never pulled). They take the server road.
 */
const DEVICE_FIRST_OPERATIONS: ReadonlySet<DeviceOperation> = new Set(['invoice.create'])

const keyOf = (workspaceId: string, table: string) => `${workspaceId}:${table}`

function activeWorkspace(): string | null {
  return useWorkspaceStore.getState().workspaceId ?? null
}

/**
 * Read this workspace's pull stamps back from the device after a reload.
 *
 * Until it has run, nothing is «synced» and every operation takes the server
 * road — slower, never wrong.
 */
export async function loadSyncedTables(workspaceId: string): Promise<void> {
  const read = bridge()?.db.syncedTables
  if (!read) return
  let stamps: Record<string, string>
  try {
    stamps = await read(workspaceId)
  } catch {
    return
  }
  for (const [table, pulledAt] of Object.entries(stamps)) {
    synced.set(keyOf(workspaceId, table), pulledAt)
  }
}

/**
 * The engine has pulled this table for this workspace.
 *
 * Recorded when a pull finished, so the answer is about the DEVICE, not about
 * one request.
 */
export function markTableSynced(
  table: string,
  workspaceId: string | null = activeWorkspace(),
  pulledAt: string = new Date().toISOString(),
): void {
  // No workspace: nothing can be said about whose table this is.
  if (!workspaceId) return
  synced.set(keyOf(workspaceId, table), pulledAt)
  void bridge()
    ?.db.markSynced?.(workspaceId, table, pulledAt)
    .catch(() => {
      // The stamp lives in memory for this run; the next pull writes it again.
    })
}

/**
 * Has this device pulled this table for this workspace?
 *
 * False means "I do not know" — the caller says "not available offline"
 * instead of showing an empty list.
 */
export function hasSyncedTable(
  table: string,
  workspaceId: string | null = activeWorkspace(),
): boolean {
  return workspaceId ? synced.has(keyOf(workspaceId, table)) : false
}

/** When this table was last fully pulled for the workspace, or null. */
export function getTablePulledAt(
  table: string,
  workspaceId: string | null = activeWorkspace(),
): string | null {
  return workspaceId ? (synced.get(keyOf(workspaceId, table)) ?? null) : null
}

/**
 * May this device run `operation` itself for this workspace?
 *
 * True only when the operation is one a device may run at all AND every table
 * its route reads that the pull delivers has been pulled for THIS workspace.
 * Hardware is never asked: a weak phone holding the same rows computes the
 * same integers.
 */
export function deviceReadyFor(workspaceId: string, operation: DeviceOperation): boolean {
  if (!workspaceId || !DEVICE_FIRST_OPERATIONS.has(operation)) return false
  const pulled = new Set<string>(PULLED_TABLES)
  const waited = DEVICE_OPERATION_READS[operation].filter((table) => pulled.has(table))
  if (waited.length === 0) return false
  return waited.every((table) => hasSyncedTable(table, workspaceId))
}

/**
 * Does the device hold every table the pull delivers, for this workspace?
 *
 * The pull asks this before trusting a stored cursor: a cursor says «the log
 * was read up to here», not «the rows are still on this device».
 */
export function hasPulledEverything(workspaceId: string): boolean {
  return PULLED_TABLES.every((table) => hasSyncedTable(table, workspaceId))
}

/**
 * Forget what was pulled: for one workspace (its rows were purged), or for
 * everything (tests, sign-out).
 */
export function resetSyncedTables(workspaceId?: string | null): void {
  if (!workspaceId) {
    synced.clear()
    return
  }
  for (const key of Array.from(synced.keys())) {
    if (key.startsWith(`${workspaceId}:`)) synced.delete(key)
  }
}
