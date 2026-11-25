export {
  primaryDb,
  supabase,
  registerWriterClient,
  getRegisteredWriterClient,
  clearRegisteredWriterClients,
} from './primary'
export {
  replicaDb,
  getReplicaClientOrPrimary,
  checkReplicaHealth,
  checkPrimaryPing,
  measureReplicaLagMs,
  measureReplicaLagDetails,
  queryReadClient,
  recordReplicaFallback,
  getReplicaObservabilityMetrics,
  resetReplicaMetricsForTest,
  setReplicaClientForTest,
  setReplicationLagProbeForTest,
} from './replica'
export type {
  ReplicationLagSource,
  ReplicationLagMeasurement,
  ReplicaObservabilityMetrics,
} from './replica'
export { adminDb } from './admin'
export {
  REPLICA_READ_ALLOWLIST,
  isReplicaAllowedCaller,
  selectReadClient,
  selectWriteClient,
  selectWriteClientDistributed,
  getDatabaseRoutingOverview,
  DEFAULT_MAX_REPLICA_LAG_MS,
  DEFAULT_MAX_MEASUREMENT_AGE_MS,
} from './routing'
export type { ReadConsistencyPolicy } from './routing'
export {
  globalFencingEngine,
  WriterFencingEngine,
  SupabaseWriterLeaseStore,
  FencingTokenRejectedError,
  bindDefaultDistributedLeaseStore,
} from './fencing'
export { replicaCircuitBreaker, ReplicaCircuitBreaker } from './circuit-breaker'
export { SchemaFingerprintEngine, CATALOG_INTROSPECTION_SQL } from './schema-fingerprint'
export { executeControlledStandbyPromotion, recoverFormerPrimary } from './ha-promotion'
export type {
  PromotionStage,
  StandbyCandidateHealth,
  ControlledPromotionInput,
  PromotionAuditRecord,
  FormerPrimaryRecoveryResult,
} from './ha-promotion'
export type {
  CatalogColumnSpec,
  CatalogConstraintSpec,
  CatalogDiffResult,
  CatalogGrantSpec,
  CatalogIndexSpec,
  CatalogRlsPolicySpec,
  CatalogSchemaSnapshot,
  CatalogTableSpec,
  CatalogViewSpec,
  SchemaMetadataSummary,
  SchemaComparisonResult,
  SchemaParityReport,
} from './schema-fingerprint'
export type {
  DatabaseProviderType,
  ProviderCapabilities,
  FencingToken,
  WriterLease,
  DistributedWriterLeaseRecord,
  WriterLeaseStore,
  DatabaseHealth,
  CircuitBreakerState,
  CircuitBreakerConfig,
  PromotionDecision,
} from './runtime-types'
