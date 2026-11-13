// ============================================
// backend/src/services/authorization/step-up.domain.ts
//
// Workspace two-step verification (V61 B.2.25): WHICH actions ask for a fresh
// authenticator code, and WHEN a code counts as fresh. Pure — no I/O.
//
// ⚠️ A CLOSED SET. Only these capabilities can be put behind a step-up. They
// are the ones that move money out of reach, close the books, or decide who
// may do anything at all. Reads are never in it: a step-up on every page load
// is a door everyone props open.
//
// ⚠️ THE TOTP FACTOR LIVES IN SUPABASE AUTH, not in our tables. A verified
// code gives the session `aal: 'aal2'` and an `amr` entry `{ method: 'totp',
// timestamp }`. We never see or store the secret.
// ============================================
import type { Capability } from './authorization.domain'

export const STEP_UP_ELIGIBLE = [
  'ledger.lock_period',
  'ledger.reverse',
  'payroll.post',
  'member.manage',
  'workspace.manage',
  'account.manage',
  'payment.cancel',
  'license.manage',
  'data.import',
] as const satisfies readonly Capability[]

export type StepUpCapability = (typeof STEP_UP_ELIGIBLE)[number]

/**
 * What a new workspace policy protects until the owner changes it. Every name
 * here is a real capability (the first version of this list named three that
 * did not exist — `payroll.manage`, `role.manage`, `bank.manage` — so nothing
 * was ever protected).
 */
export const DEFAULT_STEP_UP_CAPABILITIES: readonly StepUpCapability[] = [
  'ledger.lock_period',
  'payroll.post',
  'member.manage',
  'account.manage',
]

/** How long one authenticator code keeps sensitive actions open. */
export const STEP_UP_MAX_AGE_SECONDS = 10 * 60

export function isStepUpCapability(capability: string): capability is StepUpCapability {
  return (STEP_UP_ELIGIBLE as readonly string[]).includes(capability)
}

/** Unknown names are refused, never silently dropped. */
export function normalizeStepUpCapabilities(
  requested: readonly string[],
): { ok: true; value: StepUpCapability[] } | { ok: false; unknown: string[] } {
  const unknown = requested.filter((c) => !isStepUpCapability(c))
  if (unknown.length > 0) return { ok: false, unknown }
  return { ok: true, value: [...new Set(requested)] as StepUpCapability[] }
}

export interface SessionClaims {
  aal?: string | undefined
  amr?:
    | ReadonlyArray<{ method?: string | undefined; timestamp?: number | undefined } | string>
    | undefined
}

/** When this session last passed a TOTP check (seconds since epoch), or null. */
export function lastTotpAt(claims: SessionClaims): number | null {
  let latest: number | null = null
  for (const entry of claims.amr ?? []) {
    if (typeof entry === 'string') continue
    if (entry.method === 'totp' && typeof entry.timestamp === 'number') {
      latest = latest === null ? entry.timestamp : Math.max(latest, entry.timestamp)
    }
  }
  return latest
}

/**
 * A step-up is satisfied only by an AAL2 session whose TOTP check is recent.
 * AAL2 alone is not enough: it survives refreshes for the whole session, so a
 * laptop left open in the morning would still be "verified" at night.
 */
export function isFreshStepUp(
  claims: SessionClaims,
  nowMs: number,
  maxAgeSeconds: number = STEP_UP_MAX_AGE_SECONDS,
): boolean {
  if (claims.aal !== 'aal2') return false
  const at = lastTotpAt(claims)
  if (at === null) return false
  const ageSeconds = nowMs / 1000 - at
  return ageSeconds >= -60 && ageSeconds <= maxAgeSeconds
}

/** Recovery codes: 10 × 10 characters from an alphabet without look-alikes. */
export const RECOVERY_CODE_COUNT = 10
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function recoveryCodesFrom(randomBytes: Uint8Array): string[] {
  if (randomBytes.length < RECOVERY_CODE_COUNT * 10) {
    throw new Error('RECOVERY_CODE_ENTROPY_SHORT')
  }
  const codes: string[] = []
  for (let c = 0; c < RECOVERY_CODE_COUNT; c++) {
    let code = ''
    for (let i = 0; i < 10; i++) code += ALPHABET[randomBytes[c * 10 + i]! % ALPHABET.length]
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`)
  }
  return codes
}
