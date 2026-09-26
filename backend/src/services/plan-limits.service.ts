// ============================================
// backend/src/services/plan-limits.service.ts
//
// What a workspace is allowed — invoices, members, AI questions a month.
//
//   built-in default (plan-limit-defaults.ts)
//     ← the platform admin's setting for the PLAN     (plan_limit_settings)
//       ← the admin's setting for THIS WORKSPACE       (workspace_limit_overrides)
//
// A key present in a layer replaces the one below; `null` there means
// «unlimited», an absent key means «inherit». (AI questions cost the owner
// money, so they are never unlimited — the admin routes refuse null there.)
//
// Every reader — /billing's usage bars, the AI quota, and the enforcement on
// invoice creation and member invites — goes through `effectiveLimits()`.
// Before docs/plan-limits-migration.sql the tables do not exist: the built-in
// defaults apply, which is exactly what applied before.
//
// Cached only in the SHARED store, 60 s, and dropped on every admin save —
// a limit that one instance still remembers after the admin changed it would
// block (or allow) differently depending on which server answered.
// ============================================

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import { LIMIT_KEYS, defaultsFor, type PlanLimitValues } from './plan-limit-defaults'

const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])
const CACHE_TTL_S = 60
const CACHE_PREFIX = 'plan-limits:'

export type LimitPatch = Partial<PlanLimitValues>

/** Only known keys, each a non-negative integer or null. Anything else is dropped. */
export function cleanPatch(raw: unknown): LimitPatch {
  const out: LimitPatch = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of LIMIT_KEYS) {
    if (!(key in (raw as Record<string, unknown>))) continue
    const value = (raw as Record<string, unknown>)[key]
    if (value === null) out[key] = null
    else if (typeof value === 'number' && Number.isInteger(value) && value >= 0) out[key] = value
  }
  return out
}

export function mergeLimits(base: PlanLimitValues, ...layers: LimitPatch[]): PlanLimitValues {
  const result = { ...base }
  for (const layer of layers) {
    for (const key of LIMIT_KEYS) if (key in layer) result[key] = layer[key] as number | null
  }
  return result
}

async function readJson(table: string, column: string, value: string): Promise<LimitPatch> {
  const { data, error } = await supabase
    .from(table)
    .select('limits')
    .eq(column, value)
    .maybeSingle()
  if (error) {
    if (SCHEMA_ABSENT.has(error.code)) return {}
    throw new DatabaseError(`Failed to read ${table}`, error)
  }
  return cleanPatch((data as { limits?: unknown } | null)?.limits)
}

export async function effectiveLimits(workspaceId: string, plan: string): Promise<PlanLimitValues> {
  const key = `${CACHE_PREFIX}${plan}:${workspaceId}`
  const cached = await memoryCache.getShared<PlanLimitValues>(key)
  if (cached) return cached
  const [planLayer, workspaceLayer] = await Promise.all([
    readJson('plan_limit_settings', 'plan', plan),
    readJson('workspace_limit_overrides', 'workspace_id', workspaceId),
  ])
  const result = mergeLimits(defaultsFor(plan), planLayer, workspaceLayer)
  await memoryCache.setShared(key, result, CACHE_TTL_S)
  return result
}

// ─── Platform admin ────────────────────────────────────────────────────────

export async function listPlanSettings(): Promise<{
  configured: boolean
  plans: Array<{
    plan: string
    defaults: PlanLimitValues
    settings: LimitPatch
    effective: PlanLimitValues
  }>
}> {
  const { data, error } = await supabase.from('plan_limit_settings').select('plan, limits')
  const configured = !(error && SCHEMA_ABSENT.has(error.code))
  if (error && configured) throw new DatabaseError('Failed to read plan limit settings', error)
  const byPlan = new Map(
    (data ?? []).map((row: { plan: string; limits: unknown }) => [
      row.plan,
      cleanPatch(row.limits),
    ]),
  )
  return {
    configured,
    plans: (['free', 'pro', 'enterprise'] as const).map((plan) => {
      const settings = byPlan.get(plan) ?? {}
      return {
        plan,
        defaults: defaultsFor(plan),
        settings,
        effective: mergeLimits(defaultsFor(plan), settings),
      }
    }),
  }
}

export async function savePlanSettings(
  plan: string,
  patch: LimitPatch,
  adminId: string,
): Promise<void> {
  const { error } = await supabase
    .from('plan_limit_settings')
    .upsert({ plan, limits: patch, updated_by: adminId, updated_at: new Date().toISOString() })
  if (error) {
    if (SCHEMA_ABSENT.has(error.code)) throw new DatabaseError('PLAN_LIMITS_NOT_CONFIGURED', error)
    throw new DatabaseError('Failed to save plan limits', error)
  }
  await memoryCache.invalidate(`${CACHE_PREFIX}${plan}:`)
}

export async function getWorkspaceOverride(
  workspaceId: string,
): Promise<{ limits: LimitPatch; note: string | null }> {
  const { data, error } = await supabase
    .from('workspace_limit_overrides')
    .select('limits, note')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) {
    if (SCHEMA_ABSENT.has(error.code)) return { limits: {}, note: null }
    throw new DatabaseError('Failed to read workspace limits', error)
  }
  const row = data as { limits?: unknown; note?: string | null } | null
  return { limits: cleanPatch(row?.limits), note: row?.note ?? null }
}

export async function saveWorkspaceOverride(
  workspaceId: string,
  patch: LimitPatch,
  note: string | null,
  adminId: string,
): Promise<void> {
  const { error } = await supabase.from('workspace_limit_overrides').upsert({
    workspace_id: workspaceId,
    limits: patch,
    note,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    if (SCHEMA_ABSENT.has(error.code)) throw new DatabaseError('PLAN_LIMITS_NOT_CONFIGURED', error)
    throw new DatabaseError('Failed to save workspace limits', error)
  }
  // Every plan's cached entry for this workspace.
  await memoryCache.invalidate(CACHE_PREFIX)
}

// ─── Enforcement ───────────────────────────────────────────────────────────

export type EnforcedLimit = 'invoices' | 'users'

/**
 * The plan's ceiling is reached. 402, the same family as SUBSCRIPTION_EXPIRED:
 * permanent for this request (a mobile outbox must not retry it forever), and
 * answered by upgrading, not by trying again.
 */
export class PlanLimitError extends Error {
  readonly statusCode = 402
  readonly code = 'PLAN_LIMIT_REACHED'
  constructor(
    readonly feature: EnforcedLimit,
    readonly limit: number,
    readonly used: number,
  ) {
    super('PLAN_LIMIT_REACHED')
    this.name = 'PlanLimitError'
  }
}

const COUNTED: Record<EnforcedLimit, string> = { invoices: 'invoices', users: 'workspace_members' }

/**
 * Throws PlanLimitError when this workspace may not create one more.
 *
 * ⚠️ A TRIAL IS NOT LIMITED — it exists so a business can try everything.
 * ⚠️ The count is EXACT (`head: true`) — a planner estimate would refuse or
 * allow the 11th invoice by guesswork (راهنمای سشن §۷٫۴).
 */
export async function assertWithinLimit(
  workspaceId: string,
  feature: EnforcedLimit,
): Promise<void> {
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('plan, is_trial')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (subError)
    throw new DatabaseError('Failed to read the subscription for a plan limit', subError)
  const row = sub as { plan?: string; is_trial?: boolean } | null
  if (row?.is_trial) return

  const limit = (await effectiveLimits(workspaceId, row?.plan ?? 'free'))[feature]
  if (limit === null) return

  const { count, error } = await supabase
    .from(COUNTED[feature])
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (error) throw new DatabaseError(`Failed to count ${feature} for a plan limit`, error)
  const used = count ?? 0
  if (used >= limit) throw new PlanLimitError(feature, limit, used)
}
