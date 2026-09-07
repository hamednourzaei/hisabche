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

  /** What the admin panel renders. Never includes the key. */
  async getStatus(): Promise<AiProviderStatus | null> {
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
    return {
      provider: row.provider as AiProvider,
      baseUrl: row.base_url,
      model: row.model,
      systemPrompt: row.system_prompt ?? '',
      topupContact: row.topup_contact ?? '',
      isEnabled: row.is_enabled,
      // ⚠️ A boolean. Never `row.api_key`, never a slice of it.
      hasApiKey: Boolean(row.api_key),
      updatedAt: row.updated_at,
    }
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
