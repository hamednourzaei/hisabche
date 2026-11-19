// ============================================
// packages/validation/src/schemas/universal-core/hybrid-activation.domain.ts
//
// PART 5 / Slice 5 — HYBRID ACTIVATION & MUTATION PHASES.
//
// After migration, four kinds of change exist. Confusing imported history with
// a new business event is how a migration double-posts invoices and stock.
// This pure rule classifies them and decides whether activation may proceed.
// ============================================

export type MutationPhase =
  'IMPORTED_HISTORY' | 'PRE_MIGRATION_PENDING' | 'POST_ACTIVATION_CLOUD' | 'POST_ACTIVATION_LOCAL'

export interface ActivationFacts {
  readonly importReconciled: boolean
  readonly deviceRegistered: boolean
  readonly baselineCursorEstablished: boolean
  readonly pendingMutationsReconciled: boolean
  readonly localDatabasePreserved: boolean
}

export interface ActivationDecision {
  readonly mayActivate: boolean
  readonly blockers: readonly string[]
}

export function evaluateHybridActivation(facts: ActivationFacts): ActivationDecision {
  const blockers: string[] = []
  if (!facts.importReconciled) blockers.push('IMPORT_NOT_RECONCILED')
  if (!facts.deviceRegistered) blockers.push('DEVICE_NOT_REGISTERED')
  if (!facts.baselineCursorEstablished) blockers.push('CURSOR_NOT_ESTABLISHED')
  if (!facts.pendingMutationsReconciled) blockers.push('PENDING_MUTATIONS_NOT_RECONCILED')
  if (!facts.localDatabasePreserved) blockers.push('LOCAL_DATABASE_NOT_PRESERVED')
  return { mayActivate: blockers.length === 0, blockers }
}

/**
 * Imported history must NEVER be replayed as a new business event. Only a
 * pending local mutation created before activation is eligible to push.
 */
export function shouldReplayAsMutation(phase: MutationPhase): boolean {
  return phase === 'PRE_MIGRATION_PENDING' || phase === 'POST_ACTIVATION_LOCAL'
}
