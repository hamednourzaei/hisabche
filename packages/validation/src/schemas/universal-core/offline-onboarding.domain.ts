// ============================================
// packages/validation/src/schemas/universal-core/offline-onboarding.domain.ts
//
// PART 7 §6 — OFFLINE / HYBRID ONBOARDING BEHAVIOUR.
//
// An incomplete workspace may keep working offline, but it must never be
// presented as cloud-activated, and a stale server answer must not overwrite
// newer local progress. This pure rule decides the visible state from facts.
// ============================================

export type OfflineOnboardingState =
  | 'COMPLETE'
  /** Onboarding finished on the device; the business is usable without a cloud. */
  | 'COMPLETE_OFFLINE'
  | 'INCOMPLETE_READY'
  | 'INCOMPLETE_BLOCKED'

export interface OfflineOnboardingFacts {
  /** Local completion timestamp; null when the wizard is not finished. */
  readonly localCompletedAt: string | null
  /** The local progress step actually reached. */
  readonly localStep: number
  /** A cloud workspace has been activated and verified. */
  readonly cloudActivated: boolean
  /** The next mandatory step, when the local progress is missing/unreadable. */
  readonly nextRequiredStep: number | null
}

export interface OfflineOnboardingDecision {
  readonly state: OfflineOnboardingState
  readonly mayUseBusinessOffline: boolean
  readonly mayClaimCloudActivated: boolean
  readonly resumeStep: number | null
}

export function evaluateOfflineOnboarding(
  facts: OfflineOnboardingFacts,
): OfflineOnboardingDecision {
  const locallyComplete =
    typeof facts.localCompletedAt === 'string' && facts.localCompletedAt.length > 0

  if (locallyComplete) {
    // OFFLINE-FIRST: local completion is sufficient to run the business on the
    // device. Cloud activation only changes whether we may CLAIM a cloud sync.
    // A stale/unknown server answer must never take local work away.
    return {
      state: facts.cloudActivated ? 'COMPLETE' : 'COMPLETE_OFFLINE',
      mayUseBusinessOffline: true,
      mayClaimCloudActivated: facts.cloudActivated,
      resumeStep: null,
    }
  }

  // An incomplete or unknown step is NOT an empty dashboard: resume at the
  // next mandatory step. The caller supplies it; this rule never guesses it.
  const resumeStep = locallyComplete
    ? facts.nextRequiredStep
    : Number.isSafeInteger(facts.localStep) && facts.localStep >= 0
      ? facts.localStep
      : facts.nextRequiredStep

  return {
    state: resumeStep === null ? 'INCOMPLETE_BLOCKED' : 'INCOMPLETE_READY',
    mayUseBusinessOffline: false,
    mayClaimCloudActivated: false,
    resumeStep,
  }
}
