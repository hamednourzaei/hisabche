// ============================================
// packages/validation/src/schemas/onboarding-gate.domain.ts
//
// SERVER-AUTHORITATIVE ONBOARDING ACTIVATION (PART 7 / hard access gate).
//
// A workspace must not become COMPLETED merely because a browser reached the
// last wizard screen. This pure predicate answers ONE question from facts the
// SERVER owns: may this account be marked as having finished onboarding?
//
// It computes no money, reads no database and imports no platform. Both the
// online route and the offline runtime can call it with facts they have read.
// Unknown/missing values never count as satisfied — the caller fails closed.
// ============================================

import { ONBOARDING_STATES, type OnboardingProgressState } from './operational-dna'

/** Blocking prerequisites, named so a client can show the exact next step. */
export type OnboardingPrerequisite =
  'IDENTITY' | 'WORKSPACE' | 'WORKSPACE_PROFILE' | 'DEFAULT_CURRENCY'

export interface OnboardingActivationFacts {
  /** Profile row: a person needs a name or a business name. */
  readonly profileFullName: string | null
  readonly profileBusinessName: string | null
  /** At least one active, non-suspended workspace membership. */
  readonly hasWorkspace: boolean
  /** The workspace's own business name (not the person's). */
  readonly workspaceBusinessName: string | null
  /** The currency chosen in onboarding, from the workspace progress answers. */
  readonly defaultCurrency: string | null
}

export interface OnboardingGateResult {
  readonly canActivate: boolean
  /** The derived progress state, reusing the existing workspace state vocabulary. */
  readonly state: OnboardingProgressState
  /** Blocking prerequisites — empty exactly when `canActivate` is true. */
  readonly missing: readonly OnboardingPrerequisite[]
  /**
   * Facts this runtime could not read. Recorded, never treated as satisfied.
   * The server decides whether an unreadable fact is a blocker in its own policy.
   */
  readonly unreadable: readonly string[]
}

const filled = (value: string | null): boolean =>
  typeof value === 'string' && value.trim().length > 0

/**
 * Decide whether onboarding may be marked complete. This is the authoritative
 * predicate: callers must not write the completion timestamp when `canActivate`
 * is false, and must not treat an exception while gathering facts as success.
 */
export function evaluateOnboardingActivation(
  facts: OnboardingActivationFacts,
  unreadable: readonly string[] = [],
): OnboardingGateResult {
  const missing: OnboardingPrerequisite[] = []

  if (!filled(facts.profileFullName) && !filled(facts.profileBusinessName)) {
    missing.push('IDENTITY')
  }
  if (!facts.hasWorkspace) missing.push('WORKSPACE')
  if (facts.hasWorkspace && !filled(facts.workspaceBusinessName)) missing.push('WORKSPACE_PROFILE')
  if (facts.hasWorkspace && !filled(facts.defaultCurrency)) missing.push('DEFAULT_CURRENCY')

  const canActivate = missing.length === 0
  const state: OnboardingProgressState = canActivate
    ? 'READY_TO_ACTIVATE'
    : !facts.hasWorkspace && !filled(facts.profileFullName) && !filled(facts.profileBusinessName)
      ? 'NOT_STARTED'
      : missing.includes('WORKSPACE_PROFILE') || missing.includes('DEFAULT_CURRENCY')
        ? 'REQUIRES_CONFIGURATION'
        : 'IN_PROGRESS'

  return { canActivate, state, missing, unreadable: [...unreadable] }
}

/** The progress state alone is never proof of completion; kept for callers that only hold it. */
export function progressStateAllowsActivation(state: OnboardingProgressState | null): boolean {
  return state === 'READY_TO_ACTIVATE' || state === 'ACTIVE'
}

export { ONBOARDING_STATES }
