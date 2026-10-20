// ============================================
// backend/src/services/cloud-migration/types.ts
//
// Types for Server-side Cloud Migration (Step M2 / M3 / M4).
// ============================================

import type { MigrationPreview } from '@hisabche/local-engine'

export type CloudMigrationStatus =
  | 'REQUESTED'
  | 'BACKUP_CREATED'
  | 'PREVIEWED'
  | 'UPLOADING'
  | 'RECONCILING'
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'

export interface CloudMigrationJob {
  id: string
  workspaceId: string
  createdBy: string
  deviceId: string
  licenceId: string
  status: CloudMigrationStatus
  errorCode: string | null
  leaseExpiresAt: string | null
  chunksTotal: number
  chunksCompleted: number
  packageChecksum: string | null
  previewMetrics: MigrationPreview | null
  reconciliationResult: ReconciliationOutcome | null
  reconciliationDiffs: ReconciliationDiff[] | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface ChunkRowPayload {
  localId: string
  data: Record<string, unknown>
}

export interface MigrationChunkPayload {
  jobId: string
  chunkIndex: number
  chunksTotal: number
  sectionName: string
  rows: ChunkRowPayload[]
  checksum: string
}

export interface ReconciliationDiff {
  metric: string
  expected: unknown
  actual: unknown
  diff: number | string | null
  details?: unknown
}

export interface ReconciliationOutcome {
  matched: boolean
  reconciledAt: string
  checkedMetrics: {
    invoiceCount: { expected: number; actual: number; matched: boolean }
    totalsByCurrency: Record<string, { expected: number; actual: number; matched: boolean }>
    receivablesPerCurrency: Record<string, { expected: number; actual: number; matched: boolean }>
    stockPositions: { matched: boolean; totalPositions: number; mismatchCount: number }
    trialBalance: {
      expectedDebit: number
      actualDebit: number
      expectedCredit: number
      actualCredit: number
      matched: boolean
    }
    profitReports: { matched: boolean; checkedInvoices: number; mismatchCount: number }
  }
  diffs: ReconciliationDiff[]
}
