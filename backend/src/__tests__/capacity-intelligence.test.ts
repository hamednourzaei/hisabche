// ============================================
// backend/src/__tests__/capacity-intelligence.test.ts
//
// V76 Phase 13 — Automated verification for Capacity, Adaptive Scale &
// Tenant Isolation Engineering.
// ============================================

import fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BENCHMARK_SUITE_IDS } from '@hisabche/validation'
import {
  BenchmarkSafetyError,
  activateBenchmarkKillSwitch,
  assertIsolatedBenchmarkEnvironment,
  resetBenchmarkKillSwitch,
} from '../services/capacity/safety-guard'
import { runAdaptiveWorkload } from '../services/capacity/adaptive-runner'
import { analyzeTenantIsolation } from '../services/capacity/isolation-analyzer'
import { reconcileSyntheticFinancialWorkload } from '../services/capacity/financial-reconciler'
import { estimateCapacityFromBenchmarks } from '../services/capacity/capacity-estimator'
import { CapacityIntelligenceService } from '../services/capacity/benchmark-suites.service'

vi.mock('../middleware/admin-rbac.middleware', () => ({
  adminRoute: () => async () => {},
}))

const { default: capacityRoutes } = await import('../routes/capacity.routes')

const VALID_ISOLATED_TARGET = {
  targetHostname: '127.0.0.1',
  databaseHostname: 'localhost',
  nodeEnv: 'test',
  isolatedFlag: '1',
  syntheticCredentialId: 'synthetic-runner-01',
  syntheticTenantIds: ['00000000-0000-4000-8000-000000000001'],
} as const

describe('V76 Safety Guard (Fail-Closed DENY Default)', () => {
  beforeEach(() => {
    resetBenchmarkKillSwitch()
    process.env.HISABCHE_BENCHMARK_ISOLATED = '1'
  })

  afterEach(() => {
    resetBenchmarkKillSwitch()
    delete process.env.HISABCHE_BENCHMARK_ISOLATED
  })

  it('rejects production NODE_ENV, production hosts, missing flag, and non-synthetic credentials', () => {
    expect(() =>
      assertIsolatedBenchmarkEnvironment({ ...VALID_ISOLATED_TARGET, nodeEnv: 'production' }),
    ).toThrow(BenchmarkSafetyError)

    expect(() =>
      assertIsolatedBenchmarkEnvironment({
        ...VALID_ISOLATED_TARGET,
        targetHostname: 'api.hisabche.com',
      }),
    ).toThrow(BenchmarkSafetyError)

    expect(() =>
      assertIsolatedBenchmarkEnvironment({
        ...VALID_ISOLATED_TARGET,
        databaseHostname: 'db.abcdefgh.supabase.co',
      }),
    ).toThrow(BenchmarkSafetyError)

    expect(() =>
      assertIsolatedBenchmarkEnvironment({
        ...VALID_ISOLATED_TARGET,
        isolatedFlag: '0',
      }),
    ).toThrow(BenchmarkSafetyError)

    expect(() =>
      assertIsolatedBenchmarkEnvironment({
        ...VALID_ISOLATED_TARGET,
        syntheticCredentialId: 'real-admin-token',
      }),
    ).toThrow(BenchmarkSafetyError)
  })

  it('aborts immediately when global kill switch is active', () => {
    activateBenchmarkKillSwitch()
    expect(() => assertIsolatedBenchmarkEnvironment(VALID_ISOLATED_TARGET)).toThrow(/kill switch/i)
  })
})

describe('V76 Adaptive Runner & Safety Stops', () => {
  beforeEach(() => {
    resetBenchmarkKillSwitch()
    process.env.HISABCHE_BENCHMARK_ISOLATED = '1'
  })

  afterEach(() => {
    resetBenchmarkKillSwitch()
    delete process.env.HISABCHE_BENCHMARK_ISOLATED
  })

  it('stops progression and marks SAFETY_STOPPED when error rate exceeds threshold', async () => {
    const outcome = await runAdaptiveWorkload({
      target: VALID_ISOLATED_TARGET,
      stages: [2, 4, 8],
      requestsPerWorker: 2,
      warmupRequests: 1,
      thresholds: { maxErrorRate: 0.1 },
      executeOperation: async () => ({ ok: false }),
    })
    expect(outcome.status).toBe('SAFETY_STOPPED')
    expect(outcome.safetyStopReason).toContain('ERROR_RATE_EXCEEDED')
    expect(outcome.stages).toHaveLength(1)
  })
})

describe('V76 All 10 Benchmark Suites, Isolation & Financial Reconciliation', () => {
  beforeEach(() => {
    resetBenchmarkKillSwitch()
    process.env.HISABCHE_BENCHMARK_ISOLATED = '1'
  })

  afterEach(() => {
    resetBenchmarkKillSwitch()
    delete process.env.HISABCHE_BENCHMARK_ISOLATED
  })

  it('executes all 10 benchmark suites in isolated_local and produces valid capacity estimates', async () => {
    const svc = new CapacityIntelligenceService()
    expect(svc.getCapacitySummary().status).toBe('INSUFFICIENT_BENCHMARK_DATA')

    for (const suiteId of BENCHMARK_SUITE_IDS) {
      const run = await svc.runSuite({
        suiteId,
        target: VALID_ISOLATED_TARGET,
        stages: [2, 4],
        datasetSeed: 7,
        datasetSize: 20,
      })
      expect(run.status).toBe('COMPLETED')
      expect(run.environment).toBe('isolated_local')
      expect(run.maxStableConcurrency).toBe(4)
    }

    const summary = svc.getCapacitySummary('mixed_production', 2)
    expect(summary.status).toBe('READY')
    expect(summary.measuredCapacity).toBe(4)
    expect(summary.safeCapacity).toBe(3)
    expect(summary.projectedCapacity).toBe(6)
    expect(summary.projectedIsSimulationOnly).toBe(true)
  })

  it('detects noisy-neighbor SLO breach in isolation analyzer', () => {
    const report = analyzeTenantIsolation({
      noisyNeighborTenantId: '00000000-0000-4000-8000-000000000001',
      tenants: [
        {
          tenantId: '00000000-0000-4000-8000-000000000003',
          label: 'Small-Tenant-C',
          invoiceVolume: 1000,
          baselineP95Ms: 10,
          underLoadP95Ms: 35,
          underLoadP99Ms: 50,
          errorRate: 0,
        },
      ],
      maxAllowedDegradationRatio: 2.0,
    })
    expect(report.sloBreached).toBe(true)
    expect(report.maxDegradationRatio).toBe(3.5)
  })

  it('fails financial reconciliation on unbalanced or duplicate postings while preserving AFN', () => {
    const ok = reconcileSyntheticFinancialWorkload(
      ['m1', 'm2'],
      [
        {
          mutationId: 'm1',
          workspaceId: 'w1',
          currency: 'AFN',
          debitMinor: 1500,
          creditMinor: 1500,
        },
        { mutationId: 'm2', workspaceId: 'w1', currency: 'USD', debitMinor: 250, creditMinor: 250 },
      ],
    )
    expect(ok.discrepancyCount).toBe(0)
    expect(ok.afnZeroDecimalPreserved).toBe(true)

    const bad = reconcileSyntheticFinancialWorkload(
      ['m1', 'm2'],
      [
        {
          mutationId: 'm1',
          workspaceId: 'w1',
          currency: 'AFN',
          debitMinor: 1500,
          creditMinor: 1400,
        },
        {
          mutationId: 'm1',
          workspaceId: 'w1',
          currency: 'AFN',
          debitMinor: 1500,
          creditMinor: 1500,
        },
      ],
    )
    expect(bad.balancedJournalEntries).toBe(false)
    expect(bad.zeroDuplicatePostings).toBe(false)
    expect(bad.zeroLostTransactions).toBe(false)
    expect(bad.discrepancyCount).toBe(3)
  })

  it('exposes read-only discovery with explicit NOT_EXPOSED for Supabase physical CPU/RAM and blocks prod via HTTP', async () => {
    const app = fastify()
    await app.register(capacityRoutes)
    await app.ready()

    const disc = await app.inject({ method: 'GET', url: '/api/admin/capacity/discovery' })
    expect(disc.statusCode).toBe(200)
    const body = disc.json() as { unavailableTelemetry: string[] }
    expect(body.unavailableTelemetry.some((s) => s.includes('NOT_EXPOSED'))).toBe(true)

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/admin/capacity/benchmarks/run',
      payload: {
        suiteId: '01-cpu-saturation',
        targetHostname: 'api.hisabche.com',
        databaseHostname: 'localhost',
        syntheticCredentialId: 'synthetic-1',
      },
    })
    expect(blocked.statusCode).toBe(403)
    expect((blocked.json() as { code: string }).code).toBe('BENCHMARK_PRODUCTION_HOST_REJECTED')

    await app.close()
  })

  it('estimateCapacityFromBenchmarks returns INSUFFICIENT_BENCHMARK_DATA when no completed runs exist', () => {
    const empty = estimateCapacityFromBenchmarks([], 'standard')
    expect(empty.status).toBe('INSUFFICIENT_BENCHMARK_DATA')
    expect(empty.measuredCapacity).toBeNull()
    expect(empty.safeCapacity).toBeNull()
  })
})
