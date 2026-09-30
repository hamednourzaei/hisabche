// ============================================
// Capabilities #43, #44, #45, #46, #42 — snapshots and point-in-time views.
// Engine N9 (data portability side).
//
// ⚠️ A SNAPSHOT IS NOT A BACKUP, AND THE DIFFERENCE IS WHO CAN READ IT.
//
// `backup.service.ts` exports everything the workspace holds, marks it
// `restorable: false` — honestly, because there is no import path — and is the
// answer to «can I take my data with me». That stays exactly as it is.
//
// A snapshot answers a different question: «what did the books say on a given
// day?». Three properties follow, and each one rules out a shortcut:
//
//   1. IT IS A POINT IN TIME, taken with ONE consistent read. Reading the
//      invoices and then the payments separately can straddle a write, and the
//      snapshot then disagrees with both — an invoice that appears settled by
//      the payments table while its own allocation rows are not there yet.
//   2. IT IS DERIVED, NEVER A COPY OF THE TABLES. A snapshot that duplicated rows
//      would need its own migration for every change to a source table, and would
//      then be a second source of truth — the thing `entity_catalog` exists to
//      name. So a snapshot is a VERSION STAMP plus the table list, and the
//      reader resolves it against the ledger's own effective dating.
//   3. IT IS NOT RESTORABLE, AND SAYS SO. `restorable: false` is already on the
//      backup for the same reason; repeating it here is not duplication, it is
//      the reader's only warning.
//
// ⚠️ WHAT IS STILL NOT HERE, STATED PLAINLY.
//
// The ledger has `date` on entries and the payment trail has `entry_date`, so
// what a document looked like ON a given day is answerable for those. It is NOT
// answerable for a renamed account, a re-pointed customer record, or a setting,
// because none of those are effective-dated. So `pointInTime` returns the
// documents and says which parts of the answer are missing — rather than
// implying a completeness the data does not have.
export type SnapshotKind = 'full' | 'documents' | 'catalog'

export interface Snapshot {
  id: string
  workspaceId: string
  /** What it covers. */
  kind: SnapshotKind
  /** ISO datetime it was taken. */
  takenAt: string
  /**
   * ⚠️ THE SCHEMA VERSION OF THE SOURCE, not of the snapshot. A snapshot taken
   * against schema 7 and read against schema 9 is a snapshot whose numbers mean
   * something else — and a reader that cannot tell the two apart reads it anyway.
   */
  sourceSchemaVersion: string
  /** Tables covered, so a reader knows what the absence of a number means. */
  tables: string[]
  /** Row counts per table at that moment. */
  counts: Record<string, number>
  /** Always false, and never dropped from the shape. See the header. */
  restorable: false
  /**
   * ⚠️ WHAT THIS SNAPSHOT CANNOT ANSWER. The reader needs these to know when not
   * to trust it — a completeness claim is what a restore path would make, and
   * there is none.
   */
  limitations: string[]
}

/** What the product cannot yet reconstruct, stated rather than implied. */
export const SNAPSHOT_LIMITATIONS: readonly string[] = [
  'accounts renamed or re-pointed after this date',
  'customer and supplier master-data changes',
  'settings and configuration changes',
  'documents deleted after this date',
]

/** Tables a snapshot covers, with why each one is or is not there. */
export const SNAPSHOT_TABLES: readonly { table: string; kind: SnapshotKind }[] = [
  { table: 'journal_entries', kind: 'documents' },
  { table: 'journal_lines', kind: 'documents' },
  { table: 'accounts', kind: 'catalog' },
  { table: 'invoices', kind: 'documents' },
  { table: 'invoice_items', kind: 'documents' },
  { table: 'payments', kind: 'documents' },
  { table: 'payment_allocations', kind: 'documents' },
  { table: 'customers', kind: 'catalog' },
  { table: 'suppliers', kind: 'catalog' },
  { table: 'products', kind: 'catalog' },
]

/**
 * Build the snapshot header.
 *
 * ⚠️ COUNTS COME FROM THE READER, and a count of `null` stays null. A caller that
 * could not read a table reports it as unknown, and writing `0` would say «this
 * table was empty on that date» — which is a claim about the past that a
 * permission failure does not support.
 */
export function buildSnapshot(input: {
  id: string
  workspaceId: string
  kind: SnapshotKind
  takenAt: string
  sourceSchemaVersion: string
  counts: Record<string, number | null>
  extraLimitations?: readonly string[]
}): Snapshot {
  const tables = SNAPSHOT_TABLES.filter((t) => t.kind === input.kind || input.kind === 'full').map(
    (t) => t.table,
  )

  const counted: Record<string, number> = {}
  for (const table of tables) {
    const value = input.counts[table]
    // ⚠️ Unknown stays unknown. Absent from the map entirely, so a reader can
    // tell «I could not read this» from «there was nothing here».
    if (typeof value === 'number') counted[table] = value
  }

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    kind: input.kind,
    takenAt: input.takenAt,
    sourceSchemaVersion: input.sourceSchemaVersion,
    tables,
    counts: counted,
    restorable: false,
    limitations: [...SNAPSHOT_LIMITATIONS, ...(input.extraLimitations ?? [])],
  }
}

/**
 * Can this snapshot be read by a reader running a different schema version?
 *
 * ⚠️ ANSWERED, NOT ASSUMED. A forward move is usually readable — a new column is
 * ignored. A BACKWARD move is not: a column the reader has never heard of
 * changes the meaning of the figures. So the check is directional, and the
 * error says which direction.
 */
export function checkReadable(
  snapshot: Snapshot,
  readerSchemaVersion: string,
): { readable: boolean; reason: string } {
  if (snapshot.sourceSchemaVersion === readerSchemaVersion) {
    return { readable: true, reason: 'same schema version' }
  }

  const from = versionNumber(snapshot.sourceSchemaVersion)
  const to = versionNumber(readerSchemaVersion)

  if (from !== null && to !== null && to > from) {
    // ⚠️ STATED AS A WARNING, NOT A BLOCK. A newer reader usually reads an older
    // snapshot correctly; refusing would mean a shop cannot open a snapshot
    // from last year after the product updates, which is the opposite of what
    // snapshots are for.
    return {
      readable: true,
      reason: `the snapshot was taken under schema ${snapshot.sourceSchemaVersion} and this reader runs ${readerSchemaVersion}; figures are read on the newer shape`,
    }
  }

  return {
    readable: false,
    reason: `the snapshot was taken under schema ${snapshot.sourceSchemaVersion}, which this reader (${readerSchemaVersion}) cannot interpret`,
  }
}

/** A dotted version like `1.4.2` reduces to a comparable number. Null if unparseable. */
export function versionNumber(version: string): number | null {
  const parts = version.split('.').map((p) => Number(p))
  if (parts.length === 0 || parts.some((p) => !Number.isFinite(p))) return null
  // Base 1000, so 1.10.0 sorts above 1.9.0.
  return parts.reduce((acc, p) => acc * 1000 + p, 0)
}

/**
 * The files a human-readable archive contains (#46).
 *
 * ⚠️ MARKDOWN BEFORE XLSX, and both from the same rows. The existing
 * `backup.service.ts` has `backupToMarkdown` and `backupToXlsx` already, and
 * `USER-REQUESTS.md` records the user's standing request to download a backup as
 * Markdown and Excel. So this is WIRING the two that exist, not inventing a
 * third format.
 */
export interface ArchiveFile {
  path: string
  /** What a person finds when they open it. */
  purpose: string
  format: 'md' | 'xlsx' | 'json'
}

export const ARCHIVE_LAYOUT: readonly ArchiveFile[] = [
  {
    path: 'README.md',
    purpose: 'what this archive is, when it was taken, and that it is not restorable',
    format: 'md',
  },
  {
    path: 'data/accounts.xlsx',
    purpose: 'the chart of accounts as it stood',
    format: 'xlsx',
  },
  {
    path: 'data/invoices.xlsx',
    purpose: 'every invoice with its lines in separate sheets',
    format: 'xlsx',
  },
  {
    path: 'data/payments.xlsx',
    purpose: 'payments and the allocations they made',
    format: 'xlsx',
  },
  {
    path: 'ledger/journal-entries.xlsx',
    purpose: 'the ledger itself, for an accountant who will not read a database',
    format: 'xlsx',
  },
  {
    path: 'data/customers.xlsx',
    purpose: 'customer master data',
    format: 'xlsx',
  },
  {
    path: 'data/suppliers.xlsx',
    purpose: 'supplier master data',
    format: 'xlsx',
  },
  {
    path: 'snapshot.json',
    purpose: 'the machine-readable snapshot header, schema version and counts',
    format: 'json',
  },
]
