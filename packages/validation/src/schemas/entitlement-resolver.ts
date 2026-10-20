// ============================================
// packages/validation/src/schemas/entitlement-resolver.ts
//
// The one decision about a feature — pure, and shared by everyone who needs
// it: the server (`entitlement.service.ts`), the local engine, and the UI
// hook (`useActionAvailability`).
//
// ⚠️ ONE ANSWER, THREE CALLERS
//
// The backend refuses a write with `403 FEATURE_NOT_ENTILED` or
// `402 PLAN_LIMIT_REACHED`; the local engine refuses the same write offline;
// the UI shows the same notice at the button. If the three derived the answer
// separately, the button would promise what the server refuses.
//
// ⚠️ PURE. NO I/O, NO DATABASE, NO DATE.
//
// The state is DATA, handed in. A resolver that read the clock would answer
// differently in the same second from two places, and the notice would lie.
// ============================================

import {
  cheapestPlanForEdition,
  featureDefinition,
  planEdition,
  type FeatureKey,
  type FeaturePlan,
  type PlanEdition,
} from './feature-registry'

/**
 * The seven states of a workspace.
 *
 * They are DERIVED (the subscription row, the licence, the counters) — this
 * is the vocabulary, not a second source of truth.
 */
export type WorkspaceEntitlementState =
  | 'FREE'
  | 'FREE_EXHAUSTED'
  | 'OFFLINE_ACTIVE'
  | 'OFFLINE_EXPIRED'
  | 'OFFLINE_BANNED'
  | 'ONLINE_ACTIVE'
  | 'ONLINE_PAST_DUE'
  | 'ONLINE_EXPIRED'

/** The six answers, exactly as the contract names them. */
export type EntitlementVerdict =
  | { kind: 'AVAILABLE' }
  /** The feature needs the cloud and the device is offline. */
  | { kind: 'REQUIRES_ONLINE' }
  /** No plan of this workspace's edition includes the feature. */
  | { kind: 'NOT_ENTITLED' }
  /** Another plan of this workspace's edition includes it — the cheapest one. */
  | { kind: 'REQUIRES_UPGRADE'; plan: FeaturePlan }
  /** The workspace used up its allowance. */
  | { kind: 'EXHAUSTED' }
  /** The term is over. */
  | { kind: 'EXPIRED' }

export interface EntitlementInput {
  /** The workspace's state. */
  state: WorkspaceEntitlementState
  /** The plan the workspace is on. */
  plan: FeaturePlan
  /** The edition the caller runs in. */
  edition: PlanEdition
  /** True when the workspace's usage ceiling is reached (the daily one too). */
  usageExhausted?: boolean | undefined
}

/**
 * The verdict for one feature.
 *
 * The order of the questions matters, and it is the order a person asks them:
 * 1. Is my plan still alive? (EXPIRED)
 * 2. Have I used it all? (EXHAUSTED)
 * 3. Can it run HERE? (REQUIRES_ONLINE)
 * 4. Is it in my plan? (REQUIRES_UPGRADE / NOT_ENTITLED)
 */
export function resolveEntitlement(
  input: EntitlementInput,
  feature: FeatureKey,
): EntitlementVerdict {
  const definition = featureDefinition(feature)

  // ⚠️ READING NEVER STOPS. A plan that ends locks the WRITES; the records
  // stay readable, printable and exportable (principle 6 — the data is never
  // held hostage).
  const alwaysAllowed = definition.alwaysAllowed === true

  if (input.state === 'OFFLINE_BANNED') {
    return alwaysAllowed ? { kind: 'AVAILABLE' } : { kind: 'NOT_ENTITLED' }
  }

  if (input.state === 'ONLINE_EXPIRED' || input.state === 'OFFLINE_EXPIRED') {
    return alwaysAllowed ? { kind: 'AVAILABLE' } : { kind: 'EXPIRED' }
  }

  if (input.state === 'FREE_EXHAUSTED' || input.usageExhausted === true) {
    return alwaysAllowed ? { kind: 'AVAILABLE' } : { kind: 'EXHAUSTED' }
  }

  // The place it runs. A hybrid feature has a local part — that part is
  // available offline; only the server part needs the cloud.
  const needsTheServer =
    definition.execution === 'server' ||
    (definition.execution === 'hybrid' && Boolean(definition.server))

  if (input.edition === 'local' && needsTheServer) {
    return { kind: 'REQUIRES_ONLINE' }
  }

  // The plan.
  if (definition.plans.includes(input.plan)) {
    return { kind: 'AVAILABLE' }
  }

  const upgrade = cheapestPlanForEdition(feature, planEdition(input.plan))
  if (upgrade) {
    return { kind: 'REQUIRES_UPGRADE', plan: upgrade }
  }

  // The feature belongs to the other edition only: no plan of this edition
  // would ever include it, so «upgrade» would be a lie.
  return { kind: 'NOT_ENTITLED' }
}
