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
import { currencyCodeOf, matchPlace, type NamedPlace } from './places.domain'
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
  /** As the file names them; matched to the business's own in `resolveInvoicePlaces`. */
  warehouseName: string | null
  branchName: string | null
  warehouseId: string | null
  branchId: string | null
  notes: string
  lines: InvoiceDraftLine[]
  paidMinor: number
  /** Sum of the lines, before discount and tax. */
  subtotalMinor: number
  /** Line discounts plus the invoice-level discount, as an amount. */
  discountMinor: number
  /** Tax as an AMOUNT the file states; 0 when it gives a rate instead (or nothing). */
  taxMinor: number
  /** Tax as a percentage of what is left after the discount; null when not given. */
  taxRate: number | null
  /** What is owed for the invoice: subtotal − discount + tax. */
  totalMinor: number
  importable: boolean
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const amount = (value: unknown): number | null => (typeof value === 'number' ? value : null)

const PURCHASE_WORDS = new Set(['purchase', 'buy', 'bill', 'خرید', 'خريد'])

/**
 * What makes this document the same document on a second run — of this file
 * or of another.
 *
 * ⚠️ NOT THE NUMBER ALONE. Two shops, two years, or two source systems all
 * have an «invoice 1024». Keyed by number only, the second one would be taken
 * for the first and silently skipped as «already imported». So the number is
 * joined by the date and the party; and a document with no number at all is
 * known by everything it says — its date, its party and each of its lines.
 *
 * A row that is an invoice on its own keeps its row position as well: two
 * identical cash sales on one day are two sales.
 */
function finalIdentity(draft: InvoiceDraft): string {
  const who = comparisonKey(draft.partyName ?? draft.partyPhone ?? '')
  if (draft.number) return `number:${comparisonKey(draft.number)}|${draft.date}|${who}`

  const lines = draft.lines
    .map(
      (line) => `${comparisonKey(line.name)}×${line.quantity}@${Math.round(line.unitPriceMinor)}`,
    )
    .join(';')
  const alone = draft.identity.startsWith('row:') ? `|row${draft.firstRow}` : ''
  return `doc:${draft.date}|${who}|${lines}${alone}`
}

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
  /** Per document: what each of its rows put in the «total» column, with the row's own amount. */
  const statedTotals = new Map<string, Array<{ total: number; line: number }>>()
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
    const group = text(values['groupKey'])
    // What makes rows ONE document while grouping: its number; failing that,
    // the mark a printed form was given; failing that, the row is alone.
    const identity =
      number !== ''
        ? `number:${comparisonKey(number)}`
        : group !== ''
          ? `form:${comparisonKey(group)}`
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
        currency: text(values['currency']) || null,
        warehouseName: text(values['warehouse']) || null,
        branchName: text(values['branch']) || null,
        warehouseId: null,
        branchId: null,
        notes: text(values['notes']),
        lines: [],
        paidMinor: amount(values['paidAmount']) ?? 0,
        subtotalMinor: 0,
        discountMinor: amount(values['invoiceDiscount']) ?? 0,
        taxMinor: amount(values['invoiceTax']) ?? 0,
        taxRate: amount(values['taxRate']),
        totalMinor: 0,
        importable: true,
      }
      byKey.set(identity, draft)
      statedTotals.set(identity, [])
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
    // Registers write the line amount either before its discount or after
    // it. Both are the line reading correctly; anything else is a mismatch.
    const lineDiscount = amount(values['discount']) ?? 0
    const gross = unitPrice !== null ? unitPrice * quantity : 0
    if (
      unitPrice !== null &&
      stated !== null &&
      Math.abs(stated - gross) > 1 &&
      Math.abs(stated - (gross - lineDiscount)) > 1
    ) {
      findings.push({
        severity: 'warning',
        row: candidate.row,
        column: null,
        code: 'INVOICE_LINE_TOTAL_MISMATCH',
        detail: `${stated} ≠ ${quantity} × ${unitPrice}`,
      })
    }

    // A discount or a tax written on the row belongs to the document.
    draft.discountMinor += amount(values['discount']) ?? 0
    draft.taxMinor += amount(values['tax']) ?? 0

    const rowTotal = amount(values['total'])
    // Only when the row has its own price is «total» a claim about the invoice
    // rather than the line amount itself.
    if (rowTotal !== null && (unitPrice !== null || amount(values['lineTotal']) !== null)) {
      statedTotals.get(identity)?.push({ total: rowTotal, line: quantity * unitPriceMinor })
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
    const grouping = draft.identity
    if (draft.lines.length === 0) draft.importable = false

    draft.subtotalMinor = Math.round(
      draft.lines.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0),
    )

    // ⚠️ A discount larger than the goods is not a discount; it is a wrong
    // column, and importing it would make an invoice worth nothing.
    if (draft.importable && draft.discountMinor > draft.subtotalMinor) {
      refuse(draft, draft.firstRow, 'INVOICE_DISCOUNT_EXCEEDS_TOTAL')
    }
    if (draft.discountMinor < 0 || draft.taxMinor < 0) {
      refuse(draft, draft.firstRow, 'INVOICE_AMOUNT_NEGATIVE')
    }

    const taxable = Math.max(0, draft.subtotalMinor - draft.discountMinor)
    // An amount the file states wins over a rate: it is what was charged.
    const tax =
      draft.taxMinor > 0
        ? draft.taxMinor
        : draft.taxRate !== null && draft.taxRate > 0
          ? Math.round((taxable * Math.min(100, draft.taxRate)) / 100)
          : 0
    if (draft.taxMinor > 0) draft.taxRate = null
    draft.totalMinor = taxable + tax

    // ⚠️ THE FILE'S OWN TOTAL IS A CHECK, AND IT IS ENFORCED. If the sheet says
    // the invoice came to 990 and the lines, discount and tax read here come to
    // 1,000, then something on that invoice was not understood — and importing
    // 1,000 would change what the business is owed. The invoice is refused
    // with both numbers, never quietly imported at ours.
    //
    // «Total» repeated on every line of a table is the LINE amount under
    // another name; it is a statement about the invoice only when the rows
    // agree on one value (or a single row says it).
    const stated = statedTotals.get(grouping) ?? []
    const distinct = [...new Set(stated.map((entry) => entry.total))]
    const perLine =
      stated.length > 1 && stated.every((entry) => Math.abs(entry.total - entry.line) <= 1)
    if (draft.importable && distinct.length === 1 && !perLine) {
      const said = distinct[0] as number
      // One minor unit of tolerance per line, for sheets that round each line.
      if (Math.abs(said - draft.totalMinor) > Math.max(1, draft.lines.length)) {
        refuse(
          draft,
          draft.firstRow,
          'INVOICE_TOTAL_MISMATCH',
          `${said / 100} ≠ ${draft.totalMinor / 100}`,
        )
      }
    }

    if (draft.importable && draft.paidMinor > draft.totalMinor) {
      refuse(draft, draft.firstRow, 'INVOICE_PAID_EXCEEDS_TOTAL')
    }

    draft.identity = finalIdentity(draft)
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

/* ─── Where, and in what money ────────────────────────────────────────────── */

/**
 * Give each draft its currency, its warehouse and its branch — or say why not.
 *
 * ⚠️ THE CURRENCY IS NEVER ASSUMED. «1000» in a sheet is a thousand of
 * something, and tomans, rials and afghanis differ by orders of magnitude. An
 * invoice takes the currency its row names; failing that, the one the person
 * chose for the whole file; failing both, it is refused.
 *
 * ⚠️ WITH SEVERAL WAREHOUSES, AN INVOICE THAT MOVES STOCK MUST NAME ONE. The
 * invoice service moves a product's total either way, but a building's stock
 * only when the invoice says which building — so an unnamed sale would leave
 * the product at 5 and every warehouse still at 10.
 */
export function resolveInvoicePlaces(
  drafts: InvoiceDraft[],
  known: {
    warehouses: readonly NamedPlace[]
    branches: readonly NamedPlace[]
    currencies: readonly string[]
    defaultCurrency: string | null
  },
): Finding[] {
  const findings: Finding[] = []
  const refuse = (draft: InvoiceDraft, code: string, detail?: string) => {
    findings.push({
      severity: 'fatal',
      row: draft.firstRow,
      column: null,
      code,
      ...(detail ? { detail } : {}),
    })
    draft.importable = false
  }

  for (const draft of drafts) {
    if (!draft.importable) continue

    if (draft.currency) {
      const code = currencyCodeOf(draft.currency, known.currencies)
      if (!code) refuse(draft, 'INVOICE_CURRENCY_UNKNOWN', draft.currency)
      else draft.currency = code
    } else if (known.defaultCurrency) draft.currency = known.defaultCurrency
    else refuse(draft, 'INVOICE_CURRENCY_REQUIRED')
    if (!draft.importable) continue

    if (draft.warehouseName) {
      const match = matchPlace(draft.warehouseName, known.warehouses)
      if ('id' in match) draft.warehouseId = match.id
      else refuse(draft, `INVOICE_WAREHOUSE_${match.reason}`, draft.warehouseName)
    } else if (known.warehouses.length > 1 && draft.lines.some((line) => line.productId)) {
      refuse(draft, 'INVOICE_WAREHOUSE_REQUIRED')
    }
    if (!draft.importable) continue

    if (draft.branchName) {
      const match = matchPlace(draft.branchName, known.branches)
      if ('id' in match) draft.branchId = match.id
      else refuse(draft, `INVOICE_BRANCH_${match.reason}`, draft.branchName)
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
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100
  const discountTotal = major(draft.discountMinor)
  const taxable = Math.max(0, Math.round((subtotal - discountTotal) * 100) / 100)
  // Either the amount the file states, or its rate — never both: the invoice
  // service works the tax out from the rate when one is given.
  const taxRate = draft.taxMinor > 0 ? 0 : (draft.taxRate ?? 0)
  const taxTotal =
    draft.taxMinor > 0
      ? major(draft.taxMinor)
      : Math.round(((taxable * Math.min(100, taxRate)) / 100) * 100) / 100
  const total = Math.round((taxable + taxTotal) * 100) / 100

  return {
    type: draft.type,
    date: `${draft.date}T00:00:00.000Z`,
    ...(draft.type === 'sale' && draft.customerId ? { customerId: draft.customerId } : {}),
    ...(draft.type === 'purchase' && draft.partyName ? { supplierName: draft.partyName } : {}),
    items,
    subtotal,
    discountTotal,
    discountType: 'fixed' as const,
    taxRate,
    taxTotal,
    total,
    paidAmount: Math.min(major(draft.paidMinor), total),
    ...(draft.currency ? { currency: draft.currency } : {}),
    ...(draft.warehouseId ? { warehouseId: draft.warehouseId } : {}),
    reference: draft.number ?? '',
    notes: draft.notes,
  }
}
