// ============================================
// backend/src/services/workspace-counts.ts
//
// Counting BUSINESSES — which a sandbox is not.
//
// A sandbox is a workspace (developer-platform-06: `is_sandbox`), so every
// count of `workspaces` silently included the test spaces: the platform's
// «total businesses» and «new this month», and — worse — a person's plan
// quota. On the free plan (one business) creating a sandbox used up the one
// business the plan allows, so the next real one was refused.
//
// ⚠️ THE COLUMN MAY NOT EXIST. Migration 06 is a human step; on a database
// without it the filter is an «undefined column» error. That must fall back
// to the unfiltered count (there can be no sandboxes there) — never to 0 and
// never to a 500 (§7.3: an error is not «none»).
//
// A leaf: imports only the database client (no service import cycle).
// ============================================

import { supabase } from '../db'

type CountQuery = ReturnType<typeof baseCount>
const baseCount = () => supabase.from('workspaces').select('id', { count: 'exact', head: true })

/** PostgREST / Postgres: «column workspaces.is_sandbox does not exist». */
function sandboxColumnMissing(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42703' || /is_sandbox/.test(error.message ?? ''))
}

/**
 * How many real businesses match — sandboxes left out. `narrow` adds the
 * caller's own filters (an owner, a date). An error other than the missing
 * column is returned, not swallowed.
 */
export async function countBusinesses(
  narrow: (query: CountQuery) => CountQuery = (query) => query,
): Promise<{ count: number; error: { code?: string; message?: string } | null }> {
  const filtered = await narrow(baseCount()).eq('is_sandbox', false)
  if (!filtered.error) return { count: filtered.count ?? 0, error: null }
  if (!sandboxColumnMissing(filtered.error)) return { count: 0, error: filtered.error }
  const plain = await narrow(baseCount())
  return { count: plain.count ?? 0, error: plain.error }
}
