// ============================================
// Data migration hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// THE FILE STAYS IN THE BROWSER
//
// The server parses the upload inside the request and keeps only the derived
// headers, counts and findings — never the file. So the browser holds the text
// for as long as the wizard is open and re-sends it at the dry-run and commit
// steps. The server compares a digest each time, which is what stops a
// different file being slipped in between "preview" and "import".
//
// The consequence for this module: the file content is never in the query
// cache, only in the container's own state. Caching it would put a customer
// list, with phone numbers, into a store that outlives the screen.
//
// ---------------------------------------------------------------------------
// WHY COMMIT IS NOT RETRIED
//
// A commit writes rows. An automatic retry of a request whose response was
// lost would run it twice, and while the server's identity ledger makes that
// safe, "safe" is not the same as "asked for". The user presses the button
// again if they mean to.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'

// ═══ Types ═══

export type MigrationEntity = 'customer' | 'product'
export type MigrationSourceType = 'csv' | 'tsv'

export type MigrationStatus =
  | 'uploaded'
  | 'scanning'
  | 'scanned'
  | 'mapping'
  | 'validating'
  | 'ready'
  | 'importing'
  | 'reconciling'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'cancelled'

export type MappingStatus = 'matched' | 'needs_review' | 'unsupported'

export interface MappingSuggestion {
  sourceHeader: string
  targetField: string | null
  confidence: number
  status: MappingStatus
}

export interface SourceGuess {
  system: 'odoo' | 'erpnext' | 'quickbooks' | 'generic_spreadsheet'
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

export interface MigrationDiscovery {
  headers: string[]
  delimiter: string
  rowCount: number
  raggedRows: number[]
  source: SourceGuess
  suggestions: MappingSuggestion[]
  sample: string[][]
}

export type FindingSeverity = 'fatal' | 'warning' | 'info'

export interface Finding {
  severity: FindingSeverity
  /** 1-based, matching the user's spreadsheet. 0 means "the file as a whole". */
  row: number
  column: string | null
  code: string
  detail?: string
}

export interface DryRunSummary {
  entity: MigrationEntity
  toCreate: number
  toUpdate: number
  toSkip: number
  needsReview: number
  /** Minor units, keyed by target field. */
  financialImpactMinor: Record<string, number>
  productionDataChanged: false
}

export interface ReconciliationLine {
  measure: string
  sourceValue: number
  hisabcheValue: number
  differenceValue: number
  matched: boolean
}

export interface MigrationJob {
  id: string
  entity: MigrationEntity
  sourceType: MigrationSourceType
  originalFilename: string
  byteSize: number
  status: MigrationStatus
  discovery: MigrationDiscovery | null
  /** Target field → source column index. */
  mapping: Record<string, number>
  findings: Finding[]
  dryRun: DryRunSummary | null
  reconciliation: { lines: ReconciliationLine[]; matched: boolean } | null
  rowsScanned: number
  rowsCreated: number
  rowsUpdated: number
  rowsSkipped: number
  createdBy: string
  createdAt: string
  completedAt: string | null
  errorCode: string | null
}

export const migrationKeys = {
  all: ['migrations'] as const,
  list: () => [...migrationKeys.all, 'list'] as const,
  detail: (id: string) => [...migrationKeys.all, 'detail', id] as const,
}

// ═══ Queries ═══

/** The migration history. Every run the workspace has ever started. */
export function useMigrations() {
  const ready = useAuthReady()

  return useQuery({
    queryKey: migrationKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/migrations')
      return asList<MigrationJob>(data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useMigration(id: string | null) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: migrationKeys.detail(id ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get(`/migrations/${id}`)
      return data as MigrationJob
    },
    enabled: ready && Boolean(id),
    staleTime: 10_000,
  })
}

// ═══ Mutations ═══

/** Upload and scan. The response is everything the discovery step shows. */
export function useScanMigration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      entity: MigrationEntity
      sourceType: MigrationSourceType
      filename: string
      content: string
    }) => {
      const { data } = await apiClient.post('/migrations', input)
      return data as MigrationJob
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: migrationKeys.all })
    },
  })
}

export function useSaveMapping() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, mapping }: { id: string; mapping: Record<string, number> }) => {
      const { data } = await apiClient.put(`/migrations/${id}/mapping`, { mapping })
      return data as MigrationJob
    },
    retry: false,
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: migrationKeys.detail(job.id) })
    },
  })
}

/**
 * Validate and simulate. Changes nothing in the business tables.
 *
 * The response carries `productionDataChanged: false` from the server rather
 * than the UI asserting it, because the claim on screen has to come from the
 * thing that would have done the changing.
 */
export function useDryRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data } = await apiClient.post(`/migrations/${id}/dry-run`, { content })
      return data as { job: MigrationJob; dryRun: DryRunSummary; findings: Finding[] }
    },
    retry: false,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: migrationKeys.detail(result.job.id) })
    },
  })
}

export function useCommitMigration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data } = await apiClient.post(`/migrations/${id}/commit`, { content })
      return data as MigrationJob
    },
    retry: false,
    onSuccess: () => {
      // The catalogue itself just changed, so the customer and product lists
      // in every other open screen are now stale.
      queryClient.invalidateQueries({ queryKey: migrationKeys.all })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useCancelMigration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/migrations/${id}/cancel`)
      return data as MigrationJob
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: migrationKeys.all })
    },
  })
}
