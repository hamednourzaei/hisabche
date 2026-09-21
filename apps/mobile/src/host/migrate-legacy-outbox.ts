// ============================================
// One queue, once.
//
// ⚠️ SOMEBODY'S INVOICES ARE IN THE OLD STORE RIGHT NOW.
//
// Until this build the offline queue was a zustand store persisted to
// AsyncStorage under `hisabche.outbox`. The shared UI queues through
// `db.enqueue`, which is SQLite. Shipping the new queue without moving the old
// one would leave every invoice a user wrote offline on the previous build
// sitting in storage nobody drains — invisible, and lost the first time they
// clear app data (§12: an unreported loss is worse than an error).
//
// This runs once, before the first drain, and is safe to run again: entries
// are keyed by `clientId` and inserted with OR IGNORE, so a half-finished
// migration resumes rather than duplicating.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage'

import { enqueue, isReady } from './local-db'

const LEGACY_KEY = 'hisabche.outbox'
/** Marks the move as done so a later run does not re-read a key it emptied. */
const DONE_KEY = 'hisabche.outbox.migrated'

interface LegacyEntry {
  clientId?: unknown
  kind?: unknown
  payload?: unknown
}

export interface LegacyMigrationResult {
  moved: number
  skipped: number
  /** Null when there was nothing to move — not the same as «moved zero». */
  reason: 'migrated' | 'already-done' | 'nothing-stored' | 'cache-unavailable'
}

export async function migrateLegacyOutbox(): Promise<LegacyMigrationResult> {
  // ⚠️ Without a cache there is nowhere to move it TO. Reporting «done» here
  // and deleting the old key would destroy the only copy.
  if (!isReady()) return { moved: 0, skipped: 0, reason: 'cache-unavailable' }

  const alreadyDone = await AsyncStorage.getItem(DONE_KEY)
  if (alreadyDone) return { moved: 0, skipped: 0, reason: 'already-done' }

  const raw = await AsyncStorage.getItem(LEGACY_KEY)
  if (!raw) {
    await AsyncStorage.setItem(DONE_KEY, new Date().toISOString())
    return { moved: 0, skipped: 0, reason: 'nothing-stored' }
  }

  let entries: LegacyEntry[] = []
  try {
    // zustand/persist wraps the value: `{ state: {...}, version: n }`.
    const parsed = JSON.parse(raw) as { state?: { entries?: unknown } }
    const stored = parsed.state?.entries
    entries = Array.isArray(stored) ? (stored as LegacyEntry[]) : []
  } catch {
    // Unreadable storage is not an empty queue. Leave the key in place so a
    // person can still be told about it, and do not mark the move done.
    return { moved: 0, skipped: 0, reason: 'cache-unavailable' }
  }

  let moved = 0
  let skipped = 0

  for (const entry of entries) {
    const clientId = typeof entry.clientId === 'string' ? entry.clientId : null
    const payload =
      typeof entry.payload === 'object' && entry.payload !== null
        ? (entry.payload as Record<string, unknown>)
        : null

    // The old store only ever held `invoice.create`.
    if (!clientId || !payload || entry.kind !== 'invoice.create') {
      skipped += 1
      continue
    }

    await enqueue({ entity: 'invoice', operation: 'create', clientId, payload })
    moved += 1
  }

  // ⚠️ The old key is REMOVED only after every entry landed. Until then a
  // crash mid-migration must leave the source intact.
  await AsyncStorage.removeItem(LEGACY_KEY)
  await AsyncStorage.setItem(DONE_KEY, new Date().toISOString())

  if (skipped > 0) {
    console.warn(`[outbox] ${skipped} legacy entries could not be read and were not migrated`)
  }

  return { moved, skipped, reason: 'migrated' }
}
