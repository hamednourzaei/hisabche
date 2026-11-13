// ============================================
// backend/src/services/secrets/secret-store.ts
//
// V63 · S-3 — the ONE reader/writer of platform secrets.
//
// Secrets live in Supabase Vault. This file is the only code that calls the
// `platform_secret_*` functions, so three rules can be enforced in one place:
//
//   1. A VALUE never leaves the server. The console reads `last4` + timestamps
//      through `list()`; there is no route that returns `get()`.
//   2. A rotation is two-person. `stage()` writes the new value to Vault under
//      `staged/<name>` and files a maker-checker request; `promoteStaged()`
//      runs only from the approver's decision and is the only caller of the
//      direct write.
//   3. A missing Vault or an unapplied migration is NAMED, never guessed.
//      Reads return null, writes throw `SECRET_STORE_UNAVAILABLE`.
//
// Caching: five minutes, in the shared cache (Redis when present). The cache
// holds the VALUE, so it is invalidated on every successful write/promote —
// and it is never included in an API response.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { cacheService } from '../cache.service'
import { AdminSecurityService } from '../admin/admin-security.service'

/** Every secret name the product reads. Keep this list short and explicit. */
export const PLATFORM_SECRETS = {
  aiApiKey: 'ai.api_key',
  stripeSecretKey: 'stripe.secret_key',
  stripeWebhookSecret: 'stripe.webhook_secret',
  paypalClientId: 'paypal.client_id',
  paypalClientSecret: 'paypal.client_secret',
  paypalWebhookId: 'paypal.webhook_id',
} as const

export type PlatformSecretName = (typeof PLATFORM_SECRETS)[keyof typeof PLATFORM_SECRETS]

/** Metadata the console may render. Deliberately without the value. */
export interface SecretMetadata {
  name: string
  purpose: string
  /** Last four characters — a recognition aid, never a reader of the secret. */
  last4: string | null
  rotatedAt: string | null
  rotatedBy: string | null
  /** Set while a staged rotation waits for its approver. */
  pendingLast4: string | null
  pendingAt: string | null
  pendingBy: string | null
}

export interface StagedSecret {
  name: string
  last4: string
  requestId: string
}

const CACHE_TTL_SECONDS = 300
const cacheKey = (name: string) => `platform-secret:${name}`
const ENV_WARNING_KEY = (name: string) => `platform-secret:env:${name}`

/** Postgres / PostgREST codes that mean «the function or table is not here yet». */
const STORE_ABSENT = new Set(['42P01', '42883', 'PGRST202', 'PGRST205'])

export class SecretStoreUnavailableError extends Error {
  readonly code = 'SECRET_STORE_UNAVAILABLE'
  constructor(message: string) {
    super(message)
    this.name = 'SecretStoreUnavailableError'
  }
}

function isAbsent(code: string | undefined): boolean {
  return code !== undefined && STORE_ABSENT.has(code)
}

/**
 * Read one secret for the server's own use.
 *
 * `null` means «no such secret, or no Vault» — the caller must treat both as
 * «not configured» and never fall back to an invented default.
 */
export async function getSecret(name: string): Promise<string | null> {
  const cached = await cacheService.get<string>(cacheKey(name))
  if (typeof cached === 'string' && cached.length > 0) return cached

  const { data, error } = await supabase.rpc('platform_secret_get', { p_name: name })

  if (error) {
    if (isAbsent(error.code)) return null
    throw new DatabaseError(`Failed to read platform secret "${name}"`, error)
  }

  // A `void` result arrives as '' from PostgREST; treat it as absent.
  const value = typeof data === 'string' && data.length > 0 ? data : null
  if (value) await cacheService.set(cacheKey(name), value, CACHE_TTL_SECONDS)
  return value
}

/** True when a usable value is stored. Never returns (or logs) the value. */
export async function hasSecret(name: string): Promise<boolean> {
  return (await getSecret(name)) !== null
}

type SecretIndexRow = {
  name: string
  purpose: string | null
  last4: string | null
  rotated_at: string | null
  rotated_by: string | null
  pending_last4?: string | null
  pending_at?: string | null
  pending_by?: string | null
}

/**
 * The only mapping from an index row to what a client may see.
 *
 * ⚠️ It names every field it copies. A row that (by mistake) also carried
 * `value` or `decrypted_secret` would not survive this function — that is the
 * point, and `secret-never-returned.test.ts` feeds it such a row.
 */
export function toSecretMetadata(row: SecretIndexRow): SecretMetadata {
  return {
    name: row.name,
    purpose: row.purpose ?? '',
    last4: row.last4,
    rotatedAt: row.rotated_at,
    rotatedBy: row.rotated_by,
    pendingLast4: row.pending_last4 ?? null,
    pendingAt: row.pending_at ?? null,
    pendingBy: row.pending_by ?? null,
  }
}

/**
 * Metadata for the console. Never includes a value, and never a Vault id.
 * A missing store is an explicit empty list — the screen then says «Vault is
 * not available here» rather than pretending every secret is missing.
 */
export async function listSecrets(): Promise<SecretMetadata[]> {
  const { data, error } = await supabase.rpc('platform_secrets_list')
  if (error) {
    if (isAbsent(error.code)) return []
    throw new DatabaseError('Failed to list platform secrets', error)
  }

  return ((data ?? []) as SecretIndexRow[]).map(toSecretMetadata)
}

/**
 * Stage a rotation and file the maker-checker request.
 *
 * ⚠️ The VALUE is written to Vault only. The request payload carries the name,
 * the purpose and `last4` — enough for a reviewer to recognise what is being
 * rotated and never enough to reconstruct it.
 */
export async function stageSecret(input: {
  name: string
  value: string
  purpose: string
  actorId: string
  actorEmail: string
}): Promise<StagedSecret> {
  const trimmed = input.value.trim()
  if (trimmed.length < 8) {
    throw new SecretStoreUnavailableError('SECRET_TOO_SHORT')
  }

  const { data, error } = await supabase.rpc('platform_secret_stage', {
    p_name: input.name,
    p_value: trimmed,
    p_purpose: input.purpose,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail,
  })

  if (error) {
    if (isAbsent(error.code)) {
      throw new SecretStoreUnavailableError(
        'The secret store is not available on this database (docs/admin-secrets-01-migration.sql has not been applied).',
      )
    }
    throw new DatabaseError(`Failed to stage platform secret "${input.name}"`, error)
  }

  const staged = (Array.isArray(data) ? data[0] : data) as
    { staged_name: string; last4: string } | null | undefined

  const last4 = staged?.last4 ?? trimmed.slice(-4)

  const { data: request, error: requestError } = await supabase
    .from('admin_action_requests')
    .insert({
      action_type: 'SECRET_ROTATE',
      payload: { name: input.name, purpose: input.purpose, last4 },
      diff_preview: { name: input.name, last4, state: 'PENDING_ROTATION' },
      proposed_by: input.actorEmail,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (requestError) {
    // No request, no rotation: discard the staged copy so two states can never
    // disagree about what is waiting.
    await discardStagedSecret(input.name).catch(() => {})
    throw new DatabaseError('Failed to file the secret rotation request', requestError)
  }

  return { name: input.name, last4, requestId: (request as { id: string }).id }
}

/**
 * ⚠️ APPROVER PATH ONLY.
 *
 * Called from `AdminBillingService.decideActionRequest` after the approver is
 * confirmed to differ from the proposer. The value moves inside Postgres —
 * `platform_secret_promote` reads the staged Vault row and writes the live one;
 * it never crosses the wire to a client or into this process's memory.
 */
export async function promoteStagedSecret(
  name: string,
  approver: { id: string | null; email: string },
): Promise<void> {
  const { error } = await supabase.rpc('platform_secret_promote', {
    p_name: name,
    p_actor_id: approver.id,
    p_actor_email: approver.email,
  })

  if (error) {
    if (isAbsent(error.code)) {
      throw new SecretStoreUnavailableError('SECRET_STORE_UNAVAILABLE')
    }
    throw new DatabaseError(`Failed to promote platform secret "${name}"`, error)
  }

  await invalidateSecretCache(name)
}

/** Drop a staged rotation (rejection, or a failed request insert). */
export async function discardStagedSecret(name: string): Promise<void> {
  const { error } = await supabase.rpc('platform_secret_discard', { p_name: name })
  if (error && !isAbsent(error.code)) {
    throw new DatabaseError(`Failed to discard the staged secret "${name}"`, error)
  }
  await invalidateSecretCache(name)
}

export async function invalidateSecretCache(name: string): Promise<void> {
  await cacheService.del(cacheKey(name))
}

/**
 * Value + where it came from.
 *
 * Transitional by design: while a secret is still in an environment variable
 * this reports `source: 'env'` and records `SECRET_FROM_ENV` ONCE per process,
 * so the posture page can show it instead of the team forgetting it. The
 * environment is a fallback, never the preferred store.
 */
export async function resolveSecret(
  name: string,
  envValue: string | undefined,
): Promise<{ value: string | null; source: 'vault' | 'env' | 'none' }> {
  const fromVault = await getSecret(name)
  if (fromVault) return { value: fromVault, source: 'vault' }

  const trimmed = envValue?.trim()
  if (!trimmed) return { value: null, source: 'none' }

  // One event per secret per process: a hot path must not flood the log.
  const alreadyReported = await cacheService.get<boolean>(ENV_WARNING_KEY(name))
  if (!alreadyReported) {
    await cacheService.set(ENV_WARNING_KEY(name), true, 24 * 60 * 60)
    await AdminSecurityService.logSecurityEvent({
      eventType: 'SECRET_FROM_ENV',
      adminEmail: null,
      details: { name, action: 'move this secret to Vault' },
    }).catch(() => {})
  }

  return { value: trimmed, source: 'env' }
}

/** Names currently served from the environment — what the posture page reports. */
export async function secretsStillFromEnv(names: readonly string[]): Promise<string[]> {
  const stillInEnv: string[] = []
  for (const name of names) {
    const flagged = await cacheService.get<boolean>(ENV_WARNING_KEY(name))
    if (flagged) stillInEnv.push(name)
  }
  return stillInEnv
}

/** Test-only: forget the per-process environment warnings. */
export async function resetSecretStoreForTesting(): Promise<void> {
  for (const name of Object.values(PLATFORM_SECRETS)) {
    await cacheService.del(cacheKey(name))
    await cacheService.del(ENV_WARNING_KEY(name))
  }
}
