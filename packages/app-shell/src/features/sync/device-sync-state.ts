// ============================================
// What the device knows.
//
// A device that has never pulled a table does not know that the table is
// empty, and it must not say so: a list that answers "nothing here" when the
// device was never filled shows a shopkeeper an empty business.
//
// The sync engine records what it has pulled; the readers ask.
// ============================================

const syncedTables = new Set<string>()

/**
 * The engine has pulled this table for this workspace.
 *
 * Recorded when a pull finished, so the answer is about the DEVICE, not about
 * one request.
 */
export function markTableSynced(table: string): void {
  syncedTables.add(table)
}

/**
 * Has this device pulled this table?
 *
 * False means "I do not know" — the caller says "not available offline"
 * instead of showing an empty list.
 */
export function hasSyncedTable(table: string): boolean {
  return syncedTables.has(table)
}

/** Test seam: forget everything (a new session, a new workspace). */
export function resetSyncedTables(): void {
  syncedTables.clear()
}
