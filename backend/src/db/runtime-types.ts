// ============================================
// backend/src/db/runtime-types.ts
//
// Provider-Agnostic Database Runtime & HA/DR Contracts
// Defines provider interfaces, writer leases, fencing tokens,
// and replication health metrics.
// ============================================

export type DatabaseProviderType =
  'supabase' | 'standalone_postgres' | 'standby_postgres' | 'sqlite_local'

export interface ProviderCapabilities {
  readonly directTransactions: boolean
  readonly savepoints: boolean
  readonly preparedStatements: boolean
  readonly logicalReplication: boolean
  readonly physicalStreaming: boolean
  readonly rpcFunctions: boolean
  readonly rowLevelSecurity: boolean
}

export interface FencingToken {
  readonly epoch: number
  readonly writerId: string
  readonly issuedAt: string
  readonly signature?: string | undefined
}

export interface WriterLease {
  readonly epoch: number
  readonly writerId: string
  readonly grantedAt: string
  readonly expiresAt: string
  readonly active: boolean
  readonly fenceSignature?: string | undefined
}

export interface DistributedWriterLeaseRecord {
  readonly clusterKey: string
  readonly epoch: number
  readonly writerId: string
  readonly leaseExpiresAt: string
  readonly fenceSignature?: string | undefined
}

export interface WriterLeaseStore {
  readLease(clusterKey: string): Promise<DistributedWriterLeaseRecord | null>
  acquireOrRenewLease(params: {
    clusterKey: string
    writerId: string
    epoch: number
    ttlMs: number
    fenceSignature: string
  }): Promise<DistributedWriterLeaseRecord>
  promoteStandby(params: {
    clusterKey: string
    expectedEpoch: number
    newWriterId: string
    authorizedBy: string
    reason: string
    ttlMs: number
    fenceSignature: string
  }): Promise<DistributedWriterLeaseRecord>
  assertWriterEpoch(params: {
    clusterKey: string
    writerId: string
    epoch: number
  }): Promise<boolean>
}

export interface DatabaseHealth {
  readonly isHealthy: boolean
  readonly provider: DatabaseProviderType
  readonly role: 'primary' | 'standby' | 'replica'
  readonly replicationLagMs: number | null
  readonly activeConnections: number
  readonly lastCheckedAt: string
  readonly error?: string | undefined
  readonly schemaFingerprint?: string | undefined
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  readonly failureThreshold: number
  readonly successThreshold: number
  readonly timeoutMs: number
}

export interface PromotionDecision {
  readonly approved: boolean
  readonly previousWriterId: string
  readonly newWriterId: string
  readonly newEpoch: number
  readonly reason: string
  readonly authorizedBy: string
  readonly timestamp: string
  readonly clusterKey?: string | undefined
}
