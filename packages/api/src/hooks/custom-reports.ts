// ============================================
// The report builder (#145).
//
//   GET   /custom-reports/catalog
//   GET   /custom-reports
//   POST  /custom-reports            { name, groupBy, measures }
//   GET   /custom-reports/:id/run
//   PATCH /custom-reports/:id/retire
//
// A saved report holds no results: every run reads live data. When a result
// has more groups than `maxRows`, `totalRows` says how many there were.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type ReportDimension = 'month' | 'quarter' | 'customer' | 'currency'
export type ReportMeasure = 'count' | 'outstanding' | 'collected'

export interface ReportCatalog {
  dataset: string
  dimensions: ReportDimension[]
  measures: Array<{ key: ReportMeasure; unit: 'money' | 'count' | 'percent' | 'duration' }>
}

export interface SavedReport {
  id: string
  name: string
  groupBy: ReportDimension[]
  measures: ReportMeasure[]
  isActive: boolean
}

export interface ReportRun {
  report: SavedReport
  asOf: string
  totalRows: number
  maxRows: number
  rows: Array<{
    dimensions: Partial<Record<ReportDimension, string | null>>
    customerName?: string | null
    values: Partial<Record<ReportMeasure, number>>
  }>
}

export const customReportKeys = {
  all: ['custom-reports'] as const,
  catalog: () => [...customReportKeys.all, 'catalog'] as const,
  list: () => [...customReportKeys.all, 'list'] as const,
  run: (id: string) => [...customReportKeys.all, 'run', id] as const,
}

export function useReportCatalog() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: customReportKeys.catalog(),
    queryFn: async (): Promise<ReportCatalog> => {
      const { data } = await apiClient.get<ReportCatalog>('/custom-reports/catalog')
      return {
        ...data,
        dimensions: asList<ReportDimension>(data?.dimensions),
        measures: asList<ReportCatalog['measures'][number]>(data?.measures),
      }
    },
    enabled: ready,
    staleTime: 10 * 60_000,
  })
}

export function useSavedReports() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: customReportKeys.list(),
    queryFn: async (): Promise<SavedReport[]> => {
      const { data } = await apiClient.get<{ reports: SavedReport[] }>('/custom-reports')
      return asList<SavedReport>(data?.reports)
    },
    enabled: ready,
    staleTime: 60_000,
  })
}

export function useSaveReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      groupBy: ReportDimension[]
      measures: ReportMeasure[]
    }) => (await apiClient.post<SavedReport>('/custom-reports', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customReportKeys.list() }),
  })
}

export function useRetireReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.patch(`/custom-reports/${id}/retire`, {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customReportKeys.list() }),
  })
}

/** Runs only when a report is picked; never served from an old run. */
export function useReportRun(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: customReportKeys.run(id ?? ''),
    queryFn: async (): Promise<ReportRun> => {
      const { data } = await apiClient.get<ReportRun>(`/custom-reports/${id}/run`)
      return { ...data, rows: asList<ReportRun['rows'][number]>(data?.rows) }
    },
    enabled: ready && !!id,
    staleTime: 0,
  })
}
