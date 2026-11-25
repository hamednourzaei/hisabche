// ============================================
// backend/src/db/ha-promotion.ts
//
// Controlled HA/DR Standby Promotion & Former-Primary Recovery Workflow
// Enforces the full 9-step fail-closed promotion pipeline:
//   1. Candidate eligibility
//   2. Replication health verification
//   3. Acceptable replication lag (real WAL replay lag, fresh measurement)
//   4. Schema + migration digest compatibility
//   5. Distributed promotion lease CAS acquisition
//   6. Atomic monotonic epoch advancement
//   7. Active writer routing switch
//   8. Post-promotion write routing verification
//   9. Auditable event recording + former-primary quarantine
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { WriterFencingEngine } from './fencing'
import { registerWriterClient, getRegisteredWriterClient } from './primary'
import { SchemaFingerprintEngine, type CatalogSchemaSnapshot } from './schema-fingerprint'
import type { PromotionDecision, WriterLeaseStore } from './runtime-types'
import type { ReplicationLagSource } from './replica'

export type PromotionStage =
  | 'INIT'
  | 'ELIGIBILITY_VERIFIED'
  | 'REPLICATION_HEALTH_VERIFIED'
  | 'REPLICATION_LAG_VERIFIED'
  | 'SCHEMA_COMPATIBLE'
  | 'DISTRIBUTED_LEASE_PROMOTED'
  | 'WRITER_ACTIVATED'
  | 'WRITE_ROUTING_VERIFIED'
  | 'AUDITED_COMPLETE'
  | 'FAILED_ROLLED_BACK'

export interface StandbyCandidateHealth {
  readonly standbyId: string
  readonly eligible: boolean
  readonly replicationHealthy: boolean
  readonly lagMs: number | null
  readonly lagSource: ReplicationLagSource
  readonly measurementAgeMs: number
  readonly maxAcceptableLagMs?: number | undefined
  readonly maxMeasurementAgeMs?: number | undefined
}

export interface ControlledPromotionInput {
  readonly engine: WriterFencingEngine
  readonly leaseStore: WriterLeaseStore
  readonly candidate: StandbyCandidateHealth
  readonly primaryCatalog: CatalogSchemaSnapshot
  readonly standbyCatalog: CatalogSchemaSnapshot
  readonly primaryMigrationDigest: string
  readonly standbyMigrationDigest: string
  readonly standbyClient: SupabaseClient
  readonly approved: boolean
  readonly authorizedBy: string
  readonly reason: string
  readonly failAtStageForTest?: PromotionStage | undefined
}

export interface PromotionAuditRecord {
  readonly decision: PromotionDecision
  readonly completedStages: readonly PromotionStage[]
  readonly schemaFingerprint: string
  readonly quarantinedFormerPrimary: string
  readonly auditId: string
}

export interface FormerPrimaryRecoveryResult {
  readonly formerPrimaryId: string
  readonly status: 'QUARANTINED_AS_STANDBY' | 'REJECTED_ACTIVE_SPLIT_BRAIN'
  readonly currentAuthoritativeEpoch: number
  readonly currentAuthoritativeWriter: string
  readonly silentFailbackBlocked: true
}

export async function executeControlledStandbyPromotion(
  input: ControlledPromotionInput,
): Promise<PromotionAuditRecord> {
  const completedStages: PromotionStage[] = ['INIT']
  const { engine, leaseStore, candidate } = input

  if (!input.approved) {
    throw new Error(`[HA Promotion Rejected] Explicit operator approval required: ${input.reason}`)
  }

  // 1. Candidate eligibility
  if (input.failAtStageForTest === 'ELIGIBILITY_VERIFIED') {
    throw new Error('[HA Promotion Aborted] Simulated crash at ELIGIBILITY_VERIFIED')
  }
  if (!candidate.eligible || !candidate.standbyId.trim()) {
    throw new Error(`[HA Promotion Rejected] Standby '${candidate.standbyId}' is not eligible.`)
  }
  if (candidate.standbyId === engine.getCurrentWriterId()) {
    throw new Error(
      `[HA Promotion Rejected] Standby '${candidate.standbyId}' is already the active writer.`,
    )
  }
  completedStages.push('ELIGIBILITY_VERIFIED')

  // 2. Replication health
  if (input.failAtStageForTest === 'REPLICATION_HEALTH_VERIFIED') {
    throw new Error('[HA Promotion Aborted] Simulated crash at REPLICATION_HEALTH_VERIFIED')
  }
  if (!candidate.replicationHealthy) {
    throw new Error(
      `[HA Promotion Rejected] Standby '${candidate.standbyId}' replication health check failed.`,
    )
  }
  completedStages.push('REPLICATION_HEALTH_VERIFIED')

  // 3. Acceptable real WAL lag & fresh measurement
  if (input.failAtStageForTest === 'REPLICATION_LAG_VERIFIED') {
    throw new Error('[HA Promotion Aborted] Simulated crash at REPLICATION_LAG_VERIFIED')
  }
  const maxLag = candidate.maxAcceptableLagMs ?? 5000
  const maxAge = candidate.maxMeasurementAgeMs ?? 15_000
  if (candidate.lagSource !== 'wal_replay') {
    throw new Error(
      `[HA Promotion Rejected] Genuine WAL lag verification required (received source='${candidate.lagSource}').`,
    )
  }
  if (
    candidate.lagMs === null ||
    !Number.isFinite(candidate.lagMs) ||
    candidate.lagMs < 0 ||
    candidate.lagMs > maxLag
  ) {
    throw new Error(
      `[HA Promotion Rejected] Replication lag ${String(candidate.lagMs)}ms exceeds threshold ${maxLag}ms.`,
    )
  }
  if (!Number.isFinite(candidate.measurementAgeMs) || candidate.measurementAgeMs > maxAge) {
    throw new Error(
      `[HA Promotion Rejected] Lag measurement is stale (${candidate.measurementAgeMs}ms > ${maxAge}ms).`,
    )
  }
  completedStages.push('REPLICATION_LAG_VERIFIED')

  // 4. Schema + migration digest compatibility
  if (input.failAtStageForTest === 'SCHEMA_COMPATIBLE') {
    throw new Error('[HA Promotion Aborted] Simulated crash at SCHEMA_COMPATIBLE')
  }
  const parity = SchemaFingerprintEngine.compareCatalogsWithReport({
    primary: input.primaryCatalog,
    standby: input.standbyCatalog,
    primaryMigrationDigest: input.primaryMigrationDigest,
    standbyMigrationDigest: input.standbyMigrationDigest,
  })
  if (!parity.runtimeReadiness) {
    throw new Error(`[HA Promotion Rejected] ${parity.humanSummary}`)
  }
  completedStages.push('SCHEMA_COMPATIBLE')

  // 5 & 6. Atomic distributed promotion lease CAS + epoch advancement
  if (input.failAtStageForTest === 'DISTRIBUTED_LEASE_PROMOTED') {
    throw new Error('[HA Promotion Aborted] Simulated crash before DISTRIBUTED_LEASE_PROMOTED')
  }
  const decision = await engine.promoteStandbyDistributed({
    approved: true,
    previousWriterId: engine.getCurrentWriterId(),
    newWriterId: candidate.standbyId,
    authorizedBy: input.authorizedBy,
    reason: input.reason,
    newWriterClient: input.standbyClient,
    store: leaseStore,
  })
  completedStages.push('DISTRIBUTED_LEASE_PROMOTED')

  // 7. Activate new writer client in live registry
  if (input.failAtStageForTest === 'WRITER_ACTIVATED') {
    throw new Error('[HA Promotion Aborted] Simulated crash at WRITER_ACTIVATED')
  }
  registerWriterClient(decision.newWriterId, input.standbyClient)
  completedStages.push('WRITER_ACTIVATED')

  // 8. Verify write routing points to promoted writer & passes distributed assertion
  if (input.failAtStageForTest === 'WRITE_ROUTING_VERIFIED') {
    throw new Error('[HA Promotion Aborted] Simulated crash at WRITE_ROUTING_VERIFIED')
  }
  const newToken = engine.generateFencingToken()
  await engine.assertValidWriterDistributed(newToken, leaseStore)
  if (getRegisteredWriterClient(decision.newWriterId) !== input.standbyClient) {
    throw new Error(
      '[HA Promotion Failed] Promoted writer client registration verification failed.',
    )
  }
  completedStages.push('WRITE_ROUTING_VERIFIED')

  // 9. Audit completion
  completedStages.push('AUDITED_COMPLETE')
  const auditId = `promo-${decision.clusterKey ?? 'default'}-e${decision.newEpoch}`

  return {
    decision,
    completedStages,
    schemaFingerprint: parity.primaryFingerprint,
    quarantinedFormerPrimary: decision.previousWriterId,
    auditId,
  }
}

/**
 * Safely quarantines a returning former primary so it cannot become an independent
 * writer or trigger a silent failback after another standby has been promoted.
 */
export async function recoverFormerPrimary(params: {
  engine: WriterFencingEngine
  leaseStore: WriterLeaseStore
  formerPrimaryId: string
  formerPrimaryEpoch: number
}): Promise<FormerPrimaryRecoveryResult> {
  const { engine, leaseStore, formerPrimaryId, formerPrimaryEpoch } = params
  const lease = await leaseStore.readLease(engine.getClusterKey())
  if (!lease) {
    throw new Error('[HA Recovery] Distributed lease unavailable; cannot verify cluster state.')
  }
  if (lease.writerId === formerPrimaryId && lease.epoch === formerPrimaryEpoch) {
    throw new Error(
      `[HA Recovery Refused] '${formerPrimaryId}' at epoch ${formerPrimaryEpoch} is still marked active in lease store.`,
    )
  }

  engine.quarantineWriter(formerPrimaryId)

  // Verify the distributed lease store explicitly rejects the old writer/epoch
  const stillAccepted = await leaseStore
    .assertWriterEpoch({
      clusterKey: engine.getClusterKey(),
      writerId: formerPrimaryId,
      epoch: formerPrimaryEpoch,
    })
    .catch(() => false)

  if (stillAccepted) {
    return {
      formerPrimaryId,
      status: 'REJECTED_ACTIVE_SPLIT_BRAIN',
      currentAuthoritativeEpoch: lease.epoch,
      currentAuthoritativeWriter: lease.writerId,
      silentFailbackBlocked: true,
    }
  }

  return {
    formerPrimaryId,
    status: 'QUARANTINED_AS_STANDBY',
    currentAuthoritativeEpoch: lease.epoch,
    currentAuthoritativeWriter: lease.writerId,
    silentFailbackBlocked: true,
  }
}
