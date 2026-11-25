// ============================================
// backend/src/services/capacity/production-discovery.service.ts
//
// V76 Phase 2 — Read-only Infrastructure & Telemetry Discovery.
// Reuses existing pressureMonitor & database routing overview.
// Explicitly reports UNAVAILABLE / NOT_EXPOSED for external cloud metrics
// (e.g., Supabase physical CPU/RAM) instead of guessing.
// ============================================

import os from 'node:os'
import type { CapacityMeasurement } from '@hisabche/validation'
import { pressureMonitor } from '../../runtime/pressure'
import { getServiceModeState } from '../../runtime/service-mode'
import { getDatabaseRoutingOverview } from '../../db/routing'

export interface InfrastructureDiscoverySnapshot {
  readonly discoveredAt: string
  readonly environment: string
  readonly serviceMode: string
  readonly primaryWritable: boolean
  readonly logicalCpuCount: number
  readonly processRssMb: number
  readonly processHeapUsedMb: number
  readonly processHeapTotalMb: number
  readonly eventLoopDelayMs: number
  readonly databaseRouting: {
    readonly activeEpoch: number
    readonly activeWriterId: string
    readonly circuitBreakerState: string
    readonly hasFenceSignature: boolean
  }
  readonly measurements: readonly CapacityMeasurement[]
  readonly unavailableTelemetry: readonly string[]
}

export class ProductionDiscoveryService {
  collectReadOnlySnapshot(): InfrastructureDiscoverySnapshot {
    const now = new Date().toISOString()
    const pressure = pressureMonitor.snapshot()
    const serviceMode = getServiceModeState()
    const routing = getDatabaseRoutingOverview()
    const envId = process.env.NODE_ENV ?? 'development'
    const logicalCpus = os.cpus().length
    const rssMb = Math.round((pressure.rssBytes / (1024 * 1024)) * 100) / 100
    const heapUsedMb = Math.round((pressure.heapUsedBytes / (1024 * 1024)) * 100) / 100
    const heapTotalMb = Math.round((process.memoryUsage().heapTotal / (1024 * 1024)) * 100) / 100

    const measurements: CapacityMeasurement[] = [
      {
        metricId: 'process.rss_mb',
        serviceId: 'api',
        resourceId: 'node-process',
        environmentId: envId,
        timestamp: now,
        windowMs: 1000,
        unit: 'MB',
        source: 'pressureMonitor',
        kind: 'MEASURED',
        value: rssMb,
        status: 'OK',
        confidence: 'HIGH',
        freshnessMs: 0,
      },
      {
        metricId: 'process.heap_used_mb',
        serviceId: 'api',
        resourceId: 'node-process',
        environmentId: envId,
        timestamp: now,
        windowMs: 1000,
        unit: 'MB',
        source: 'pressureMonitor',
        kind: 'MEASURED',
        value: heapUsedMb,
        status: 'OK',
        confidence: 'HIGH',
        freshnessMs: 0,
      },
      {
        metricId: 'process.event_loop_lag_ms',
        serviceId: 'api',
        resourceId: 'node-process',
        environmentId: envId,
        timestamp: now,
        windowMs: 1000,
        unit: 'ms',
        source: 'pressureMonitor',
        kind: 'MEASURED',
        value: Math.round(pressure.eventLoopDelayMs * 100) / 100,
        status: 'OK',
        confidence: 'HIGH',
        freshnessMs: 0,
      },
      {
        metricId: 'host.logical_cpu_count',
        serviceId: 'api',
        resourceId: 'os-runtime',
        environmentId: envId,
        timestamp: now,
        windowMs: 0,
        unit: 'cores',
        source: 'node:os',
        kind: 'MEASURED',
        value: logicalCpus,
        status: 'OK',
        confidence: 'HIGH',
        freshnessMs: 0,
      },
      {
        metricId: 'db.physical_cpu_percent',
        serviceId: 'database',
        resourceId: 'supabase-postgres',
        environmentId: envId,
        timestamp: now,
        windowMs: 0,
        unit: '%',
        source: 'supabase-telemetry',
        kind: 'UNAVAILABLE',
        value: null,
        status: 'NOT_EXPOSED',
        confidence: 'INSUFFICIENT_DATA',
        freshnessMs: 0,
      },
      {
        metricId: 'db.physical_ram_mb',
        serviceId: 'database',
        resourceId: 'supabase-postgres',
        environmentId: envId,
        timestamp: now,
        windowMs: 0,
        unit: 'MB',
        source: 'supabase-telemetry',
        kind: 'UNAVAILABLE',
        value: null,
        status: 'NOT_EXPOSED',
        confidence: 'INSUFFICIENT_DATA',
        freshnessMs: 0,
      },
    ]

    return {
      discoveredAt: now,
      environment: envId,
      serviceMode: serviceMode.mode,
      primaryWritable: serviceMode.primaryWritable,
      logicalCpuCount: logicalCpus,
      processRssMb: rssMb,
      processHeapUsedMb: heapUsedMb,
      processHeapTotalMb: heapTotalMb,
      eventLoopDelayMs: Math.round(pressure.eventLoopDelayMs * 100) / 100,
      databaseRouting: {
        activeEpoch: routing.activeEpoch,
        activeWriterId: routing.activeWriterId,
        circuitBreakerState: routing.circuitBreakerState,
        hasFenceSignature: routing.lease.hasFenceSignature,
      },
      measurements,
      unavailableTelemetry: [
        'db.physical_cpu_percent (NOT_EXPOSED by Supabase Postgres connection)',
        'db.physical_ram_mb (NOT_EXPOSED by Supabase Postgres connection)',
        'render.host_physical_core_isolation (NOT_EXPOSED unless Render metrics API configured)',
      ],
    }
  }
}
