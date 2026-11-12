import { z } from 'zod'

export const DOCUMENT_REVISION_TYPES = [
  'invoice',
  'customer',
  'product',
  'purchase_order',
  'stock_transfer',
] as const

export type DocumentRevisionType = (typeof DOCUMENT_REVISION_TYPES)[number]

export const documentRevisionTypeSchema = z.enum(DOCUMENT_REVISION_TYPES)

export interface DocumentFieldChange {
  field: string
  before: unknown
  after: unknown
}

export interface DocumentRevisionRecord {
  id: string
  workspace_id: string
  document_type: DocumentRevisionType
  document_id: string
  version: number
  actor_id: string | null
  created_at: string
  before_data: Record<string, unknown>
  after_data: Record<string, unknown>
  changed_fields: string[]
}

const IGNORED_DIFF_KEYS = new Set(['updated_at'])

export function computeDocumentFieldDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): DocumentFieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changes: DocumentFieldChange[] = []
  for (const key of Array.from(keys).sort()) {
    if (IGNORED_DIFF_KEYS.has(key)) continue
    const bVal = before[key] ?? null
    const aVal = after[key] ?? null
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes.push({ field: key, before: bVal, after: aVal })
    }
  }
  return changes
}
