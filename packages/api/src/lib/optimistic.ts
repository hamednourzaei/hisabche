// ============================================
// packages/api/src/lib/optimistic.ts
//
// Optimistic updates for NON-FINANCIAL edits (task status, opportunity stage,
// project task fields). The change shows at once; a refusal puts every cached
// copy back exactly as it was; the server's answer always has the last word.
//
// ⚠️ NEVER FOR MONEY. A payment, an invoice total, a stock movement or a
// journal entry must not appear before the server has accepted it — a figure
// someone acts on has to be a figure that exists.
// ============================================

import type { QueryClient, QueryKey } from '@tanstack/react-query'

type Snapshot = Array<[QueryKey, unknown]>

const MAX_DEPTH = 4

/** A copy of `value` with the object whose `id` matches merged with `patch`. */
export function patchById(
  value: unknown,
  id: string,
  patch: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const patched = patchById(item, id, patch, depth + 1)
      if (patched !== item) changed = true
      return patched
    })
    return changed ? next : value
  }

  const record = value as Record<string, unknown>
  if (record.id === id) return { ...record, ...patch }

  // Containers: { items: [...] }, { data: [...] }, infinite { pages: [...] }.
  let changed = false
  const next: Record<string, unknown> = { ...record }
  for (const [key, child] of Object.entries(record)) {
    if (child === null || typeof child !== 'object') continue
    const patched = patchById(child, id, patch, depth + 1)
    if (patched !== child) {
      next[key] = patched
      changed = true
    }
  }
  return changed ? next : value
}

/** Apply the patch to every cached query under `root`. Returns the rollback snapshot. */
export async function applyOptimisticPatch(
  queryClient: QueryClient,
  root: QueryKey,
  id: string,
  patch: Record<string, unknown>,
): Promise<Snapshot> {
  // An in-flight refetch landing after this would overwrite the optimistic row.
  await queryClient.cancelQueries({ queryKey: root })
  const snapshot = queryClient.getQueriesData({ queryKey: root }) as Snapshot
  for (const [key, data] of snapshot) {
    const next = patchById(data, id, patch)
    if (next !== data) queryClient.setQueryData(key, next)
  }
  return snapshot
}

export function rollbackOptimisticPatch(
  queryClient: QueryClient,
  snapshot: Snapshot | undefined,
): void {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data)
}
