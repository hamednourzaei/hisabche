// ============================================
// backend/src/services/capacity/adaptive-runner.ts
//
// V76 Phase 6 — Adaptive Load & Concurrency Engine with Hard Safety Stops.
// Progresses through concurrency stages only while SLOs & safety ceilings
// remain satisfied; drains safely and marks SAFETY_STOPPED on breach.
// ============================================

import { performance } from 'node:perf_hooks'
import {
  DEFAULT_SAFETY_STOP_THRESHOLDS,
  type AdaptiveStageMetrics,
  type CapacityRunStatus,
  type LimitingResource,
  type SafetyStopThresholds,
} from '@hisabche/validation'
import { pressureMonitor } from '../../runtime/pressure'
import {
  assertIsolatedBenchmarkEnvironment,
  isBenchmarkKillSwitchActive,
  type BenchmarkTargetValidationInput,
} from './safety-guard'

export interface AdaptiveRunnerConfig {
  readonly target: BenchmarkTargetValidationInput
  readonly stages?: readonly number[] | undefined
  readonly requestsPerWorker?: number | undefined
  readonly warmupRequests?: number | undefined
  readonly cooldownMs?: number | undefined
  readonly thresholds?: Partial<SafetyStopThresholds> | undefined
  readonly executeOperation: (workerIndex: number, iteration: number) => Promise<{ ok: boolean }>
}

export interface AdaptiveRunOutcome {
  readonly status: CapacityRunStatus
  readonly safetyStopReason: string | null
  readonly stages: readonly AdaptiveStageMetrics[]
  readonly maxStableConcurrency: number
  readonly peakRps: number
  readonly p95Ms: number
  readonly p99Ms: number
  readonly errorRate: number
  readonly limitingResource: LimitingResource
  readonly durationMs: number
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round((sorted[idx] ?? 0) * 100) / 100
}

export async function runAdaptiveWorkload(
  config: AdaptiveRunnerConfig,
): Promise<AdaptiveRunOutcome> {
  const startAll = performance.now()
  const thresholds: SafetyStopThresholds = {
    ...DEFAULT_SAFETY_STOP_THRESHOLDS,
    ...(config.thresholds ?? {}),
  }

  const stageSteps = config.stages ?? [10, 25, 50, 100, 200]
  const maxRequested = Math.max(...stageSteps, 0)

  assertIsolatedBenchmarkEnvironment({
    ...config.target,
    requestedConcurrency: maxRequested,
    thresholds,
  })

  // Warm-up phase
  const warmupCount = config.warmupRequests ?? 5
  for (let i = 0; i < warmupCount; i++) {
    if (isBenchmarkKillSwitchActive()) {
      return {
        status: 'SAFETY_STOPPED',
        safetyStopReason: 'BENCHMARK_KILL_SWITCH_ACTIVE during warmup',
        stages: [],
        maxStableConcurrency: 0,
        peakRps: 0,
        p95Ms: 0,
        p99Ms: 0,
        errorRate: 0,
        limitingResource: 'unknown',
        durationMs: Math.round(performance.now() - startAll),
      }
    }
    await config.executeOperation(0, i)
  }

  const completedStages: AdaptiveStageMetrics[] = []
  let status: CapacityRunStatus = 'COMPLETED'
  let safetyStopReason: string | null = null
  let limitingResource: LimitingResource = 'cpu'
  let maxStableConcurrency = 0
  let peakRps = 0

  const requestsPerWorker = config.requestsPerWorker ?? 3

  for (const concurrency of stageSteps) {
    if (isBenchmarkKillSwitchActive()) {
      status = 'SAFETY_STOPPED'
      safetyStopReason = 'BENCHMARK_KILL_SWITCH_ACTIVE'
      break
    }

    const latencies: number[] = []
    let successCount = 0
    let failCount = 0
    const stageStart = performance.now()

    const workers = Array.from({ length: concurrency }, async (_, workerIdx) => {
      for (let iter = 0; iter < requestsPerWorker; iter++) {
        if (isBenchmarkKillSwitchActive()) break
        const t0 = performance.now()
        try {
          const res = await config.executeOperation(workerIdx, iter)
          const elapsed = performance.now() - t0
          latencies.push(elapsed)
          if (res.ok) successCount++
          else failCount++
        } catch {
          latencies.push(performance.now() - t0)
          failCount++
        }
      }
    })

    await Promise.all(workers)
    const stageDurationSec = Math.max(0.001, (performance.now() - stageStart) / 1000)
    const sorted = [...latencies].sort((a, b) => a - b)
    const total = successCount + failCount
    const errorRate = total > 0 ? Math.round((failCount / total) * 10000) / 10000 : 0
    const rps = Math.round((total / stageDurationSec) * 100) / 100
    const p50Ms = percentile(sorted, 50)
    const p90Ms = percentile(sorted, 90)
    const p95Ms = percentile(sorted, 95)
    const p99Ms = percentile(sorted, 99)
    const maxMs = sorted.length > 0 ? Math.round((sorted[sorted.length - 1] ?? 0) * 100) / 100 : 0

    const pressure = pressureMonitor.snapshot()
    const rssMb = Math.round((pressure.rssBytes / (1024 * 1024)) * 100) / 100
    const heapUsedMb = Math.round((pressure.heapUsedBytes / (1024 * 1024)) * 100) / 100
    const eventLoopLagMs = Math.round(pressure.eventLoopDelayMs * 100) / 100

    const stageMetric: AdaptiveStageMetrics = {
      concurrency,
      rps,
      successfulRequests: successCount,
      failedRequests: failCount,
      errorRate,
      p50Ms,
      p90Ms,
      p95Ms,
      p99Ms,
      maxMs,
      cpuPercent: null,
      rssMb,
      heapUsedMb,
      eventLoopLagMs,
      dbActiveConnections: null,
      dbPoolWaitMs: null,
      queueDepth: null,
    }
    completedStages.push(stageMetric)

    if (errorRate > thresholds.maxErrorRate) {
      status = 'SAFETY_STOPPED'
      safetyStopReason = `ERROR_RATE_EXCEEDED (${errorRate} > ${thresholds.maxErrorRate})`
      limitingResource = 'database_queries'
      break
    }
    if (p95Ms > thresholds.maxP95Ms) {
      status = 'SAFETY_STOPPED'
      safetyStopReason = `P95_SLO_EXCEEDED (${p95Ms}ms > ${thresholds.maxP95Ms}ms)`
      limitingResource = 'cpu'
      break
    }
    if (p99Ms > thresholds.maxP99Ms) {
      status = 'SAFETY_STOPPED'
      safetyStopReason = `P99_SLO_EXCEEDED (${p99Ms}ms > ${thresholds.maxP99Ms}ms)`
      limitingResource = 'cpu'
      break
    }
    if (rssMb > thresholds.maxRssMb) {
      status = 'SAFETY_STOPPED'
      safetyStopReason = `MEMORY_RSS_CEILING_EXCEEDED (${rssMb}MB > ${thresholds.maxRssMb}MB)`
      limitingResource = 'memory'
      break
    }
    if (eventLoopLagMs > thresholds.maxEventLoopLagMs) {
      status = 'SAFETY_STOPPED'
      safetyStopReason = `EVENT_LOOP_LAG_EXCEEDED (${eventLoopLagMs}ms > ${thresholds.maxEventLoopLagMs}ms)`
      limitingResource = 'event_loop'
      break
    }

    maxStableConcurrency = concurrency
    if (rps > peakRps) peakRps = rps

    if ((config.cooldownMs ?? 0) > 0) {
      await new Promise((r) => setTimeout(r, config.cooldownMs))
    }
  }

  const last = completedStages[completedStages.length - 1]
  return {
    status,
    safetyStopReason,
    stages: completedStages,
    maxStableConcurrency,
    peakRps,
    p95Ms: last?.p95Ms ?? 0,
    p99Ms: last?.p99Ms ?? 0,
    errorRate: last?.errorRate ?? 0,
    limitingResource,
    durationMs: Math.round(performance.now() - startAll),
  }
}
