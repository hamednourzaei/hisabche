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
import {
  PLATFORM_SECRETS,
  listSecrets,
  resolveSecret,
  stageSecret,
  type StagedSecret,
} from '../secrets/secret-store'

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
  /** A rotation waiting for its approver (V63 · S-3). No value, only last4. */
  pendingKeyRotation: { last4: string } | null
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

/** A fallback provider tried after the primary configuration, in order. */
export interface AiFallback {
  id: string
  position: number
  provider: AiProvider
  model: string
  baseUrl: string | null
  timeoutMs: number
  isEnabled: boolean
  updatedAt: string
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
      .select(STATUS_COLUMNS)
      .maybeSingle()

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return null
      throw new DatabaseError('Failed to read AI provider settings', error)
    }
    if (!data) return null

    const row = data as StatusRow
    // ⚠️ V63 · S-3 — the key comes from Vault (or, transitionally, the
    // environment) through `readApiKey`. The `api_key` column is only a
    // pre-migration fallback and is emptied by the owner's copy migration.
    const apiKey = await this.readApiKey()
    // Enabled but keyless is not a usable configuration, and reporting it as
    // one would produce a 500 from the provider instead of a clear «not
    // configured» to the user.
    if (!row.is_enabled || !apiKey) return null

    return {
      provider: row.provider as AiProvider,
      baseUrl: row.base_url,
      model: row.model,
      apiKey,
      systemPrompt: row.system_prompt ?? '',
      topupContact: row.topup_contact ?? '',
      isEnabled: row.is_enabled,
    }
  }

  /**
   * The stored key whether or not the assistant is enabled — so the admin can
   * test a configuration BEFORE switching it on.
   *
   * ⚠️ INTERNAL ONLY. Vault first, environment as a documented transition,
   * legacy plaintext column last. Never returned from a route.
   */
  private async readApiKey(): Promise<string | null> {
    const resolved = await resolveSecret(PLATFORM_SECRETS.aiApiKey, process.env.AI_API_KEY)
    if (resolved.value) return resolved.value

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

  /** Public, still value-only: used by the admin's «test» button. */
  async getStoredApiKey(): Promise<string | null> {
    return this.readApiKey()
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

    // ⚠️ V63 · S-3 — «is a key set» now also looks in Vault. The index row is
    // metadata only (`last4`, rotation state); the value itself never leaves
    // the store.
    const metadata = (await listSecrets()).find(
      (secret) => secret.name === PLATFORM_SECRETS.aiApiKey,
    )

    return {
      provider: row.provider as AiProvider,
      baseUrl: row.base_url,
      model: row.model,
      systemPrompt: row.system_prompt ?? '',
      topupContact: row.topup_contact ?? '',
      isEnabled: row.is_enabled,
      // ⚠️ A boolean: the column filter, or a live Vault entry. Never the key.
      hasApiKey: keyed !== null || Boolean(metadata?.last4),
      pendingKeyRotation: metadata?.pendingLast4 ? { last4: metadata.pendingLast4 } : null,
      updatedAt: row.updated_at,
    }
  }

  /**
   * The ordered fallback list, disabled entries included.
   *
   * ⚠️ EMPTY IS A VALID ANSWER, and it means «no fallback» — not «read the
   * failure». A deployment that has not applied `docs/ai-usage-01-migration.sql`
   * gets [] and behaves exactly as it did before.
   */
  async getFallbacks(): Promise<AiFallback[]> {
    const { data, error } = await supabase
      .from('ai_provider_fallbacks')
      .select('id, position, provider, model, base_url, timeout_ms, is_enabled, updated_at')
      .order('position', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to read AI fallbacks', error)
    }

    return (data ?? []).map((row) => {
      const fallback = row as {
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
        id: fallback.id,
        position: fallback.position,
        provider: fallback.provider as AiProvider,
        model: fallback.model,
        baseUrl: fallback.base_url,
        timeoutMs: fallback.timeout_ms,
        isEnabled: fallback.is_enabled,
        updatedAt: fallback.updated_at,
      }
    })
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
    actorEmail?: string | undefined,
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

    // ⚠️ V63 · S-3 — a NEW key is staged in Vault and filed for a second
    // admin's approval. It is never written to the plaintext column, and it
    // does not become live until the maker-checker request is approved.
    let staged: StagedSecret | null = null
    if (input.apiKey && input.apiKey.trim()) {
      staged = await stageSecret({
        name: PLATFORM_SECRETS.aiApiKey,
        value: input.apiKey.trim(),
        purpose: 'AI provider API key',
        actorId,
        actorEmail: actorEmail ?? actorId,
      })
    }

    const { error } = await supabase
      .from('ai_provider_settings')
      .upsert(patch, { onConflict: 'singleton' })

    if (error) throw new DatabaseError('Failed to save AI provider settings', error)

    const status = await this.getStatus()
    if (!status) throw new DatabaseError('AI provider settings did not persist', null)
    return staged ? { ...status, pendingKeyRotation: { last4: staged.last4 } } : status
  }
}
