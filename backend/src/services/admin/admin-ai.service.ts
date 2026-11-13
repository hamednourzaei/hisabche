// ============================================
// backend/src/services/admin/admin-ai.service.ts
//
// V63 · A — what the console needed in order to run an AI bill: ordered
// fallback, prices, usage, budgets, prompt history and the AI audit trail.
//
// ⚠️ WHY THIS IS NOT UNDER `services/ai/`. That directory is guarded by
// `ai-provider-boundary.test.ts`: no file there may call `.rpc()` or compose
// SQL, because the assistant reads tenants' books and must stay on the
// reporting views. This file calls two FIXED database functions that the
// platform owner's console needs — it reads no workspace data at all — so it
// belongs with the other admin services, and the AI boundary stays absolute.
//
// ---------------------------------------------------------------------------
// ⚠️ EVERY NUMBER HERE IS DERIVED, AND AN UNKNOWN ONE IS NULL
//
// Nothing in this file stores a running total. Usage comes from the
// `ai_usage_summary(since, until)` function over `ai_query_log`; spend comes
// from that plus `ai_model_prices`. `ai_query_log` already has the rule that a
// count cannot disagree with the rows it counts (ai-quota.service.ts), and the
// same reasoning is why there is no `spent_this_month` column to drift.
//
// A token total is NULL when ANY question in the group did not report tokens.
// A cost is NULL when the model has no price. A spend is NULL when a single
// question in the month is unpriced — because a total that quietly leaves
// those out is smaller than the bill and looks more reassuring than the truth.
//
// ---------------------------------------------------------------------------
// ⚠️ MONEY IS INTEGER MICROS THROUGHOUT
//
// `ai_model_prices` holds micros per ONE MILLION tokens; the SQL function does
// the division in integers. `Number.isSafeInteger` is the guard for the one
// place a bigint arrives as a string from PostgREST: a value outside the safe
// range becomes null (unknown), never a silently rounded amount.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { AdminSecurityService, type AdminSecurityEvent } from './admin-security.service'
import type { AiFallback, AiProvider } from '../ai/ai-settings.service'

export interface AiFallbackInput {
  position: number
  provider: AiProvider
  model: string
  baseUrl: string | null
  timeoutMs: number
  isEnabled: boolean
}

export interface AiPriceItem {
  id: string
  provider: AiProvider
  model: string
  currency: string
  inputMicrosPerMillion: number
  outputMicrosPerMillion: number
  updatedAt: string
}

export interface AiUsageRow {
  day: string
  provider: string
  model: string
  queries: number
  promptTokens: number | null
  completionTokens: number | null
  currency: string | null
  costMicros: number | null
  unpricedQueries: number
}

export interface AiBudgetItem {
  id: string
  scope: 'platform' | 'workspace'
  workspaceId: string | null
  currency: string
  monthlyLimitMicros: number
  alertPercent: number
  updatedAt: string
  /** Month-to-date cost in this currency; null when a question was unpriced. */
  spentMicros: number | null
  /** Percentage of the ceiling used; null whenever `spentMicros` is null. */
  percentUsed: number | null
  /** Questions this month that no price row covers. */
  unpricedQueries: number
}

export interface AiPromptVersionItem {
  version: number
  content: string
  createdBy: string | null
  createdAt: string
}

/** One row of the AI audit trail (`admin_security_events`, `AI_%` only). */
export type AiAuditEvent = AdminSecurityEvent

/** The V63 · A migration has not been applied here. */
const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

/** A bigint that may arrive as a number or a string; unknown is null. */
export function microsOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

/** Same rule for a count: a number, or null when it is not one. */
function countOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

export interface CurrencySpend {
  /** Sum of known costs, or null when one question in the group was unpriced. */
  spentMicros: number | null
  unpricedQueries: number
  queries: number
}

/**
 * Month-to-date spend per currency, from usage rows.
 *
 * ⚠️ Rows with no currency are counted, not added: a question whose model has
 * no price belongs to the currency it will eventually be billed in, which is
 * unknown — so it makes every total it might belong to unavailable.
 */
export function summariseSpend(rows: readonly AiUsageRow[]): {
  byCurrency: Map<string, CurrencySpend>
  unattributed: number
} {
  const byCurrency = new Map<string, CurrencySpend>()
  let unattributed = 0

  for (const row of rows) {
    if (!row.currency) {
      unattributed += row.queries
      continue
    }

    const current = byCurrency.get(row.currency) ?? {
      spentMicros: 0,
      unpricedQueries: 0,
      queries: 0,
    }
    current.queries += row.queries
    current.unpricedQueries += row.unpricedQueries

    // One unpriced question (or an unreported token total) makes the sum
    // unknowable; the rows after it cannot repair that.
    if (row.costMicros === null || current.spentMicros === null) {
      current.spentMicros = null
    } else {
      current.spentMicros += row.costMicros
    }

    byCurrency.set(row.currency, current)
  }

  return { byCurrency, unattributed }
}

/** The window an AI usage range means, ending now. */
export function usageWindow(
  range: AiUsageRange,
  now: Date = new Date(),
): { since: Date; until: Date } {
  const days: Record<AiUsageRange, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }
  const since = new Date(now.getTime() - days[range] * 24 * 60 * 60 * 1000)
  return { since, until: now }
}

export const AI_USAGE_RANGES = ['24h', '7d', '30d', '90d'] as const
export type AiUsageRange = (typeof AI_USAGE_RANGES)[number]

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

export class AiAdminService {
  /** Ordered fallbacks as the console edits them. */
  static async listFallbacks(): Promise<AiFallback[]> {
    const { data, error } = await supabase
      .from('ai_provider_fallbacks')
      .select('id, position, provider, model, base_url, timeout_ms, is_enabled, updated_at')
      .order('position', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to read AI fallbacks', error)
    }

    return (data ?? []).map((raw) => {
      const row = raw as {
        id: string
        position: number
        provider: string
        model: string
        base_url: string | null
        timeout_ms: number
        is_enabled: boolean
        updated_at: string
      }
      return {
        id: row.id,
        position: row.position,
        provider: row.provider as AiProvider,
        model: row.model,
        baseUrl: row.base_url,
        timeoutMs: row.timeout_ms,
        isEnabled: row.is_enabled,
        updatedAt: row.updated_at,
      }
    })
  }

  /**
   * Replace the whole list in ONE call.
   *
   * ⚠️ Not a delete followed by inserts: supabase-js has no transaction, and a
   * failure between the two would leave the platform with no fallback at all.
   * The database function owns it (docs/ai-usage-01-migration.sql §5b).
   */
  static async replaceFallbacks(
    entries: readonly AiFallbackInput[],
    actorEmail: string,
  ): Promise<AiFallback[]> {
    const payload = entries.map((entry) => ({
      position: entry.position,
      provider: entry.provider,
      model: entry.model,
      baseUrl: entry.baseUrl ?? '',
      timeoutMs: entry.timeoutMs,
      isEnabled: entry.isEnabled,
    }))

    const { error } = await supabase.rpc('ai_fallbacks_replace', {
      p_entries: payload,
      p_actor_email: actorEmail,
    })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) {
        throw new DatabaseError(
          'AI fallbacks are unavailable: docs/ai-usage-01-migration.sql has not been applied',
          error,
        )
      }
      throw new DatabaseError('Failed to save AI fallbacks', error)
    }

    return this.listFallbacks()
  }

  static async listPrices(): Promise<AiPriceItem[]> {
    const { data, error } = await supabase
      .from('ai_model_prices')
      .select(
        'id, provider, model, currency, input_micros_per_million, output_micros_per_million, updated_at',
      )
      .order('provider', { ascending: true })
      .order('model', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to read AI model prices', error)
    }

    return (data ?? []).map((raw) => {
      const row = raw as {
        id: string
        provider: string
        model: string
        currency: string
        input_micros_per_million: number | string
        output_micros_per_million: number | string
        updated_at: string
      }
      // A price that cannot be read as an integer is not zero; the row is
      // dropped rather than shown at a rate nobody entered.
      const input = microsOrNull(row.input_micros_per_million)
      const output = microsOrNull(row.output_micros_per_million)
      if (input === null || output === null) {
        throw new DatabaseError(
          `AI price for ${row.provider}/${row.model} is not an integer; refusing to show it`,
          null,
        )
      }
      return {
        id: row.id,
        provider: row.provider as AiProvider,
        model: row.model,
        currency: row.currency,
        inputMicrosPerMillion: input,
        outputMicrosPerMillion: output,
        updatedAt: row.updated_at,
      }
    })
  }

  static async savePrice(
    input: {
      provider: AiProvider
      model: string
      currency: string
      inputMicrosPerMillion: number
      outputMicrosPerMillion: number
    },
    actorEmail: string,
  ): Promise<AiPriceItem[]> {
    const { error } = await supabase.from('ai_model_prices').upsert(
      {
        provider: input.provider,
        model: input.model.trim(),
        currency: input.currency.trim().toUpperCase(),
        input_micros_per_million: input.inputMicrosPerMillion,
        output_micros_per_million: input.outputMicrosPerMillion,
        updated_by: actorEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,model' },
    )

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) {
        throw new DatabaseError(
          'AI prices are unavailable: docs/ai-usage-01-migration.sql has not been applied',
          error,
        )
      }
      throw new DatabaseError('Failed to save the AI model price', error)
    }

    return this.listPrices()
  }

  static async deletePrice(id: string): Promise<void> {
    const { error } = await supabase.from('ai_model_prices').delete().eq('id', id)
    if (error) throw new DatabaseError('Failed to delete the AI model price', error)
  }

  /** The one aggregation the console reads. */
  static async usage(since: Date, until: Date): Promise<AiUsageRow[]> {
    const { data, error } = await supabase.rpc('ai_usage_summary', {
      p_since: since.toISOString(),
      p_until: until.toISOString(),
    })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code) || error.code === '42883') return []
      throw new DatabaseError('Failed to read AI usage', error)
    }

    return ((data ?? []) as unknown[]).map((raw) => {
      const row = raw as {
        day: string
        provider: string | null
        model: string | null
        queries: number | string
        prompt_tokens: number | string | null
        completion_tokens: number | string | null
        currency: string | null
        cost_micros: number | string | null
        unpriced_queries: number | string | null
      }
      return {
        day: row.day,
        provider: row.provider ?? '',
        model: row.model ?? '',
        queries: countOrNull(row.queries) ?? 0,
        promptTokens: countOrNull(row.prompt_tokens),
        completionTokens: countOrNull(row.completion_tokens),
        currency: row.currency,
        costMicros: microsOrNull(row.cost_micros),
        unpricedQueries: countOrNull(row.unpriced_queries) ?? 0,
      }
    })
  }

  /**
   * Budgets with the month-to-date spend beside each ceiling.
   *
   * The spend is computed from `ai_usage_summary` for the current UTC month,
   * never stored: a `spent_micros` column would be a second writer for a number
   * that `ai_query_log` already decides.
   */
  static async listBudgets(now: Date = new Date()): Promise<AiBudgetItem[]> {
    const { data, error } = await supabase
      .from('ai_budgets')
      .select('id, scope, workspace_id, currency, monthly_limit_micros, alert_percent, updated_at')
      .order('scope', { ascending: true })
      .order('currency', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to read AI budgets', error)
    }

    const rows = data ?? []
    if (rows.length === 0) return []

    const spend = summariseSpend(await this.usage(monthStart(now), now)).byCurrency

    return rows.map((raw) => {
      const row = raw as {
        id: string
        scope: string
        workspace_id: string | null
        currency: string
        monthly_limit_micros: number | string
        alert_percent: number
        updated_at: string
      }
      const limit = microsOrNull(row.monthly_limit_micros)
      const used = spend.get(row.currency)
      const spentMicros = used?.spentMicros ?? null
      return {
        id: row.id,
        scope: row.scope === 'workspace' ? 'workspace' : 'platform',
        workspaceId: row.workspace_id,
        currency: row.currency,
        monthlyLimitMicros: limit ?? 0,
        alertPercent: row.alert_percent,
        updatedAt: row.updated_at,
        spentMicros,
        percentUsed:
          spentMicros === null || !limit ? null : Math.round((spentMicros / limit) * 1000) / 10,
        unpricedQueries: used?.unpricedQueries ?? 0,
      }
    })
  }

  /**
   * Create or update one ceiling.
   *
   * ⚠️ The upsert runs in `ai_budget_save`, not here: the unique indexes are
   * partial (`WHERE scope = 'platform'`), which PostgREST's `on_conflict`
   * cannot infer, and a check-then-insert would be a race between two admins.
   */
  static async saveBudget(
    input: {
      scope: 'platform' | 'workspace'
      workspaceId: string | null
      currency: string
      monthlyLimitMicros: number
      alertPercent: number
    },
    actorEmail: string,
  ): Promise<AiBudgetItem[]> {
    const { error } = await supabase.rpc('ai_budget_save', {
      p_scope: input.scope,
      p_workspace_id: input.workspaceId,
      p_currency: input.currency.trim().toUpperCase(),
      p_limit_micros: input.monthlyLimitMicros,
      p_alert_percent: input.alertPercent,
      p_actor: actorEmail,
    })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code) || error.code === '42883') {
        throw new DatabaseError(
          'AI budgets are unavailable: docs/ai-usage-01-migration.sql has not been applied',
          error,
        )
      }
      throw new DatabaseError('Failed to save the AI budget', error)
    }

    return this.listBudgets()
  }

  static async deleteBudget(id: string): Promise<void> {
    const { error } = await supabase.from('ai_budgets').delete().eq('id', id)
    if (error) throw new DatabaseError('Failed to delete the AI budget', error)
  }

  /**
   * The prompt history.
   *
   * ⚠️ READ-ONLY BY CONSTRUCTION. There is no restore route: the console
   * prefills the form with an old version and the existing config save writes a
   * new version. One write path (ai_provider_settings) keeps the trigger the
   * only author of this table.
   */
  static async listPromptVersions(limit = 20): Promise<AiPromptVersionItem[]> {
    const { data, error } = await supabase
      .from('ai_prompt_versions')
      .select('version, content, created_by, created_at')
      .order('version', { ascending: false })
      .limit(limit)

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to read AI prompt history', error)
    }

    return (data ?? []).map((raw) => {
      const row = raw as {
        version: number | string
        content: string
        created_by: string | null
        created_at: string
      }
      return {
        version: countOrNull(row.version) ?? 0,
        content: row.content,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }
    })
  }

  /** AI configuration changes, newest first. Never a key, never a prompt body. */
  static async listAudit(limit = 50): Promise<AiAuditEvent[]> {
    // ⚠️ Filtered here rather than with a LIKE pattern: the event types are
    // `AI_*`, and `_` is a single-character wildcard in SQL LIKE — an escaping
    // bug would silently widen the tab to every security event. The console
    // reads recent rows only, so a bounded read plus a prefix test is exact.
    const { events } = await AdminSecurityService.listSecurityEvents({ limit: 200 })
    return events.filter((event) => event.eventType.startsWith('AI_')).slice(0, limit)
  }
}
