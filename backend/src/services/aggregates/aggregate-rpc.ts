// ============================================
// backend/src/services/aggregates/aggregate-rpc.ts
//
// Call a database-side aggregate (docs/perf-aggregates-*-migration.sql).
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
//
// Totals used to be computed by SELECTing rows and summing in Node. A
// supabase-js select is capped by PostgREST `max-rows` (1000), so past that
// every figure came from one page — silently wrong. The aggregates return one
// jsonb value, which the cap cannot truncate.
//
// ---------------------------------------------------------------------------
// THREE OUTCOMES, NEVER TWO (§7 #3)
//
//   * the function answered          → the parsed value
//   * the function is NOT INSTALLED  → `null`, logged. The caller runs its old
//     row-by-row path so nothing breaks before a human runs the migration.
//   * ANY OTHER error                → throws. A broken aggregate must not be
//     served — or cached — as «zero».
//
// The payload is validated at runtime: a type annotation on jsonb is not a
// check (§7 #2), and a shape mismatch throws rather than rendering zeros.
//
// ⚠️ These functions are SECURITY DEFINER and trust `p_workspace_id`. Pass
// ONLY `ctx.workspaceId` from a TenancyContext set by requireWorkspaceContext —
// never a value from a request body, query string or model output.
// ============================================

import type { ZodType, ZodTypeDef } from 'zod'

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'

/** PostgREST «no such function» and PostgreSQL `undefined_function`. */
const MISSING_FUNCTION_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883'])

export function isMissingFunctionError(error: { code?: string | undefined } | null): boolean {
  return !!error && typeof error.code === 'string' && MISSING_FUNCTION_CODES.has(error.code)
}

export async function callAggregate<T>(
  fn: string,
  args: Record<string, unknown>,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args)

  if (error) {
    if (isMissingFunctionError(error)) {
      console.warn(
        `[aggregate] ${fn} is not installed (${error.code}) — using the row-by-row fallback, ` +
          `which PostgREST caps at max-rows. Run docs/perf-aggregates-*-migration.sql.`,
      )
      return null
    }
    throw new DatabaseError(`Aggregate ${fn} failed`, error)
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new DatabaseError(`Aggregate ${fn} returned an unexpected shape`, parsed.error)
  }
  return parsed.data
}
