// ============================================
// backend/src/services/capacity/safety-guard.ts
//
// V76 Non-Negotiable Safety Contract.
// Default is DENY. Production targets, ambiguous environments, non-synthetic
// credentials, or active kill switches abort immediately before any load.
// ============================================

import { DEFAULT_SAFETY_STOP_THRESHOLDS, type SafetyStopThresholds } from '@hisabche/validation'

export class BenchmarkSafetyError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'BenchmarkSafetyError'
    this.code = code
  }
}

export interface BenchmarkTargetValidationInput {
  readonly targetHostname: string
  readonly databaseHostname: string
  readonly nodeEnv?: string | undefined
  readonly isolatedFlag?: string | undefined
  readonly syntheticCredentialId?: string | undefined
  readonly syntheticTenantIds?: readonly string[] | undefined
  readonly requestedConcurrency?: number | undefined
  readonly requestedRps?: number | undefined
  readonly thresholds?: Partial<SafetyStopThresholds> | undefined
}

const PRODUCTION_HOST_PATTERNS = [
  /hisabche\.com$/i,
  /\.hisabche\.com$/i,
  /supabase\.co$/i,
  /supabase\.in$/i,
  /onrender\.com$/i,
  /vercel\.app$/i,
  /prod/i,
] as const

const ALLOWED_ISOLATED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'isolated-staging.local',
  'benchmark-local',
])

let globalKillSwitch = false

export function activateBenchmarkKillSwitch(): void {
  globalKillSwitch = true
}

export function resetBenchmarkKillSwitch(): void {
  globalKillSwitch = false
}

export function isBenchmarkKillSwitchActive(): boolean {
  return globalKillSwitch || process.env.HISABCHE_BENCHMARK_KILL_SWITCH === '1'
}

export function isProductionLikeHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return true
  if (ALLOWED_ISOLATED_HOSTS.has(normalized)) return false
  return PRODUCTION_HOST_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Fails closed unless EVERY safety condition is explicitly satisfied.
 * A single config flag is never enough on its own.
 */
export function assertIsolatedBenchmarkEnvironment(input: BenchmarkTargetValidationInput): {
  validated: true
  environment: 'isolated_local' | 'isolated_staging'
} {
  if (isBenchmarkKillSwitchActive()) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_KILL_SWITCH_ACTIVE',
      'Global benchmark kill switch is active — execution refused',
    )
  }

  const env = (input.nodeEnv ?? process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (!env || env === 'production') {
    throw new BenchmarkSafetyError(
      'BENCHMARK_PRODUCTION_ENV_FORBIDDEN',
      `Refusing benchmark in NODE_ENV="${env || 'undefined'}"`,
    )
  }

  const isolatedFlag = input.isolatedFlag ?? process.env.HISABCHE_BENCHMARK_ISOLATED
  if (isolatedFlag !== '1') {
    throw new BenchmarkSafetyError(
      'BENCHMARK_ISOLATION_FLAG_REQUIRED',
      'HISABCHE_BENCHMARK_ISOLATED=1 is required alongside host and DB verification',
    )
  }

  const targetHost = input.targetHostname.trim().toLowerCase()
  const dbHost = input.databaseHostname.trim().toLowerCase()
  if (!targetHost || !dbHost) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_AMBIGUOUS_TARGET',
      'Target hostname and database hostname must both be explicitly provided',
    )
  }

  if (isProductionLikeHost(targetHost) || isProductionLikeHost(dbHost)) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_PRODUCTION_HOST_REJECTED',
      `Production-like destination rejected (target=${targetHost}, db=${dbHost})`,
    )
  }

  if (!ALLOWED_ISOLATED_HOSTS.has(targetHost) && !targetHost.endsWith('.staging.internal')) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_HOST_NOT_ALLOWLISTED',
      `Target host "${targetHost}" is not in the isolated benchmark allowlist`,
    )
  }

  if (!ALLOWED_ISOLATED_HOSTS.has(dbHost) && !dbHost.endsWith('.staging.internal')) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_DB_NOT_ALLOWLISTED',
      `Database host "${dbHost}" is not in the isolated benchmark allowlist`,
    )
  }

  if (!input.syntheticCredentialId || !input.syntheticCredentialId.startsWith('synthetic-')) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_SYNTHETIC_CREDENTIALS_REQUIRED',
      'Dedicated synthetic-* credential identifier is required',
    )
  }

  if (input.syntheticTenantIds) {
    for (const id of input.syntheticTenantIds) {
      if (!id.startsWith('00000000-0000-4000-8000-') && !id.startsWith('syn-')) {
        throw new BenchmarkSafetyError(
          'BENCHMARK_NON_SYNTHETIC_TENANT',
          `Tenant "${id}" does not match synthetic tenant prefix`,
        )
      }
    }
  }

  const limits = { ...DEFAULT_SAFETY_STOP_THRESHOLDS, ...(input.thresholds ?? {}) }
  if ((input.requestedConcurrency ?? 0) > limits.maxConcurrency) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_CONCURRENCY_CEILING_EXCEEDED',
      `Requested concurrency ${input.requestedConcurrency} exceeds hard ceiling ${limits.maxConcurrency}`,
    )
  }
  if ((input.requestedRps ?? 0) > limits.maxRps) {
    throw new BenchmarkSafetyError(
      'BENCHMARK_RPS_CEILING_EXCEEDED',
      `Requested RPS ${input.requestedRps} exceeds hard ceiling ${limits.maxRps}`,
    )
  }

  return {
    validated: true,
    environment: ALLOWED_ISOLATED_HOSTS.has(targetHost) ? 'isolated_local' : 'isolated_staging',
  }
}
