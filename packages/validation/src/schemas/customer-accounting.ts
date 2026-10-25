// ============================================
// packages/validation/src/schemas/customer-accounting.ts
//
// «Is every document of this customer in the ledger?» — the statement documents
// paired with the journal entries that account for them. One rule, two runtimes:
// the server (`CustomerProfileService.getAccounting`) and the device (the local
// engine's `GET /customers/:id/accounting`) hand it their ledger movements and
// their journal entries.
// ============================================

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

export type EntryInput = {
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

/** The statement documents (an invoice or a payment) behind a party ledger's movements. */
export function statementDocumentsOf(
  movements: ReadonlyArray<{
    sourceType?: 'invoice' | 'payment' | undefined
    sourceId?: string | undefined
    date: string
    kind: string
    reference: string
    amount: number
  }>,
): StatementDocument[] {
  return movements.flatMap((row) =>
    row.sourceType && row.sourceId
      ? [
          {
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            date: row.date,
            kind: row.kind,
            reference: row.reference,
            amount: row.amount,
          },
        ]
      : [],
  )
}

export interface CustomerAccounting {
  documents: DocumentAccounting[]
  postedCount: number
  unpostedCount: number
}

/** Every statement document with the journal entries that account for it. Newest first. */
export function buildCustomerAccounting(
  documents: StatementDocument[],
  entries: EntryInput[],
): CustomerAccounting {
  const matched = matchDocumentEntries(documents, entries).reverse()
  const unpostedCount = matched.filter((document) => document.unposted).length
  return { documents: matched, postedCount: matched.length - unpostedCount, unpostedCount }
}
