'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'
import type {
  BenchmarkRunRecord,
  CapacityEstimateSummary,
  WorkloadProfile,
} from '@hisabche/validation'

export interface CapacityDiscoveryResponse {
  discoveredAt: string
  environment: string
  serviceMode: string
  primaryWritable: boolean
  logicalCpuCount: number
  processRssMb: number
  processHeapUsedMb: number
  processHeapTotalMb: number
  eventLoopDelayMs: number
  databaseRouting: {
    activeEpoch: number
    activeWriterId: string
    circuitBreakerState: string
    hasFenceSignature: boolean
  }
  unavailableTelemetry: string[]
}

export function useCapacityDiscovery() {
  return useQuery<CapacityDiscoveryResponse>({
    queryKey: ['admin', 'capacity', 'discovery'],
    queryFn: async () => {
      const { data } = await apiClient.get<CapacityDiscoveryResponse>('/admin/capacity/discovery')
      return data
    },
    staleTime: 15_000,
  })
}

export function useCapacitySummary(profile: WorkloadProfile = 'mixed_production', multiplier = 1) {
  return useQuery<CapacityEstimateSummary>({
    queryKey: ['admin', 'capacity', 'summary', profile, multiplier],
    queryFn: async () => {
      const { data } = await apiClient.get<CapacityEstimateSummary>('/admin/capacity/summary', {
        params: { profile, multiplier },
      })
      return data
    },
    staleTime: 15_000,
  })
}

export function useCapacityHistory() {
  return useQuery<{ runs: BenchmarkRunRecord[] }>({
    queryKey: ['admin', 'capacity', 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ runs: BenchmarkRunRecord[] }>(
        '/admin/capacity/history',
      )
      return data
    },
    staleTime: 15_000,
  })
}
