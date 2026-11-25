// ============================================
// backend/src/services/capacity/isolation-analyzer.ts
//
// V76 Phase 8 — Noisy-Neighbor Tenant Isolation Analyzer.
// Measures baseline latency of smaller tenants vs latency under heavy load
// from a large tenant, flagging SLO breaches and cross-tenant degradation.
// ============================================

import type { TenantIsolationReport, TenantIsolationSample } from '@hisabche/validation'

export interface IsolationMeasurementInput {
  readonly noisyNeighborTenantId: string
  readonly tenants: ReadonlyArray<{
    readonly tenantId: string
    readonly label: string
    readonly invoiceVolume: number
    readonly baselineP95Ms: number
    readonly underLoadP95Ms: number
    readonly underLoadP99Ms: number
    readonly errorRate: number
  }>
  readonly maxAllowedDegradationRatio?: number | undefined
  readonly recoveryMs?: number | null | undefined
  readonly crossTenantLeakageDetected?: boolean | undefined
}

export function analyzeTenantIsolation(input: IsolationMeasurementInput): TenantIsolationReport {
  const maxRatioThreshold = input.maxAllowedDegradationRatio ?? 2.0

  const affectedTenants: TenantIsolationSample[] = input.tenants.map((t) => {
    const safeBaseline = Math.max(0.1, t.baselineP95Ms)
    const ratio = Math.round((t.underLoadP95Ms / safeBaseline) * 100) / 100
    const breached = ratio > maxRatioThreshold || t.errorRate > 0.01
    return {
      tenantId: t.tenantId,
      label: t.label,
      invoiceVolume: t.invoiceVolume,
      baselineP95Ms: t.baselineP95Ms,
      underLoadP95Ms: t.underLoadP95Ms,
      underLoadP99Ms: t.underLoadP99Ms,
      errorRate: t.errorRate,
      degradationRatio: ratio,
      isolationBreached: breached,
    }
  })

  const maxDegradationRatio = affectedTenants.reduce(
    (max, item) => Math.max(max, item.degradationRatio),
    1,
  )

  const sloBreached =
    Boolean(input.crossTenantLeakageDetected) || affectedTenants.some((t) => t.isolationBreached)

  return {
    noisyNeighborTenantId: input.noisyNeighborTenantId,
    affectedTenants,
    maxDegradationRatio,
    sloBreached,
    recoveryMs: input.recoveryMs ?? null,
    crossTenantLeakageDetected: Boolean(input.crossTenantLeakageDetected),
  }
}
