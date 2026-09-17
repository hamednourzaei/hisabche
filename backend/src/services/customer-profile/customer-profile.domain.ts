// ============================================
// Customer Profile Core — domain (pure).
//
// Customer 360 phase 3: credit limit, payment terms, the customer who is also
// a supplier, and documents on the customer file.
//
// Money figures here are INPUTS from the Payments Core (receivable/payable);
// this core never totals invoices itself.
// ============================================

export type CustomerProfileErrorCode =
  | 'CUSTOMER_PROFILE_MIGRATION_PENDING'
  | 'CUSTOMER_DOCUMENT_TYPE_NOT_ALLOWED'
  | 'CUSTOMER_DOCUMENT_TOO_LARGE'
  | 'CUSTOMER_DOCUMENT_EMPTY'
  | 'CUSTOMER_DOCUMENT_BAD_CONTENT'
  | 'CUSTOMER_SUPPLIER_NOT_FOUND'
  | 'CUSTOMER_SUPPLIER_ALREADY_LINKED'
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_DOCUMENT_NOT_FOUND'

export class CustomerProfileError extends Error {
  constructor(readonly code: CustomerProfileErrorCode) {
    super(code)
    this.name = 'CustomerProfileError'
  }
}

/** Same cap as the bucket and the table CHECK in docs/customer-360-phase3-migration.sql. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

export const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface CreditControl {
  creditLimit: number
  /** What counts against the limit: the Payments Core's receivable. */
  used: number
  /** Negative when over the limit. */
  available: number
  usedPercent: number
  overLimit: boolean
}

/** null limit = no limit configured. A limit of 0 is a real limit (cash only). */
export function creditControl(
  receivable: number,
  creditLimit: number | null,
): CreditControl | null {
  if (creditLimit === null || !Number.isFinite(creditLimit) || creditLimit < 0) return null
  const used = Math.max(0, receivable)
  return {
    creditLimit,
    used,
    available: creditLimit - used,
    usedPercent: creditLimit === 0 ? (used > 0 ? 100 : 0) : Math.round((used / creditLimit) * 100),
    overLimit: used > creditLimit,
  }
}

/**
 * One party, both sides. Positive: they owe us after netting what we owe them
 * as a supplier. Only meaningful when both sides share a currency — the caller
 * passes `mixedCurrencies` and the UI says so rather than netting blindly.
 */
export function combinedBalance(customerNet: number, supplierPayable: number) {
  return { customerNet, supplierPayable, net: customerNet - supplierPayable }
}

/** Checks an upload before it touches storage. Returns the decoded size. */
export function validateDocument(input: {
  fileName: string
  mimeType: string
  contentBase64: string
}): number {
  if (!ALLOWED_DOCUMENT_TYPES.has(input.mimeType)) {
    throw new CustomerProfileError('CUSTOMER_DOCUMENT_TYPE_NOT_ALLOWED')
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64)) {
    throw new CustomerProfileError('CUSTOMER_DOCUMENT_BAD_CONTENT')
  }
  const padding = input.contentBase64.endsWith('==') ? 2 : input.contentBase64.endsWith('=') ? 1 : 0
  const size = Math.floor((input.contentBase64.length * 3) / 4) - padding
  if (size <= 0) throw new CustomerProfileError('CUSTOMER_DOCUMENT_EMPTY')
  if (size > MAX_DOCUMENT_BYTES) throw new CustomerProfileError('CUSTOMER_DOCUMENT_TOO_LARGE')
  return size
}

/** The stored name is display-only; the storage path never contains it. */
export function cleanFileName(name: string): string {
  const cleaned = Array.from(name)
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch !== '/' && ch.charCodeAt(0) !== 92)
    .join('')
    .trim()
    .slice(0, 200)
  return cleaned || 'document'
}

/** PostgREST/Postgres codes for "the migration has not been run yet". */
export function isMissingSchema(error: { code?: string } | null | undefined): boolean {
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')
}

export interface CustomerDocument {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  uploadedBy: string | null
}

export function toDocument(row: Record<string, unknown>): CustomerDocument {
  return {
    id: String(row['id']),
    fileName: String(row['file_name'] ?? ''),
    mimeType: String(row['mime_type'] ?? ''),
    sizeBytes: Number(row['size_bytes']) || 0,
    createdAt: String(row['created_at'] ?? ''),
    uploadedBy: row['uploaded_by'] ? String(row['uploaded_by']) : null,
  }
}

// ─── Phase 4: accounting view ─────────────────────────────────────────────

export interface StatementDocument {
  sourceType: 'invoice' | 'payment'
  sourceId: string
  date: string
  kind: string
  reference: string
  amount: number
}

export interface EntryLine {
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export interface DocumentEntry {
  id: string
  entryNumber: string | null
  date: string
  status: string
  reversalOf: string | null
  lines: EntryLine[]
}

export interface DocumentAccounting extends StatementDocument {
  entries: DocumentEntry[]
  /** No posted entry that is not itself reversed — the document is not in the ledger. */
  unposted: boolean
}

type EntryInput = {
  id: string
  entryNumber: string | null
  date: string
  status: string
  sourceType: string | null
  sourceId: string | null
  reversalOf: string | null
  lines: Array<{
    accountCode?: string | undefined
    accountName?: string | undefined
    debit: number
    credit: number
  }>
}

/**
 * Pairs every statement document with its journal entries. A document counts
 * as posted when it has a posted entry that no other entry reverses; a
 * reversed posting with no replacement is NOT in the ledger any more.
 */
export function matchDocumentEntries(
  documents: StatementDocument[],
  entries: EntryInput[],
): DocumentAccounting[] {
  const reversed = new Set(
    entries.map((entry) => entry.reversalOf).filter((id): id is string => !!id),
  )
  const bySource = new Map<string, EntryInput[]>()
  for (const entry of entries) {
    if (!entry.sourceType || !entry.sourceId) continue
    const key = `${entry.sourceType}:${entry.sourceId}`
    bySource.set(key, [...(bySource.get(key) ?? []), entry])
  }
  return documents.map((document) => {
    const own = bySource.get(`${document.sourceType}:${document.sourceId}`) ?? []
    const live = own.some(
      (entry) => entry.status === 'posted' && !entry.reversalOf && !reversed.has(entry.id),
    )
    return {
      ...document,
      unposted: !live,
      entries: own.map((entry) => ({
        id: entry.id,
        entryNumber: entry.entryNumber,
        date: entry.date,
        status: entry.status,
        reversalOf: entry.reversalOf,
        lines: entry.lines.map((line) => ({
          accountCode: line.accountCode ?? '',
          accountName: line.accountName ?? '',
          debit: line.debit,
          credit: line.credit,
        })),
      })),
    }
  })
}

// ─── Phase 4: insights (deterministic rules, not a model) ─────────────────

export type InsightCode =
  | 'SALES_UP'
  | 'SALES_DOWN'
  | 'LOW_COLLECTION'
  | 'OVERDUE_SHARE_HIGH'
  | 'OVER_CREDIT_LIMIT'
  | 'NEAR_CREDIT_LIMIT'
  | 'INACTIVE'
  | 'UNPOSTED_DOCUMENTS'
  | 'NO_ACTIVITY'

export interface Insight {
  code: InsightCode
  severity: 'info' | 'warning' | 'critical' | 'positive'
  /** Numbers the sentence is built from, so the UI never invents one. */
  values: Record<string, number>
}

export interface InsightInput {
  asOf: string
  receivable: number
  overdue: number
  overdueInvoiceCount: number
  lastSaleAt: string | null
  monthly: Array<{ month: string; sales: number; receipts: number }>
  credit: CreditControl | null
  unpostedCount: number
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export function customerInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = []
  const months = input.monthly
  const sum = (rows: typeof months, key: 'sales' | 'receipts') =>
    rows.reduce((total, row) => total + row[key], 0)

  const sales12 = sum(months, 'sales')
  const receipts12 = sum(months, 'receipts')
  if (sales12 === 0 && receipts12 === 0 && input.receivable <= 0) {
    return [{ code: 'NO_ACTIVITY', severity: 'info', values: {} }]
  }

  if (input.credit?.overLimit) {
    insights.push({
      code: 'OVER_CREDIT_LIMIT',
      severity: 'critical',
      values: {
        limit: input.credit.creditLimit,
        used: input.credit.used,
        over: -input.credit.available,
      },
    })
  } else if (input.credit && input.credit.usedPercent >= 80) {
    insights.push({
      code: 'NEAR_CREDIT_LIMIT',
      severity: 'warning',
      values: { percent: input.credit.usedPercent },
    })
  }

  const overdueShare = pct(input.overdue, input.receivable)
  if (input.overdue > 0 && overdueShare >= 50) {
    insights.push({
      code: 'OVERDUE_SHARE_HIGH',
      severity: 'warning',
      values: {
        percent: overdueShare,
        overdue: input.overdue,
        invoices: input.overdueInvoiceCount,
      },
    })
  }

  // Last 3 full-series months vs the 3 before them.
  if (months.length >= 6) {
    const recent = sum(months.slice(-3), 'sales')
    const previous = sum(months.slice(-6, -3), 'sales')
    if (previous > 0) {
      const change = Math.round(((recent - previous) / previous) * 100)
      if (change >= 20)
        insights.push({
          code: 'SALES_UP',
          severity: 'positive',
          values: { percent: change, recent, previous },
        })
      if (change <= -20)
        insights.push({
          code: 'SALES_DOWN',
          severity: 'warning',
          values: { percent: -change, recent, previous },
        })
    }
  }

  if (sales12 > 0) {
    const collection = pct(receipts12, sales12)
    if (collection < 60)
      insights.push({
        code: 'LOW_COLLECTION',
        severity: 'warning',
        values: { percent: collection, sales: sales12, receipts: receipts12 },
      })
  }

  if (input.lastSaleAt) {
    const days = Math.floor(
      (Date.parse(`${input.asOf}T00:00:00Z`) -
        Date.parse(`${input.lastSaleAt.slice(0, 10)}T00:00:00Z`)) /
        86_400_000,
    )
    if (days >= 90) insights.push({ code: 'INACTIVE', severity: 'info', values: { days } })
  }

  if (input.unpostedCount > 0) {
    insights.push({
      code: 'UNPOSTED_DOCUMENTS',
      severity: 'warning',
      values: { count: input.unpostedCount },
    })
  }

  const order = { critical: 0, warning: 1, info: 2, positive: 3 }
  return insights.sort((a, b) => order[a.severity] - order[b.severity])
}
