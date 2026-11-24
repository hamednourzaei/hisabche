export { primaryDb, supabase } from './primary'
export {
  replicaDb,
  getReplicaClientOrPrimary,
  checkReplicaHealth,
  checkPrimaryPing,
  measureReplicaLagMs,
  setReplicaClientForTest,
} from './replica'
export { adminDb } from './admin'
export {
  REPLICA_READ_ALLOWLIST,
  isReplicaAllowedCaller,
  selectReadClient,
  selectWriteClient,
  getDatabaseRoutingOverview,
  DEFAULT_MAX_REPLICA_LAG_MS,
} from './routing'
export { globalFencingEngine, WriterFencingEngine, FencingTokenRejectedError } from './fencing'
export { replicaCircuitBreaker, ReplicaCircuitBreaker } from './circuit-breaker'
export { SchemaFingerprintEngine } from './schema-fingerprint'
export type { SchemaMetadataSummary, SchemaComparisonResult } from './schema-fingerprint'
export type {
  DatabaseProviderType,
  ProviderCapabilities,
  FencingToken,
  WriterLease,
  DatabaseHealth,
  CircuitBreakerState,
  CircuitBreakerConfig,
  PromotionDecision,
} from './runtime-types'
