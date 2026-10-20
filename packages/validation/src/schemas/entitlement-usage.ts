// ============================================
// packages/validation/src/schemas/entitlement-usage.ts
//
// Usage Policy — what counts as one invoice towards plan limits.
//
// ⚠️ ONE DEFINITION, ONE PURE FUNCTION.
// Imported by the backend and the local engine.
//
// Owner's decisions (20 Oct 2026):
//   - sale invoice created: YES (1)
//   - purchase invoice created: YES (1)
//   - return / credit note: YES (1)
//   - cancelled: YES (1)
//   - draft (never finalised): NO (0)
//   - quotation / proforma: NO (0)
//   - system-generated (e.g. late fee): NO (0)
//   - file import (migration): NO (0)
//   - sync push from offline device: NO (0)
// ============================================

export interface InvoiceUsageDocument {
  type?: string | null | undefined
  status?: string | null | undefined
  isImport?: boolean | undefined
  isSystemGenerated?: boolean | undefined
  isSyncPush?: boolean | undefined
  clientRequestId?: string | null | undefined
}

/**
 * Does this document count towards the workspace's invoice quota?
 *
 * Pure function: takes the document properties, returns true if it counts as 1.
 */
export function countsTowardsInvoiceQuota(doc: InvoiceUsageDocument): boolean {
  if (doc.isImport === true || doc.isSystemGenerated === true || doc.isSyncPush === true) {
    return false
  }

  // Check clientRequestId patterns for imports or system generation
  if (doc.clientRequestId) {
    if (doc.clientRequestId.startsWith('mig-inv-')) return false
    if (doc.clientRequestId.includes('late_fee')) return false
    if (doc.clientRequestId.includes('ingested_document')) return false
  }

  const type = (doc.type || '').toLowerCase().trim()
  if (type === 'quotation' || type === 'proforma') {
    return false
  }

  const status = (doc.status || '').toLowerCase().trim()
  if (status === 'draft') {
    return false
  }

  // sale, purchase, return, credit_note, pending, paid, completed, cancelled, overdue, partial: all count as 1
  return true
}

/**
 * May this invoice write proceed, given the current usage and limits?
 *
 * If the document does not count towards the quota (e.g. migration import or
 * system-generated late fee), it is never refused by the quota ceiling.
 */
export function mayCreateInvoice(
  doc: InvoiceUsageDocument,
  currentUsage: { used: number; limit: number | null },
): boolean {
  if (!countsTowardsInvoiceQuota(doc)) {
    return true
  }
  if (currentUsage.limit === null) {
    return true
  }
  return currentUsage.used < currentUsage.limit
}
