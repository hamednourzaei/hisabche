// ============================================
// backend/src/services/ai/ai-settings.service.ts
//
// T13 — the provider configuration, and the allowance each account gets.
//
// ---------------------------------------------------------------------------
// ⚠️ THE API KEY NEVER LEAVES THIS FILE
//
// `ai_provider_settings.api_key` bills the OWNER of this product, not the
// customer asking a question. Anyone who reads it can spend without limit,
// from anywhere.
//
// So there are two shapes for the settings, deliberately:
//
//   AiProviderConfig  includes the key — internal, never serialised out
//   AiProviderStatus  what an admin sees — says whether a key is SET, and
//                     nothing about what it is
//
// There is no «masked» variant. A masked key is still four characters of a
// secret plus a confirmation that the rest exists, and it invites a UI to
// display something it should not have.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'

export type AiProvider = 'anthropic' | 'openai'

/** Internal. Carries the secret; must never be returned from a route. */
export interface AiProviderConfig {
  provider: AiProvider
  baseUrl: string | null
  model: string
  apiKey: string
  systemPrompt: string
  topupContact: string
  isEnabled: boolean
}

/** What an admin is allowed to see. No secret, at any length. */
export interface AiProviderStatus {
  provider: AiProvider
  baseUrl: string | null
  model: string
  systemPrompt: string
  topupContact: string
  isEnabled: boolean
  /** Whether a key is stored. Not the key, not part of it. */
  hasApiKey: boolean
  updatedAt: string | null
}

interface SettingsRow {
  provider: string
  base_url: string | null
  model: string
  api_key: string | null
  system_prompt: string
  topup_contact: string
  is_enabled: boolean
  updated_at: string | null
}

/** Everything the status shows. Deliberately without `api_key`. */
const STATUS_COLUMNS =
  'provider, base_url, model, system_prompt, topup_contact, is_enabled, updated_at'
type StatusRow = Omit<SettingsRow, 'api_key'>

/** The table is absent — the T13 migration has not been applied here. */
const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

export class AiSettingsService {
  /**
   * The full configuration, secret included.
   *
   * ⚠️ INTERNAL ONLY. Returns null when no provider is configured, which is
   * the state before an admin sets one up and the state this product ships in.
   * Callers must treat null as «the feature is off», never as «use a default».
   */
  async getConfig(): Promise<AiProviderConfig | null> {
    const { data, error } = await supabase
      .from('ai_provider_settings')
      .select(
        'provider, base_url, model, api_key, system_prompt, topup_contact, is_enabled, updated_at',
      )
      .maybeSingle()

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return null
      throw new DatabaseError('Failed to read AI provider settings', error)
    }
    if (!data) return null

    const row = data as SettingsRow
    // Enabled but keyless is not a usable configuration, and reporting it as
    // one would produce a 500 from the provider instead of a clear «not
    // configured» to the user.
    if (!row.is_enabled || !row.api_key) return null

    return {
      provider: row.provider as AiProvider,
      baseUrl: row.base_url,
      model: row.model,
      apiKey: row.api_key,
      systemPrompt: row.system_prompt ?? '',
      topupContact: row.topup_contact ?? '',
      isEnabled: row.is_enabled,
    }
  }

  /**
   * ⚠️ INTERNAL ONLY. The stored key whether or not the assistant is enabled —
   * so the admin can test a configuration BEFORE switching it on. Never
   * returned from a route.
   */
  async getStoredApiKey(): Promise<string | null> {
    const { data, error } = await supabase
      .from('ai_provider_settings')
      .select('api_key')
      .maybeSingle()
    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return null
      throw new DatabaseError('Failed to read AI provider settings', error)
    }
    return (data as { api_key: string | null } | null)?.api_key || null
  }

  /**
   * What the admin panel — and every user's `/api/ai/quota` — renders. Never
   * includes the key.
   *
   * ⚠️ AND NEVER READS IT (27 Sep 2026). This used to select `api_key` just to
   * turn it into a boolean, so the secret crossed the wire from the database
   * on every quota check by every user. «Is a key set» is asked as a filter
   * instead: the row comes back only if `api_key` is non-null. Only when it
   * does not is there a second read, to tell «no key» from «no settings».
   */
  async getStatus(): Promise<AiProviderStatus | null> {
    const keyed = await this.readStatusRow(true)
    const row = keyed ?? (await this.readStatusRow(false))
    if (!row) return null

    return {
      provider: row.provider as AiProvider,
      baseUrl: row.base_url,
      model: row.model,
      systemPrompt: row.system_prompt ?? '',
      topupContact: row.topup_contact ?? '',
      isEnabled: row.is_enabled,
      // ⚠️ A boolean, from the filter — the key itself was never selected.
      hasApiKey: keyed !== null,
      updatedAt: row.updated_at,
    }
  }

  private async readStatusRow(withKey: boolean): Promise<StatusRow | null> {
    let query = supabase.from('ai_provider_settings').select(STATUS_COLUMNS)
    if (withKey) query = query.not('api_key', 'is', null).neq('api_key', '')
    const { data, error } = await query.maybeSingle()
    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return null
      throw new DatabaseError('Failed to read AI provider settings', error)
    }
    return (data as StatusRow | null) ?? null
  }

  /**
   * Save the configuration.
   *
   * ⚠️ `apiKey` is optional and OMITTING IT KEEPS THE EXISTING ONE. That is
   * required rather than convenient: the admin form cannot show the current
   * key, so it submits an empty field every time it is used to change the
   * model or the prompt. Writing that empty value through would erase the key
   * whenever anyone edited anything else.
   */
  async save(
    actorId: string,
    input: {
      provider: AiProvider
      baseUrl?: string | null
      model: string
      apiKey?: string | undefined
      systemPrompt: string
      topupContact: string
      isEnabled: boolean
    },
  ): Promise<AiProviderStatus> {
    const patch: Record<string, unknown> = {
      singleton: true,
      provider: input.provider,
      base_url: input.baseUrl ?? null,
      model: input.model,
      system_prompt: input.systemPrompt,
      topup_contact: input.topupContact,
      is_enabled: input.isEnabled,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    }

    // Only when a non-empty key was actually supplied.
    if (input.apiKey && input.apiKey.trim()) patch.api_key = input.apiKey.trim()

    const { error } = await supabase
      .from('ai_provider_settings')
      .upsert(patch, { onConflict: 'singleton' })

    if (error) throw new DatabaseError('Failed to save AI provider settings', error)

    const status = await this.getStatus()
    if (!status) throw new DatabaseError('AI provider settings did not persist', null)
    return status
  }
}
