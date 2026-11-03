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
  resolveBusinessProfile,
  type BusinessProfile,
  type IndustryKey,
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
