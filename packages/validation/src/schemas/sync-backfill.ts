// ============================================
// packages/validation/src/schemas/sync-backfill.ts
//
// V62 Slice 5 (§4.6) — Pure backfill planner when a feature pack is
// installed on a device after initial sync.
//
// Rule:
//   - Device's shared cursor is C.
//   - Pull ONLY the newly added entity types from cursor 0 up to C, in pages.
//   - If cursor 0 is behind the server's commit horizon (`mustRehydrate`),
//     fall back to `/api/sync/snapshot` for those new entity types only.
//   - Then resume shared delta sync from C with the full installed entity set.
// ============================================

import { syncEntitiesForPacks, type PackId } from './feature-packs'
import type { SyncEntity } from './sync-protocol.schema'

export type BackfillPlan =
  | { readonly kind: 'none'; readonly resumeWithTypes: readonly SyncEntity[] }
  | {
      readonly kind: 'delta_backfill'
      readonly entityTypes: readonly SyncEntity[]
      readonly fromCursor: 0
      readonly upToCursor: number
      readonly resumeWithTypes: readonly SyncEntity[]
    }
  | {
      readonly kind: 'snapshot_backfill'
      readonly entityTypes: readonly SyncEntity[]
      readonly resumeWithTypes: readonly SyncEntity[]
    }

export function planPackBackfill(input: {
  sharedCursor: number
  previousPacks: readonly PackId[]
  nextPacks: readonly PackId[]
  horizonExceeded?: boolean
}): BackfillPlan {
  const prevEntities = new Set(syncEntitiesForPacks(input.previousPacks))
  const nextEntities = syncEntitiesForPacks(input.nextPacks)
  const added = nextEntities.filter((e) => !prevEntities.has(e))

  if (added.length === 0 || input.sharedCursor <= 0) {
    return { kind: 'none', resumeWithTypes: nextEntities }
  }

  if (input.horizonExceeded) {
    return {
      kind: 'snapshot_backfill',
      entityTypes: added,
      resumeWithTypes: nextEntities,
    }
  }

  return {
    kind: 'delta_backfill',
    entityTypes: added,
    fromCursor: 0,
    upToCursor: input.sharedCursor,
    resumeWithTypes: nextEntities,
  }
}

/** Trim changes past `upToCursor` so backfill never skips ahead of shared cursor C. */
export function clampBackfillPage<T extends { syncVersion?: number | undefined }>(
  changes: readonly T[],
  upToCursor: number,
  serverHasMore: boolean,
): { rows: T[]; reachedTarget: boolean } {
  const rows = changes.filter((c) => (c.syncVersion ?? 0) <= upToCursor)
  const maxSeen = changes.reduce((m, c) => Math.max(m, c.syncVersion ?? 0), 0)
  const reachedTarget = !serverHasMore || maxSeen >= upToCursor
  return { rows, reachedTarget }
}
