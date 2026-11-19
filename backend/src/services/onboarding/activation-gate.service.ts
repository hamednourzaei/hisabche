// ============================================
// backend/src/services/onboarding/activation-gate.service.ts
//
// PART 7 — SERVER-AUTHORITATIVE ONBOARDING ACTIVATION.
//
// The completion timestamp on `profiles` is the product's record that a
// business was set up. A browser must not be able to set it just because it
// reached the last wizard screen. This service gathers ONLY server-owned facts
// and asks the shared pure predicate whether activation is allowed.
//
// Every read failure throws: «unknown» is never treated as «onboarding done».
// ============================================

import {
  evaluateOnboardingActivation,
  type OnboardingActivationFacts,
  type OnboardingGateResult,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { rowOf, rowText, rowsOf } from '../../utils/db-row'

interface ProfileOverride {
  readonly fullName?: string | null | undefined
  readonly businessName?: string | null | undefined
}

const nonEmpty = (value: unknown): string | null => {
  const text = rowText(value)
  return text !== null && text.trim().length > 0 ? text : null
}

/**
 * Evaluate onboarding activation for one account from the database, not from
 * a client claim. `override` carries fields being written in the SAME request
 * so a person completing the wizard in one PATCH is judged on what they sent.
 */
export async function evaluateOnboardingGateForUser(
  userId: string,
  override: ProfileOverride = {},
): Promise<OnboardingGateResult> {
  const unreadable: string[] = []

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, business_name')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw new Error(`ONBOARDING_GATE_PROFILE_READ_FAILED: ${profileError.message}`)
  const profile = rowOf(profileData)

  const { data: memberData, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .eq('has_access', true)
    .is('suspended_at', null)
  if (memberError) throw new Error(`ONBOARDING_GATE_MEMBERSHIP_READ_FAILED: ${memberError.message}`)
  const memberships = rowsOf(memberData)
  const target = memberships.find((m) => rowText(m.role) === 'owner') ?? memberships[0]
  const workspaceId = rowText(target?.workspace_id)
  const hasWorkspace = memberships.length > 0

  let workspaceBusinessName: string | null = null
  let defaultCurrency: string | null = null
  if (workspaceId) {
    const { data: wsData, error: wsError } = await supabase
      .from('workspaces')
      .select('name, base_currency, onboarding_progress')
      .eq('id', workspaceId)
      .maybeSingle()
    if (wsError) {
      // A database that has not run the base-currency migration yet cannot
      // store the choice. That is an unreadable fact, never a false «done».
      if (wsError.code === '42703' || wsError.code === 'PGRST204') {
        const retry = await supabase
          .from('workspaces')
          .select('name, onboarding_progress')
          .eq('id', workspaceId)
          .maybeSingle()
        if (retry.error)
          throw new Error(`ONBOARDING_GATE_WORKSPACE_READ_FAILED: ${retry.error.message}`)
        const fallback = rowOf(retry.data)
        workspaceBusinessName = nonEmpty(fallback?.name)
        const progress = rowOf(fallback?.onboarding_progress)
        const answers = rowOf(progress?.answers)
        defaultCurrency = nonEmpty(answers?.defaultCurrency)
        if (defaultCurrency === null) {
          // The column is absent AND the fallback carried no answer: the
          // currency is genuinely unknown, so fail closed (no invented AFN).
          unreadable.push('WORKSPACE_CURRENCY_UNKNOWN')
        }
      } else {
        throw new Error(`ONBOARDING_GATE_WORKSPACE_READ_FAILED: ${wsError.message}`)
      }
    } else {
      const workspace = rowOf(wsData)
      workspaceBusinessName = nonEmpty(workspace?.name)
      const progress = rowOf(workspace?.onboarding_progress)
      const answers = rowOf(progress?.answers)
      defaultCurrency = nonEmpty(workspace?.base_currency) ?? nonEmpty(answers?.defaultCurrency)
    }
  } else if (hasWorkspace) {
    // A membership whose row is malformed is an unreadable fact, never success.
    unreadable.push('WORKSPACE_IDENTITY')
  }

  const profileFullName =
    override.fullName !== undefined ? nonEmpty(override.fullName) : nonEmpty(profile?.full_name)
  const profileBusinessName =
    override.businessName !== undefined
      ? nonEmpty(override.businessName)
      : nonEmpty(profile?.business_name)

  const facts: OnboardingActivationFacts = {
    profileFullName,
    profileBusinessName,
    hasWorkspace,
    workspaceBusinessName,
    defaultCurrency,
  }
  return evaluateOnboardingActivation(facts, unreadable)
}

/** True only when every read succeeded and the predicate allowed activation. */
export function gateAllowsActivation(result: OnboardingGateResult): boolean {
  return result.canActivate && result.unreadable.length === 0
}
