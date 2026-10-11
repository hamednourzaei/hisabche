// ============================================
// backend/src/services/migration/invoice-import.domain.ts
//
// Turning the rows of a spreadsheet into invoices.
//
// A file of customers is one row per customer. A file of invoices is not one
// row per invoice: most exports write one row per LINE and repeat the invoice
// number down the page. So between «rows that passed validation» and «invoices
// to create» there is a step the other two kinds do not have — grouping — and
// that step is this file.
//
// ---------------------------------------------------------------------------
// THE RULES IT KEEPS
//
//   • A price is never invented. A line with no price is refused; it is not
//     imported at zero (a free sale that still adds up is the most believable
//     wrong number there is).
//   • A customer is never guessed. A name that matches nobody, or two people,
//     stops that invoice and says so. No customer is created on the side.
//   • A product that is not in the catalogue is imported as a line of text. It
//     moves no stock — and the finding says exactly that.
//   • The total comes from the lines. A stated total that disagrees is
//     reported; it does not override the arithmetic.
//
// Pure: candidates and lookups in, drafts and findings out.
// ============================================

import { comparisonKey, normalizePhone } from './migration.domain'
import type { CandidateRow, Finding } from './migration.validate'

/* ─── Drafts ──────────────────────────────────────────────────────────────── */

export interface InvoiceDraftLine {
  row: number
  name: string
  /** false when the file named no item: the line is a plain amount. */
  named: boolean
  sku: string | null
  barcode: string | null
  quantity: number
  /** Per unit, in minor units (may carry a fraction when derived from a total). */
  unitPriceMinor: number
  productId: string | null
}

export interface InvoiceDraft {
  /** What makes this document the same document on a second run of the file. */
  identity: string
  /** The number it had in the source system; kept as the invoice's reference. */
  number: string | null
  firstRow: number
  type: 'sale' | 'purchase'
  date: string
  partyName: string | null
  partyPhone: string | null
  customerId: string | null
  currency: string | null
  notes: string
  lines: InvoiceDraftLine[]
  paidMinor: number
  totalMinor: number
  importable: boolean
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const amount = (value: unknown): number | null => (typeof value === 'number' ? value : null)

const PURCHASE_WORDS = new Set(['purchase', 'buy', 'bill', 'خرید', 'خريد'])

/**
 * Group validated rows into documents.
 *
 * Rows that share an invoice number are one invoice. A row with no number is
 * an invoice on its own — the «one row per invoice» export. The two can be
 * mixed in one file and are not confused: an empty number never groups.
 */
export function groupInvoiceRows(candidates: readonly CandidateRow[]): {
  drafts: InvoiceDraft[]
  findings: Finding[]
} {
  const findings: Finding[] = []
  const byKey = new Map<string, InvoiceDraft>()
  const broken = new Set<string>()

  const refuse = (draft: InvoiceDraft, row: number, code: string, detail?: string) => {
    if (!broken.has(`${draft.identity}|${code}`)) {
      findings.push({ severity: 'fatal', row, column: null, code, ...(detail ? { detail } : {}) })
      broken.add(`${draft.identity}|${code}`)
    }
    draft.importable = false
  }

  for (const candidate of candidates) {
    if (!candidate.importable) continue
    const values = candidate.values

    const number = text(values['invoiceNumber'])
    const date = text(values['date'])
    const partyName = text(values['customerName']) || null
    // With no number, the row IS the document. Its identity carries what the
    // row says, so «row 5» of this file is not «row 5» of the next one.
    const identity =
      number !== ''
        ? `number:${comparisonKey(number)}`
        : `row:${candidate.row}:${date}:${comparisonKey(partyName ?? '')}:${String(
            values['total'] ?? values['lineTotal'] ?? values['unitPrice'] ?? '',
          )}`
    const type = PURCHASE_WORDS.has(comparisonKey(text(values['type']))) ? 'purchase' : 'sale'

    let draft = byKey.get(identity)
    if (!draft) {
      draft = {
        identity,
        number: number || null,
        firstRow: candidate.row,
        type,
        date,
        partyName,
        partyPhone: normalizePhone(text(values['customerPhone'])) || null,
        customerId: null,
        currency: text(values['currency']).toUpperCase() || null,
        notes: text(values['notes']),
        lines: [],
        paidMinor: amount(values['paidAmount']) ?? 0,
        totalMinor: 0,
        importable: true,
      }
      byKey.set(identity, draft)
    } else {
      // The header is said once per document. A later row that says something
      // ELSE is two invoices under one number, and choosing between them
      // would be a guess.
      if (date !== '' && date !== draft.date) {
        refuse(draft, candidate.row, 'INVOICE_HEADER_CONFLICT', 'date')
      }
      if (
        partyName &&
        draft.partyName &&
        comparisonKey(partyName) !== comparisonKey(draft.partyName)
      ) {
        refuse(draft, candidate.row, 'INVOICE_HEADER_CONFLICT', 'customerName')
      }
    }

    const quantity = amount(values['quantity']) ?? 1
    const unitPrice = amount(values['unitPrice'])
    const lineTotal = amount(values['lineTotal']) ?? amount(values['total'])

    if (!(quantity > 0)) {
      refuse(draft, candidate.row, 'INVOICE_LINE_QUANTITY_INVALID')
      continue
    }

    // ⚠️ NEVER ZERO. No price on the row means the line is refused.
    const unitPriceMinor =
      unitPrice !== null ? unitPrice : lineTotal !== null ? lineTotal / quantity : null
    if (unitPriceMinor === null || !(unitPriceMinor > 0)) {
      refuse(draft, candidate.row, 'INVOICE_LINE_NO_PRICE')
      continue
    }

    const stated = amount(values['lineTotal'])
    if (unitPrice !== null && stated !== null && Math.abs(stated - unitPrice * quantity) > 1) {
      findings.push({
        severity: 'warning',
        row: candidate.row,
        column: null,
        code: 'INVOICE_LINE_TOTAL_MISMATCH',
        detail: `${stated} ≠ ${quantity} × ${unitPrice}`,
      })
    }

    draft.lines.push({
      row: candidate.row,
      name: text(values['itemName']) || (number !== '' ? `#${number}` : `#${candidate.row}`),
      named:
        text(values['itemName']) !== '' ||
        text(values['sku']) !== '' ||
        text(values['barcode']) !== '',
      sku: text(values['sku']) || null,
      barcode: text(values['barcode']) || null,
      quantity,
      unitPriceMinor,
      productId: null,
    })
  }

  const drafts = [...byKey.values()]
  for (const draft of drafts) {
    draft.totalMinor = Math.round(
      draft.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0),
    )
    if (draft.lines.length === 0) draft.importable = false
    if (draft.importable && draft.paidMinor > draft.totalMinor) {
      refuse(draft, draft.firstRow, 'INVOICE_PAID_EXCEEDS_TOTAL')
    }
  }

  return { drafts, findings }
}

/* ─── Who and what ────────────────────────────────────────────────────────── */

export interface KnownParty {
  id: string
  name: string
  phone: string | null
}

export interface KnownProduct {
  id: string
  name: string
  sku: string | null
  barcode: string | null
}

/** Value → the ids that carry it. One id is a match; several is a question. */
function index<T extends { id: string }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key === '') continue
    map.set(key, [...(map.get(key) ?? []), row.id])
  }
  return map
}

/**
 * Attach the customer and the products each draft names — or say why not.
 *
 * Only SALES are tied to a customer. A purchase names a supplier, which the
 * invoice carries as text (`supplierName`), so there is nobody to look up.
 */
export function resolveInvoiceParties(
  drafts: InvoiceDraft[],
  known: { customers: readonly KnownParty[]; products: readonly KnownProduct[] },
): Finding[] {
  const findings: Finding[] = []

  const byPhone = index(known.customers, (row) => normalizePhone(row.phone ?? ''))
  const byName = index(known.customers, (row) => comparisonKey(row.name))
  const bySku = index(known.products, (row) => comparisonKey(row.sku ?? ''))
  const byBarcode = index(known.products, (row) => comparisonKey(row.barcode ?? ''))
  const byProductName = index(known.products, (row) => comparisonKey(row.name))

  const one = (ids: string[] | undefined): string | null =>
    ids?.length === 1 ? (ids[0] ?? null) : null

  for (const draft of drafts) {
    if (!draft.importable) continue

    if (draft.type === 'sale' && (draft.partyName || draft.partyPhone)) {
      const phoneHit = draft.partyPhone ? byPhone.get(draft.partyPhone) : undefined
      const nameHit = draft.partyName ? byName.get(comparisonKey(draft.partyName)) : undefined
      // A phone number identifies a person better than a name does.
      const id = one(phoneHit) ?? one(nameHit)

      if (id) draft.customerId = id
      else {
        const several = (phoneHit?.length ?? 0) > 1 || (nameHit?.length ?? 0) > 1
        findings.push({
          severity: 'fatal',
          row: draft.firstRow,
          column: null,
          code: several ? 'INVOICE_CUSTOMER_AMBIGUOUS' : 'INVOICE_CUSTOMER_UNKNOWN',
          detail: draft.partyName ?? draft.partyPhone ?? '',
        })
        draft.importable = false
        continue
      }
    }

    for (const line of draft.lines) {
      if (!line.named) continue
      line.productId =
        one(line.sku ? bySku.get(comparisonKey(line.sku)) : undefined) ??
        one(line.barcode ? byBarcode.get(comparisonKey(line.barcode)) : undefined) ??
        one(byProductName.get(comparisonKey(line.name)))

      if (!line.productId) {
        findings.push({
          severity: 'info',
          row: line.row,
          column: null,
          code: 'INVOICE_PRODUCT_UNMATCHED',
          detail: line.name,
        })
      }
    }
  }

  return findings
}

/* ─── What goes to the invoice service ────────────────────────────────────── */

const major = (minor: number): number => Math.round(minor) / 100

/**
 * The draft as the body `InvoiceService.create` takes.
 *
 * The source number travels as `reference`: the invoice gets its own number
 * from this business's sequence, like any other, and the old one stays
 * findable.
 */
export function toInvoiceBody(draft: InvoiceDraft) {
  const items = draft.lines.map((line) => {
    const unitPrice = Math.round(line.unitPriceMinor) / 100
    return {
      ...(line.productId ? { productId: line.productId } : {}),
      productName: line.name,
      quantity: line.quantity,
      unit: 'piece' as const,
      unitPrice,
      discount: 0,
      totalPrice: Math.round(line.quantity * unitPrice * 100) / 100,
      details: [],
    }
  })
  const total = Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100

  return {
    type: draft.type,
    date: `${draft.date}T00:00:00.000Z`,
    ...(draft.type === 'sale' && draft.customerId ? { customerId: draft.customerId } : {}),
    ...(draft.type === 'purchase' && draft.partyName ? { supplierName: draft.partyName } : {}),
    items,
    subtotal: total,
    discountTotal: 0,
    taxRate: 0,
    taxTotal: 0,
    total,
    paidAmount: Math.min(major(draft.paidMinor), total),
    ...(draft.currency ? { currency: draft.currency } : {}),
    reference: draft.number ?? '',
    notes: draft.notes,
  }
}
