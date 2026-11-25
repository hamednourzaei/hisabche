// ============================================
// packages/validation/src/capacity-intelligence.ts
//
// V76 Capacity, Adaptive Scale & Tenant Isolation Domain Contracts.
// Distinguishes MEASURED, DERIVED, ESTIMATED, PREDICTED, and UNAVAILABLE
// values so simulated capacity is never presented as live production reality.
// ============================================

export type MetricValueKind = 'MEASURED' | 'DERIVED' | 'ESTIMATED' | 'PREDICTED' | 'UNAVAILABLE'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA'

export type CapacityRunStatus = 'COMPLETED' | 'ABORTED' | 'SAFETY_STOPPED' | 'BLOCKED'

export type LimitingResource =
  | 'cpu'
  | 'memory'
  | 'database_connections'
  | 'database_queries'
  | 'event_loop'
  | 'worker_queue'
  | 'network'
  | 'storage'
  | 'unknown'

export const BENCHMARK_SUITE_IDS = [
  '01-cpu-saturation',
  '02-ram-capacity',
  '03-database-stress',
  '04-financial-transactions',
  '05-module-performance',
  '06-offline-sync',
  '07-concurrent-active-users',
  '08-large-tenant',
  '09-breaking-point-recovery',
  '10-full-production-simulation',
] as const

export type BenchmarkSuiteId = (typeof BENCHMARK_SUITE_IDS)[number]

export const WORKLOAD_PROFILES = [
  'light',
  'standard',
  'heavy',
  'financial_intensive',
  'inventory_intensive',
  'sync_intensive',
  'reporting_intensive',
  'mixed_production',
] as const

export type WorkloadProfile = (typeof WORKLOAD_PROFILES)[number]

export interface CapacityMeasurement {
  readonly metricId: string
  readonly serviceId: string
  readonly resourceId: string
  readonly environmentId: string
  readonly timestamp: string
  readonly windowMs: number
  readonly unit: string
  readonly source: string
  readonly kind: MetricValueKind
  readonly value: number | null
  readonly status: 'OK' | 'NOT_EXPOSED' | 'UNKNOWN' | 'DEGRADED'
  readonly confidence: ConfidenceLevel
  readonly benchmarkRunId?: string | undefined
  readonly freshnessMs: number
  readonly uncertaintyRange?: readonly [number, number] | undefined
}

export interface AdaptiveStageMetrics {
  readonly concurrency: number
  readonly rps: number
  readonly successfulRequests: number
  readonly failedRequests: number
  readonly errorRate: number
  readonly p50Ms: number
  readonly p90Ms: number
  readonly p95Ms: number
  readonly p99Ms: number
  readonly maxMs: number
  readonly cpuPercent: number | null
  readonly rssMb: number
  readonly heapUsedMb: number
  readonly eventLoopLagMs: number
  readonly dbActiveConnections: number | null
  readonly dbPoolWaitMs: number | null
  readonly queueDepth: number | null
}

export interface SafetyStopThresholds {
  readonly maxErrorRate: number
  readonly maxP95Ms: number
  readonly maxP99Ms: number
  readonly maxEventLoopLagMs: number
  readonly maxRssMb: number
  readonly maxCpuPercent: number
  readonly maxConcurrency: number
  readonly maxRps: number
}

export const DEFAULT_SAFETY_STOP_THRESHOLDS: SafetyStopThresholds = {
  maxErrorRate: 0.05,
  maxP95Ms: 1500,
  maxP99Ms: 3000,
  maxEventLoopLagMs: 250,
  maxRssMb: 1536,
  maxCpuPercent: 90,
  maxConcurrency: 2000,
  maxRps: 5000,
}

export interface TenantIsolationSample {
  readonly tenantId: string
  readonly label: string
  readonly invoiceVolume: number
  readonly baselineP95Ms: number
  readonly underLoadP95Ms: number
  readonly underLoadP99Ms: number
  readonly errorRate: number
  readonly degradationRatio: number
  readonly isolationBreached: boolean
}

export interface TenantIsolationReport {
  readonly noisyNeighborTenantId: string
  readonly affectedTenants: readonly TenantIsolationSample[]
  readonly maxDegradationRatio: number
  readonly sloBreached: boolean
  readonly recoveryMs: number | null
  readonly crossTenantLeakageDetected: boolean
}

export interface FinancialInvariantCheckResult {
  readonly balancedJournalEntries: boolean
  readonly zeroLostTransactions: boolean
  readonly zeroDuplicatePostings: boolean
  readonly afnZeroDecimalPreserved: boolean
  readonly discrepancyCount: number
  readonly details: readonly string[]
}

export interface CapacityEstimateSummary {
  /** Highest concurrency proven stable in an isolated benchmark run. */
  readonly measuredCapacity: number | null
  /** Recommended safe concurrency with SLO headroom applied. */
  readonly safeCapacity: number | null
  /** Hypothetical capacity under simulated resource changes (never measured reality). */
  readonly projectedCapacity: number | null
  readonly projectedIsSimulationOnly: true
  readonly limitingResource: LimitingResource
  readonly confidence: ConfidenceLevel
  readonly status: 'READY' | 'INSUFFICIENT_BENCHMARK_DATA'
  readonly workloadProfile: WorkloadProfile
  readonly lastValidBenchmarkAt: string | null
  readonly gitRevision: string | null
}

export interface BenchmarkRunRecord {
  readonly runId: string
  readonly suiteId: BenchmarkSuiteId
  readonly environment: 'isolated_local' | 'isolated_staging'
  readonly targetHost: string
  readonly workloadProfile: WorkloadProfile
  readonly datasetSeed: number
  readonly datasetSize: number
  readonly gitRevision: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly durationMs: number
  readonly status: CapacityRunStatus
  readonly safetyStopReason: string | null
  readonly stages: readonly AdaptiveStageMetrics[]
  readonly maxStableConcurrency: number
  readonly peakRps: number
  readonly p95Ms: number
  readonly p99Ms: number
  readonly errorRate: number
  readonly limitingResource: LimitingResource
  readonly isolationReport?: TenantIsolationReport | undefined
  readonly financialCheck?: FinancialInvariantCheckResult | undefined
}
