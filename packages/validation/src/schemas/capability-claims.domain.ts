// ============================================
// packages/validation/src/schemas/capability-claims.domain.ts
//
// V65 · V64 §4 phase 1 — «what may the registry claim about a capability?»
//
// The capability registry is what the customer is told. It had already started
// lying: `serialized_items` said serials «cannot be recorded offline» while the
// device records and issues them, and the coverage table repeated the lie.
//
// This module is the ONE place that decides whether a claim is consistent with
// the code, and it is pure — the caller supplies the registry and the generated
// wiring matrix (`docs/architecture/universal-core/ENGINE-WIRING.csv`), so the
// same rules can be run against the real registry in a test and against a
// deliberately broken copy in the injection test.
//
// ⚠️ WHAT IS DELIBERATELY NOT ASSERTED
// A limitation such as `LINE_PRICING_FROM_PURITY_NOT_WIRED` or
// `QUANTITY_BREAK_UI_BASIC` says a BEHAVIOUR is missing inside a screen that
// exists. No file graph can disprove that, and pretending to check it would be
// the same dishonesty in the other direction. Only claims the repository CAN
// disprove are asserted:
//
//   * the status/limitation shape,
//   * the offline row of the engine a capability rides on,
//   * «no route answers this» (a route that imports the capability's own
//     evidence exists ⇒ the claim is stale),
//   * «no offline engine» / «online only» (the engine declares one / is
//     available offline ⇒ the claim is stale).
// ============================================

import type { CapabilityStatus } from './business-capabilities'

/** The languages every limitation code must be readable in. */
export const CLAIM_LANGUAGES = ['fa', 'af', 'en'] as const

export type ClaimViolationCode =
  | 'AVAILABLE_WITH_LIMITATION'
  | 'AVAILABLE_NOT_OFFLINE_AVAILABLE'
  | 'PARTIAL_WITHOUT_LIMITATION'
  | 'PLANNED_WITH_LIMITATION'
  | 'UNKNOWN_ENGINE'
  | 'LIMITATION_CODE_NOT_CANONICAL'
  | 'LIMITATION_NOT_TRANSLATED'
  | 'SERVER_ONLY_CLAIM_CONTRADICTED'
  | 'ONLINE_ONLY_CLAIM_CONTRADICTED'
  | 'NO_ROUTE_CLAIM_CONTRADICTED'

export interface ClaimedCapability {
  readonly key: string
  readonly status: CapabilityStatus
  readonly engine: string | null
  /** A backend route imports this capability's OWN evidence sources. */
  readonly hasBackendRoute: boolean
  readonly limitations: readonly string[]
}

export interface ClaimedEngine {
  readonly key: string
  readonly localEngine: string | null
  readonly offlineStatus: string
}

export interface ClaimViolation {
  readonly capability: string
  readonly code: ClaimViolationCode
  readonly detail: string
}

export interface ClaimInput {
  readonly capabilities: readonly ClaimedCapability[]
  readonly engines: readonly ClaimedEngine[]
  /** language → every limitation code that language can say. */
  readonly limitationText: Readonly<Record<string, readonly string[]>>
}

/** `SOME_CODE`, never prose and never a translated sentence. */
const CANONICAL_CODE = /^[A-Z][A-Z0-9_]*$/

const SERVER_ONLY_CODE = 'SERVER_ONLY_NO_OFFLINE_ENGINE'
const ONLINE_ONLY = /_ONLINE_ONLY$/
const NO_ROUTE = /^NO_SERVER_ROUTE/
const NOT_WIRED = /_UNWIRED$/

/**
 * Every inconsistency between what the registry says and what the code is.
 * An empty array is the only acceptable result for the real registry.
 */
export function capabilityClaimViolations(input: ClaimInput): readonly ClaimViolation[] {
  const violations: ClaimViolation[] = []
  const engines = new Map(input.engines.map((engine) => [engine.key, engine]))
  const translated = new Map(
    CLAIM_LANGUAGES.map((language) => [language, new Set(input.limitationText[language] ?? [])]),
  )

  for (const capability of input.capabilities) {
    const push = (code: ClaimViolationCode, detail: string) =>
      violations.push({ capability: capability.key, code, detail })

    const engine = capability.engine === null ? undefined : engines.get(capability.engine)

    // 1. An engine name that is not in the registry is a dangling reference.
    if (capability.engine !== null && engine === undefined) {
      push('UNKNOWN_ENGINE', `engine «${capability.engine}» is not in ENGINE_KEYS`)
    }

    // 2. `available` is the ONE status that promises a finished chain, so it
    //    may carry no limitation and its engine must be usable offline.
    if (capability.status === 'available') {
      for (const limitation of capability.limitations) {
        push('AVAILABLE_WITH_LIMITATION', `available capabilities cannot carry «${limitation}»`)
      }
      if (engine === undefined) {
        push('AVAILABLE_NOT_OFFLINE_AVAILABLE', 'an available capability needs an engine')
      } else if (engine.offlineStatus !== 'available') {
        push(
          'AVAILABLE_NOT_OFFLINE_AVAILABLE',
          `engine «${engine.key}» is «${engine.offlineStatus}» offline`,
        )
      }
    }

    // 3. `partial` without a reason is the shape that hid the serial defect:
    //    a downgrade with no sentence beside it.
    if (capability.status === 'partial' && capability.limitations.length === 0) {
      push('PARTIAL_WITHOUT_LIMITATION', 'a partial capability must say what is missing')
    }

    // 4. `planned` is «nothing usable yet», so a limitation would describe a
    //    screen that does not exist. Promote the status instead.
    if (capability.status === 'planned' && capability.limitations.length > 0) {
      push(
        'PLANNED_WITH_LIMITATION',
        'a planned capability carries no limitation — promote it instead',
      )
    }

    for (const limitation of capability.limitations) {
      // 5. The code is a stable key, not a sentence.
      if (!CANONICAL_CODE.test(limitation)) {
        push('LIMITATION_CODE_NOT_CANONICAL', `«${limitation}» is not an UPPER_SNAKE code`)
        continue
      }

      // 6. A code the customer cannot read is a broken screen (`t()` throws).
      for (const [language, codes] of translated) {
        if (!codes.has(limitation)) {
          push('LIMITATION_NOT_TRANSLATED', `${language} cannot say «${limitation}»`)
        }
      }

      // 7. «works online only» must not be claimed by an engine that works offline.
      if (limitation === SERVER_ONLY_CODE && engine !== undefined && engine.localEngine !== null) {
        push(
          'SERVER_ONLY_CLAIM_CONTRADICTED',
          `«${limitation}» but engine «${engine.key}» has ${engine.localEngine}`,
        )
      }
      if (
        ONLINE_ONLY.test(limitation) &&
        engine !== undefined &&
        engine.offlineStatus === 'available'
      ) {
        push(
          'ONLINE_ONLY_CLAIM_CONTRADICTED',
          `«${limitation}» but engine «${engine.key}» is available offline`,
        )
      }

      // 8. «there is no route for this» is disproved by a route that imports the
      //    capability's own evidence — the check that would have caught a
      //    «no screen yet» claim after the screen shipped.
      if ((NO_ROUTE.test(limitation) || NOT_WIRED.test(limitation)) && capability.hasBackendRoute) {
        push(
          'NO_ROUTE_CLAIM_CONTRADICTED',
          `«${limitation}» but a backend route already serves this capability`,
        )
      }
    }
  }

  return violations
}
