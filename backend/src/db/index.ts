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
  setReplicaClientForTest,
  setReplicationLagProbeForTest,
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
} from './routing'
export {
  globalFencingEngine,
  WriterFencingEngine,
  SupabaseWriterLeaseStore,
  FencingTokenRejectedError,
} from './fencing'
export { replicaCircuitBreaker, ReplicaCircuitBreaker } from './circuit-breaker'
export { SchemaFingerprintEngine, CATALOG_INTROSPECTION_SQL } from './schema-fingerprint'
export type {
  CatalogColumnSpec,
  CatalogConstraintSpec,
  CatalogDiffResult,
  CatalogGrantSpec,
  CatalogIndexSpec,
  CatalogRlsPolicySpec,
  CatalogSchemaSnapshot,
  CatalogTableSpec,
  SchemaMetadataSummary,
  SchemaComparisonResult,
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
