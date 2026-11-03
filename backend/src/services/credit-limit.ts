// ============================================
// backend/src/services/credit-limit.ts
//
// The two stored inputs of a customer's credit check.
//
//   workspaces.credit_limit_mode  'off' | 'warn' | 'block'   (docs/universal-core-migration.sql)
//   customers.credit_limit        null = no limit, 0 = cash only, > 0 = the most the customer may owe
//
// The RULE lives in `evaluateCreditLimit` (packages/validation, universal-core/credit-limit.domain.ts) and is
// the one the invoice builder already calls; this file only reads what the rule needs, so the server and the
// screen cannot disagree.
//
//   • A database without either column answers what the product did before: mode `warn`, no limit.
//   • A read that fails for any OTHER reason throws. Answering «no limit» on the strength of a failure would
//     switch the check off for exactly the moment it matters.
//
// ⚠️ Imports no other service (CLAUDE.md: a service imported for a constant closes an import cycle).
// ============================================

import type { CreditLimitMode } from '@hisabche/validation'

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'

const isMissingColumn = (code: string | undefined) => code === '42703' || code === 'PGRST204'

/** The mode a workspace that never chose one has — the same default the settings screen shows. */
export const DEFAULT_CREDIT_LIMIT_MODE: CreditLimitMode = 'warn'

export async function creditLimitModeOf(workspaceId: string): Promise<CreditLimitMode> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('credit_limit_mode')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error.code)) return DEFAULT_CREDIT_LIMIT_MODE
    throw new DatabaseError('Failed to read the credit limit mode', error)
  }
  const stored = (data as { credit_limit_mode?: string | null } | null)?.credit_limit_mode
  return stored === 'off' || stored === 'warn' || stored === 'block'
    ? stored
    : DEFAULT_CREDIT_LIMIT_MODE
}

/** The customer's limit in the books currency's major units; null when none is set. */
export async function creditLimitOf(
  workspaceId: string,
  customerId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('credit_limit')
    .eq('id', customerId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error.code)) return null
    throw new DatabaseError('Failed to read the customer credit limit', error)
  }
  const stored = (data as { credit_limit?: number | string | null } | null)?.credit_limit
  if (stored === null || stored === undefined) return null
  const limit = Number(stored)
  return Number.isFinite(limit) && limit >= 0 ? limit : null
}
