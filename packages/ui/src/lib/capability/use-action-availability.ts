// ============================================
// packages/ui/src/lib/capability/use-action-availability.ts
//
// UI Action Availability Hook
//
// Determines whether an action, button, tab, or screen is available
// right now, based on:
// 1. Feature Registry & Execution Mode (local vs server vs hybrid)
// 2. Device Edition (offline vs cloud)
// 3. Entitlement State (seam for Agent E / plan limits)
//
// ⚠️ NO DUPLICATE REGISTRY / NO RE-DERIVATION:
// Always calls `resolveEntitlement()` from `@hisabche/validation`.
//
// ⚠️ SEAM FOR E4 (Entitlement Hook-up):
// Agent E can register a live entitlement context provider via
// `registerEntitlementContextProvider()`.
// ============================================

import { useMemo } from 'react'
import {
  featureDefinition,
  resolveEntitlement,
  type EntitlementInput,
  type EntitlementVerdict,
  type FeatureDefinition,
  type FeatureKey,
  type FeaturePlan,
  type PlanEdition,
  type WorkspaceEntitlementState,
} from '@hisabche/validation'
import { getAppEdition } from '@hisabche/api'

export interface ActionAvailabilityOptions {
  /** For hybrid features: evaluate the 'local' action or the 'server' action */
  part?: 'local' | 'server' | undefined
  /** Explicit override for entitlement input (useful in tests and preview) */
  inputOverride?: Partial<EntitlementInput> | undefined
}

export interface ActionAvailability {
  /** True if the action can be performed right now */
  available: boolean
  /** Raw verdict from the pure validation resolver */
  verdict: EntitlementVerdict
  /** True if the feature requires a server/cloud connection and we are running offline */
  requiresOnline: boolean
  /** True if this feature requires an upgrade to a higher tier plan */
  requiresUpgrade: boolean
  /** The cheapest plan that unlocks this feature (if requiresUpgrade is true) */
  requiredPlan: FeaturePlan | null
  /** The feature definition from the registry */
  definition: FeatureDefinition
  /** For hybrid features, names the local and server responsibilities */
  hybrid?: { local?: string | undefined; server?: string | undefined } | undefined
  /** Machine-readable reason key */
  reason:
    'available' | 'offline_edition' | 'upgrade_required' | 'not_entitled' | 'exhausted' | 'expired'
}

/**
 * Seam for Agent E:
 * A provider function that supplies live workspace entitlement state.
 */
export type EntitlementContextProvider = () => {
  state: WorkspaceEntitlementState
  plan: FeaturePlan
  usageExhausted?: boolean | undefined
}

let activeEntitlementContextProvider: EntitlementContextProvider | null = null

/**
 * Register a live entitlement state provider (called by Agent E in Step E4).
 */
export function registerEntitlementContextProvider(
  provider: EntitlementContextProvider | null,
): void {
  activeEntitlementContextProvider = provider
}

/**
 * Derives current entitlement input from device edition and registered context.
 */
export function getCurrentEntitlementInput(): EntitlementInput {
  const appEdition = getAppEdition()
  const edition: PlanEdition = appEdition === 'offline' ? 'local' : 'cloud'

  if (activeEntitlementContextProvider) {
    const live = activeEntitlementContextProvider()
    return {
      state: live.state,
      plan: live.plan,
      edition,
      usageExhausted: live.usageExhausted,
    }
  }

  // Default baseline before E4 provider is mounted:
  if (edition === 'local') {
    return {
      state: 'OFFLINE_ACTIVE',
      plan: 'OFFLINE',
      edition: 'local',
      usageExhausted: false,
    }
  }

  return {
    state: 'ONLINE_ACTIVE',
    plan: 'ONLINE_500',
    edition: 'cloud',
    usageExhausted: false,
  }
}

/**
 * Pure helper to compute availability for a feature.
 */
export function checkActionAvailability(
  feature: FeatureKey,
  options?: ActionAvailabilityOptions | undefined,
): ActionAvailability {
  const definition = featureDefinition(feature)
  const baseInput = getCurrentEntitlementInput()
  const input: EntitlementInput = {
    ...baseInput,
    ...options?.inputOverride,
  }

  // For hybrid features: if evaluating specifically the local part, it is always
  // allowed locally unless plan/usage forbids it.
  const isHybrid = definition.execution === 'hybrid'
  const isLocalPart = isHybrid && options?.part === 'local'

  // If local part of a hybrid feature, evaluate against edition = 'cloud' so the resolver
  // checks only plan/usage, not the REQUIRES_ONLINE rule.
  const effectiveInput: EntitlementInput = isLocalPart ? { ...input, edition: 'cloud' } : input

  const verdict = resolveEntitlement(effectiveInput, feature)

  const requiresOnline = verdict.kind === 'REQUIRES_ONLINE'
  const requiresUpgrade = verdict.kind === 'REQUIRES_UPGRADE'
  const requiredPlan = verdict.kind === 'REQUIRES_UPGRADE' ? verdict.plan : null
  const available = verdict.kind === 'AVAILABLE'

  let reason: ActionAvailability['reason'] = 'available'
  if (requiresOnline) reason = 'offline_edition'
  else if (requiresUpgrade) reason = 'upgrade_required'
  else if (verdict.kind === 'NOT_ENTITLED') reason = 'not_entitled'
  else if (verdict.kind === 'EXHAUSTED') reason = 'exhausted'
  else if (verdict.kind === 'EXPIRED') reason = 'expired'

  return {
    available,
    verdict,
    requiresOnline,
    requiresUpgrade,
    requiredPlan,
    definition,
    hybrid: isHybrid ? { local: definition.local, server: definition.server } : undefined,
    reason,
  }
}

/**
 * Checks whether an error is a 501 OFFLINE_NOT_AVAILABLE response from the local engine.
 */
export function isOfflineNotAvailableError(error: unknown): boolean {
  if (!error) return false
  const status =
    (error as { status?: number; response?: { status?: number } })?.status ??
    (error as { response?: { status?: number } })?.response?.status
  if (status === 501) return true

  const data = (
    error as { response?: { data?: { error?: string; code?: string; message?: string } } }
  )?.response?.data
  if (data?.error === 'OFFLINE_NOT_AVAILABLE' || data?.code === 'OFFLINE_NOT_AVAILABLE') return true

  const message = (error as { message?: string })?.message ?? ''
  return message.includes('OFFLINE_NOT_AVAILABLE')
}

/**
 * React hook to evaluate feature and action availability at a button, screen, or tab.
 */
export function useActionAvailability(
  feature: FeatureKey,
  options?: ActionAvailabilityOptions | undefined,
): ActionAvailability {
  const part = options?.part
  const inputOverride = options?.inputOverride

  return useMemo(() => {
    return checkActionAvailability(feature, { part, inputOverride })
  }, [feature, part, inputOverride])
}
