// ============================================
// backend/src/services/workspace-profile.ts
//
// The Business Profile of a WORKSPACE — the server's authoritative copy.
//
// Owner decision D4 = B (V53-OWNER-DECISIONS.md): the profile lives on the
// workspace and decides which capabilities are on. It is the SAME pure
// resolver the screens use (`resolveBusinessProfile`), so the server and the
// UI cannot disagree about what a profile means.
//
//   • A workspace that never declared a profile (`workspaces.business_types`
//     NULL or empty — every workspace that exists today) is `declared: false`
//     and is NEVER restricted. No business is locked out by this change.
//   • A database without docs/business-profile-01-migration.sql answers
//     `declared: false` too — exactly what the system did before.
//   • A read that fails for any other reason throws: answering «undeclared»
//     (= everything allowed) on the strength of a failure would switch the
//     capability check off.
//   • Changing the profile writes the profile columns and NOTHING else — no
//     role, no permission, no historical row.
//
// ⚠️ A capability is only HALF of an authorization: the caller still needs the
// permission (`requireCapability`). The profile never grants one.
//
// ⚠️ Imports no other service (CLAUDE.md: a service imported for a constant
// closes an import cycle that only shows on the live server).
// ============================================

import {
  canonicalIndustryTypes,
  composeBusinessSolution,
  onboardingProgressSchema,
  operationalDnaSchema,
  resolveBusinessProfile,
  type BusinessProfile,
  type CompositionPlan,
  type IndustryKey,
  type OnboardingProgress,
  type OperationalDna,
} from '@hisabche/validation'

import { supabase } from '../db'
import { ConflictError, DatabaseError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'

const isMissingColumn = (code: string | undefined) => code === '42703' || code === 'PGRST204'

export interface WorkspaceProfile {
  /** True only when the workspace stored at least one recognised trade. */
  readonly declared: boolean
  readonly types: readonly IndustryKey[]
  readonly profile: BusinessProfile
  /** False until docs/business-profile-01-migration.sql has run. */
  readonly configurable: boolean
}

const UNDECLARED = (configurable: boolean): WorkspaceProfile => ({
  declared: false,
  types: [],
  profile: resolveBusinessProfile([]),
  configurable,
})

export async function workspaceProfileOf(workspaceId: string): Promise<WorkspaceProfile> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('business_types')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error.code)) return UNDECLARED(false)
    throw new DatabaseError('Failed to read the workspace business profile', error)
  }

  const stored = (data as { business_types?: string[] | null } | null)?.business_types
  const { known } = canonicalIndustryTypes(stored ?? [])
  if (known.length === 0) return UNDECLARED(true)

  return {
    declared: true,
    types: known,
    profile: resolveBusinessProfile(known),
    configurable: true,
  }
}

/**
 * Declare (or change) the workspace profile.
 *
 * The CALLER must already hold `workspace.manage` — the route enforces it. This
 * function trusts nothing in `input`: every value must be a registry key.
 */
export async function setWorkspaceProfile(
  workspaceId: string,
  userId: string,
  input: readonly string[],
): Promise<WorkspaceProfile> {
  const canonical = canonicalIndustryTypes(input)
  if (canonical.unknown.length > 0 || canonical.legacy.length > 0) {
    throw new ValidationError(
      `BUSINESS_TYPE_UNKNOWN: ${[...canonical.unknown, ...canonical.legacy].join(', ')}`,
    )
  }
  if (canonical.known.length === 0) {
    throw new ValidationError('BUSINESS_TYPE_REQUIRED')
  }

  const { data, error } = await supabase
    .from('workspaces')
    .update({
      business_types: [...canonical.known],
      business_profile_updated_at: new Date().toISOString(),
      business_profile_updated_by: userId,
    })
    .eq('id', workspaceId)
    .select('id')

  if (error) {
    if (isMissingColumn(error.code)) throw new ConflictError('WORKSPACE_PROFILE_NOT_CONFIGURED')
    throw new DatabaseError('Failed to store the workspace business profile', error)
  }
  if (!data || data.length === 0) throw new ConflictError('WORKSPACE_NOT_FOUND')

  return {
    declared: true,
    types: canonical.known,
    profile: resolveBusinessProfile(canonical.known),
    configurable: true,
  }
}

// ─── Operational DNA and onboarding progress (V54 5.2 / 5.3) ──────────────
//
// docs/operational-profile-01-migration.sql. The DNA is written ONLY through
// `workspace_set_operational_dna` (lock, version check, history row — one
// transaction). Like the trades above, it suggests; it grants or removes no
// permission and touches no historical row.

export interface WorkspaceOperationalProfile {
  /** False until docs/operational-profile-01-migration.sql has run. */
  readonly configurable: boolean
  readonly dna: OperationalDna | null
  /** Computed composition plan (P1–P10, capabilities, presentation); never stored in DB. */
  readonly composition: CompositionPlan | null
  /** 0 = never declared. The next save must name this number. */
  readonly version: number
  readonly onboarding: OnboardingProgress | null
}

const NOT_CONFIGURED: WorkspaceOperationalProfile = {
  configurable: false,
  dna: null,
  composition: null,
  version: 0,
  onboarding: null,
}

const isMissingFunction = (error: { code?: string; message?: string }) =>
  (error.code === 'PGRST202' || error.code === '42883') &&
  (error.message ?? '').includes('workspace_set_operational_dna')

export async function operationalProfileOf(
  workspaceId: string,
): Promise<WorkspaceOperationalProfile> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('operational_dna, operational_dna_version, onboarding_progress')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error.code)) return NOT_CONFIGURED
    throw new DatabaseError('Failed to read the operational profile', error)
  }
  const row = (data ?? {}) as {
    operational_dna?: unknown
    operational_dna_version?: number | null
    onboarding_progress?: unknown
  }
  // A stored value that no longer parses is reported as absent, not repaired.
  const dna = operationalDnaSchema.safeParse(row.operational_dna)
  const onboarding = onboardingProgressSchema.safeParse(row.onboarding_progress)
  const validDna = row.operational_dna == null || !dna.success ? null : dna.data
  return {
    configurable: true,
    dna: validDna,
    composition: validDna ? composeBusinessSolution(validDna) : null,
    version: row.operational_dna_version ?? 0,
    onboarding: row.onboarding_progress == null || !onboarding.success ? null : onboarding.data,
  }
}

export async function setOperationalDna(
  workspaceId: string,
  userId: string,
  input: unknown,
  expectedVersion: number,
): Promise<{ version: number; replayed: boolean }> {
  const parsed = operationalDnaSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('OPERATIONAL_DNA_INVALID')

  const { data, error } = await supabase.rpc('workspace_set_operational_dna', {
    p_workspace_id: workspaceId,
    p_actor: userId,
    p_dna: parsed.data,
    p_expected_version: expectedVersion,
  })
  if (error) {
    if (isMissingFunction(error)) throw new ConflictError('OPERATIONAL_PROFILE_NOT_CONFIGURED')
    const message = error.message ?? ''
    if (message.includes('OPERATIONAL_PROFILE_CHANGED')) {
      throw new ConflictError('OPERATIONAL_PROFILE_CHANGED')
    }
    if (message.includes('WORKSPACE_NOT_FOUND')) throw new ConflictError('WORKSPACE_NOT_FOUND')
    throw new DatabaseError('Failed to store the operational profile', error)
  }
  const result = (data ?? {}) as { version?: number; replayed?: boolean }
  return { version: result.version ?? expectedVersion, replayed: result.replayed === true }
}

export async function setOnboardingProgress(
  workspaceId: string,
  input: unknown,
): Promise<OnboardingProgress> {
  const parsed = onboardingProgressSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('ONBOARDING_PROGRESS_INVALID')

  const { data, error } = await supabase
    .from('workspaces')
    .update({ onboarding_progress: parsed.data })
    .eq('id', workspaceId)
    .select('id')
  if (error) {
    if (isMissingColumn(error.code)) throw new ConflictError('OPERATIONAL_PROFILE_NOT_CONFIGURED')
    throw new DatabaseError('Failed to store the onboarding progress', error)
  }
  if (!data || data.length === 0) throw new ConflictError('WORKSPACE_NOT_FOUND')
  return parsed.data
}
