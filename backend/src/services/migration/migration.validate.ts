// ============================================
// backend/src/services/migration/migration.validate.ts
//
// Turning parsed cells into candidate business objects, and saying honestly
// what is wrong with them.
//
// ---------------------------------------------------------------------------
// THREE SEVERITIES, NOT ONE
//
//   fatal    the row cannot be created at all
//   warning  the row can be created but a human should look
//   info     the importer changed the value, and says so
//
// Collapsing these into "errors" is how an import either refuses a whole file
// over a missing phone number, or imports 400 rows of garbage because nothing
// was technically fatal. Every finding names its row, its column and what to
// do about it — `ERR_IMPORT_17` is explicitly the anti-pattern.
//
// ---------------------------------------------------------------------------
// NOTHING HERE TOUCHES THE DATABASE
//
// Validation runs on the parsed file alone, so a dry run is genuinely
// non-mutating and its numbers can be trusted. Duplicate detection against
// EXISTING rows needs the database and lives in the service; what lives here
// is duplicates WITHIN the file, which is the case a spreadsheet actually
// produces.
// ============================================

import {
  comparisonKey,
  parseBoolean,
  parseMoneyMinor,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  type MigrationEntity,
  parseDateIso,
  normalizeDigits,
} from './migration.domain'
import { parseJalaliIso } from './jalali.domain'
import { warehouseOfStockField } from './stock-fields'
import { ENTITY_FIELDS, businessKeys, type FieldSpec } from './migration.entities'

export type FindingSeverity = 'fatal' | 'warning' | 'info'

export interface Finding {
  severity: FindingSeverity
  /** 1-based, matching what the user sees in their spreadsheet. */
  row: number
  /** The SOURCE column name, because that is what the user can go and fix. */
  column: string | null
  code: string
  /** Machine-readable context for the UI to render a translated sentence. */
  detail?: string
}

export interface CandidateRow {
  /** 1-based row number in the source file. */
  row: number
  values: Record<string, string | number | boolean>
  keys: Array<{ kind: string; key: string; strength: 'strong' | 'weak' }>
  /** A fatal finding anywhere on the row means it is not importable. */
  importable: boolean
  /**
   * This row is not a product of its own: it is the stock of the product on
   * THAT row in another warehouse (stock-import.domain.ts).
   */
  stockOf?: number | undefined
}

export interface ValidationResult {
  candidates: CandidateRow[]
  findings: Finding[]
  counts: {
    scanned: number
    valid: number
    fatal: number
    warning: number
    info: number
    duplicateInFile: number
  }
}

/** `mapping` is target field → source column index. Absent fields are absent. */
export type ColumnMapping = Record<string, number>

// Fields that are codes — compared exactly, by people and by machines.
const CODE_FIELDS = new Set(['sku', 'barcode', 'invoiceNumber', 'externalId'])

function coerce(
  spec: FieldSpec,
  raw: string,
  row: number,
  column: string,
  findings: Finding[],
  /** For a date: whether this COLUMN writes the day first. */
  dayFirst?: boolean,
): string | number | boolean | undefined {
  const text = normalizeText(raw)

  if (text === '') {
    if (spec.required) {
      findings.push({ severity: 'fatal', row, column, code: 'REQUIRED_FIELD_EMPTY' })
    }
    return undefined
  }

  switch (spec.kind) {
    case 'money': {
      // ⚠️ «10.00$ = 800.00» is TWO amounts — a foreign balance and its value at
      // some rate. Stripped of everything but digits it reads as one number
      // that is neither. Which of the two is meant is not ours to choose.
      if (text.includes('=')) {
        findings.push({
          severity: 'fatal',
          row,
          column,
          code: 'MONEY_UNREADABLE',
          detail: 'TWO_AMOUNTS',
        })
        return undefined
      }
      const parsed = parseMoneyMinor(text)
      if (!parsed.ok) {
        // Money that cannot be read is fatal even on an optional field. A
        // price the importer silently dropped to zero is a product sold at a
        // loss, and the roadmap forbids inventing financial truth.
        findings.push({
          severity: 'fatal',
          row,
          column,
          code: 'MONEY_UNREADABLE',
          detail: parsed.reason ?? '',
        })
        return undefined
      }
      if (parsed.minor! < 0) {
        findings.push({ severity: 'warning', row, column, code: 'MONEY_NEGATIVE' })
      }
      return parsed.minor!
    }

    case 'number': {
      const parsed = parseMoneyMinor(text, 0)
      if (!parsed.ok) {
        findings.push({ severity: 'fatal', row, column, code: 'NUMBER_UNREADABLE' })
        return undefined
      }
      if (parsed.minor! < 0) {
        findings.push({ severity: 'warning', row, column, code: 'NUMBER_NEGATIVE' })
      }
      return parsed.minor!
    }

    case 'decimal': {
      // Three places: enough for grams of a kilogram, exact as an integer.
      const parsed = parseMoneyMinor(text, 3)
      if (!parsed.ok) {
        findings.push({ severity: 'fatal', row, column, code: 'NUMBER_UNREADABLE' })
        return undefined
      }
      return parsed.minor! / 1000
    }

    case 'date': {
      // The calendar is read from the year: 1403 can only be Solar Hijri.
      const jalali = parseJalaliIso(text)
      if (jalali.ok) return jalali.iso
      if (jalali.reason === 'OUT_OF_RANGE') {
        findings.push({ severity: 'fatal', row, column, code: 'DATE_UNREADABLE', detail: text })
        return undefined
      }
      // A workbook date arrives as `2026-10-01` or `2026-10-01 14:30`.
      const parsed = parseDateIso(text.split(' ')[0] ?? text, dayFirst)
      if (!parsed.ok) {
        findings.push({
          severity: 'fatal',
          row,
          column,
          // 03/04/2026 is two different days; which one is not ours to pick.
          code: parsed.reason === 'AMBIGUOUS_ORDER' ? 'DATE_AMBIGUOUS' : 'DATE_UNREADABLE',
          detail: text,
        })
        return undefined
      }
      return parsed.iso!
    }

    case 'boolean': {
      const parsed = parseBoolean(text)
      if (parsed === null) {
        findings.push({ severity: 'warning', row, column, code: 'BOOLEAN_UNREADABLE' })
        return undefined
      }
      return parsed
    }

    case 'phone': {
      const phone = normalizePhone(text)
      if (phone === '') {
        findings.push({ severity: 'warning', row, column, code: 'PHONE_UNREADABLE' })
        return undefined
      }
      if (phone !== text) {
        findings.push({ severity: 'info', row, column, code: 'PHONE_NORMALISED', detail: phone })
      }
      return phone
    }

    case 'email': {
      const email = normalizeEmail(text)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        findings.push({ severity: 'warning', row, column, code: 'EMAIL_INVALID' })
        return undefined
      }
      return email
    }

    case 'enum': {
      const key = comparisonKey(text)
      const hit = (spec.enumValues ?? []).find((value) => comparisonKey(value) === key)
      if (!hit) {
        findings.push({
          severity: 'warning',
          row,
          column,
          code: 'ENUM_UNKNOWN',
          detail: (spec.enumValues ?? []).join(','),
        })
        return undefined
      }
      return hit
    }

    default: {
      if (spec.maxLength && text.length > spec.maxLength) {
        findings.push({
          severity: 'warning',
          row,
          column,
          code: 'TEXT_TRUNCATED',
          detail: `${spec.maxLength}`,
        })
        return text.slice(0, spec.maxLength)
      }
      if (text !== raw.trim()) {
        findings.push({ severity: 'info', row, column, code: 'TEXT_NORMALISED' })
      }
      // ⚠️ A code is matched and scanned in ASCII digits. «۱۰۰۱» kept as it
      // was written would never match the 1001 a scanner or another file gives.
      return CODE_FIELDS.has(spec.key) ? normalizeDigits(text) : text
    }
  }
}

/**
 * Validate the whole file against one entity's field specs.
 *
 * No date field exists on either catalogue entity today, which is why nothing
 * here calls `parseDateIso`. That parser is written and tested rather than
 * plumbed through unused: threading a `dayFirst` option that no field reads
 * would be dead wiring, and the ambiguity rule it encodes is the part worth
 * having settled before invoices arrive.
 */
/** Group names that mean «these owe us»: the only ledger rows that are customers. */
const CUSTOMER_GROUPS = [
  'debtor',
  'customer',
  'receivable',
  'client',
  'بدهکار',
  'مشتری',
  'دریافتنی',
].map(comparisonKey)
const CREDIT_SIDES = ['cr', 'credit', 'creditor', 'بستانکار', 'بس'].map(comparisonKey)

/**
 * Whether a column of `a/b/yyyy` dates writes the day first.
 *
 * true or false only when the cells prove it (a first part above 12, or a
 * second part above 12) and never both ways; otherwise undefined.
 */
export function columnDayFirst(cells: readonly string[]): boolean | undefined {
  let dayFirst = false
  let monthFirst = false
  for (const cell of cells) {
    const parts = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(normalizeDigits(normalizeText(cell)))
    if (!parts) continue
    if (Number(parts[1]) > 12) dayFirst = true
    if (Number(parts[2]) > 12) monthFirst = true
  }
  if (dayFirst === monthFirst) return undefined
  return dayFirst
}

export function validateRows(
  entity: MigrationEntity,
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
  options: { raggedRows?: number[] } = {},
): ValidationResult {
  const specs = ENTITY_FIELDS[entity]
  const findings: Finding[] = []
  const candidates: CandidateRow[] = []

  // A ragged row was padded so the parse could finish. The user is told, once
  // per row, before anything else is said about it.
  for (const index of options.raggedRows ?? []) {
    findings.push({
      severity: 'warning',
      row: index + 1,
      column: null,
      code: 'ROW_CELL_COUNT_MISMATCH',
    })
  }

  // Warehouse quantity columns (one column per warehouse) are mapped by
  // warehouse, not by field name.
  const stockColumns =
    entity === 'product'
      ? Object.entries(mapping).filter(([field]) => warehouseOfStockField(field) !== null)
      : []

  // ⚠️ A STOCK SHEET has no product names: «code, warehouse, quantity» for
  // products that already exist. The name is then not a missing column — the
  // sheet is not introducing products. Each row must find its product by code,
  // and one that does not is refused where the catalogue is known (the service).
  const stockSheet =
    entity === 'product' &&
    mapping['name'] === undefined &&
    (mapping['sku'] !== undefined || mapping['barcode'] !== undefined) &&
    (mapping['quantity'] !== undefined || stockColumns.length > 0)

  const missingRequired = specs
    .filter((spec) => spec.required && mapping[spec.key] === undefined)
    .filter((spec) => !(stockSheet && spec.key === 'name'))
    .map((spec) => spec.key)

  for (const field of missingRequired) {
    findings.push({
      severity: 'fatal',
      row: 0,
      column: null,
      code: 'REQUIRED_FIELD_UNMAPPED',
      detail: field,
    })
  }

  // ⚠️ 03/04/2026 is two different days, and a row cannot say which. A
  // COLUMN can: one cell reading 25/04/2026 settles every other cell in it,
  // because nobody mixes the two orders in one column. Where no cell settles
  // it the order stays unknown and those rows are refused, as before.
  const dayFirstOf = new Map<string, boolean | undefined>()
  for (const spec of specs) {
    const column = mapping[spec.key]
    if (spec.kind !== 'date' || column === undefined) continue
    dayFirstOf.set(spec.key, columnDayFirst(rows.map((cells) => cells[column] ?? '')))
  }

  rows.forEach((cells, index) => {
    const row = index + 1
    const before = findings.length
    const values: Record<string, string | number | boolean> = {}

    for (const spec of specs) {
      const column = mapping[spec.key]
      if (column === undefined) continue

      const raw = cells[column] ?? ''
      const value = coerce(
        spec,
        raw,
        row,
        headers[column] ?? `#${column}`,
        findings,
        dayFirstOf.get(spec.key),
      )
      if (value !== undefined) values[spec.key] = value
    }

    for (const [field, column] of stockColumns) {
      const value = coerce(
        { key: field, kind: 'decimal', required: false, aliases: [] },
        cells[column] ?? '',
        row,
        headers[column] ?? `#${column}`,
        findings,
      )
      if (value !== undefined) values[field] = value
    }

    const rowFindings = findings.slice(before)

    // ⚠️ A CONTINUATION ROW is not a broken record. Exports write a party's
    // second address, or the components of a bill of materials, on rows
    // UNDER it with the name cell left empty. Those rows belong to the row
    // above; reporting each as «required field empty» buried the real
    // problems of a file under dozens of false ones. They are still not
    // imported — and they say why.
    // A row under a product that names one of its COMPONENTS: it has no product
    // name because it is not a product. It is kept (the formula is read from
    // it) and is not imported as a product.
    const componentRow =
      entity === 'product' &&
      String(values['bomComponent'] ?? '') !== '' &&
      String(values['name'] ?? '') === '' &&
      rowFindings.every(
        (finding) => finding.severity !== 'fatal' || finding.code === 'REQUIRED_FIELD_EMPTY',
      )
    if (componentRow) {
      for (const finding of rowFindings) {
        if (finding.code !== 'REQUIRED_FIELD_EMPTY') continue
        finding.severity = 'info'
        finding.code = 'BOM_COMPONENT_ROW'
      }
    }

    const continuation =
      entity !== 'invoice' &&
      // Nothing this importer reads is on the row — only columns it does not
      // use. A row with a phone and no name is NOT this: it is a customer with
      // its name missing, and stays the error it is.
      Object.keys(values).length === 0 &&
      cells.some((cell) => (cell ?? '').trim() !== '') &&
      rowFindings.some((finding) => finding.code === 'REQUIRED_FIELD_EMPTY') &&
      rowFindings.every(
        (finding) => finding.severity !== 'fatal' || finding.code === 'REQUIRED_FIELD_EMPTY',
      )
    if (continuation) {
      for (const finding of rowFindings) {
        if (finding.code !== 'REQUIRED_FIELD_EMPTY') continue
        finding.severity = 'info'
        finding.code = 'ROW_CONTINUATION'
      }
    }

    let importable =
      !continuation &&
      !componentRow &&
      missingRequired.length === 0 &&
      !rowFindings.some((finding) => finding.severity === 'fatal')

    if (entity === 'customer' && importable) {
      // ⚠️ ONLY THE CUSTOMERS OF A LEDGER. With a group column, a row is
      // imported when its group names a debtor; a supplier, a bank account or
      // an expense head is left out and named — never turned into a customer.
      const group = comparisonKey(String(values['ledgerGroup'] ?? ''))
      if (group !== '' && !CUSTOMER_GROUPS.some((word) => group.includes(word))) {
        findings.push({
          severity: 'warning',
          row,
          column: null,
          code: 'ROW_NOT_A_CUSTOMER',
          detail: String(values['ledgerGroup']),
        })
        importable = false
      }

      // ⚠️ A CREDIT balance is money WE owe. The opening balance here is what
      // the customer owes; importing a credit as that would invert it.
      const side = comparisonKey(String(values['balanceSide'] ?? ''))
      if (importable && values['openingBalance'] !== undefined && CREDIT_SIDES.includes(side)) {
        findings.push({ severity: 'warning', row, column: null, code: 'OPENING_BALANCE_IS_CREDIT' })
        importable = false
      }
      // The same fact written as a column of its own: «مانده بستانکار».
      if (importable && Number(values['creditBalance']) > 0) {
        findings.push({ severity: 'warning', row, column: null, code: 'OPENING_BALANCE_IS_CREDIT' })
        importable = false
      }
    }

    // A row where every mapped cell was blank is an empty line, not a record.
    // Reported so the count adds up, never imported.
    if (Object.keys(values).length === 0 && !continuation) {
      findings.push({ severity: 'warning', row, column: null, code: 'ROW_EMPTY' })
      candidates.push({ row, values, keys: [], importable: false })
      return
    }

    const stringValues: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) stringValues[key] = String(value)

    candidates.push({ row, values, keys: businessKeys(entity, stringValues), importable })
  })

  // ─── Duplicates WITHIN the file ───────────────────────────────────────────
  //
  // Two rows sharing a strong key are the same object written twice. The
  // SECOND one is flagged, not the first: the first occurrence is what the
  // user will recognise, and flagging both makes the report unreadable.
  //
  // ⚠️ EXCEPT a product's stock in ANOTHER warehouse. «Rice · Main · 100» and
  // «Rice · Second · 45» are one product in two buildings, not rice written
  // twice. With a warehouse on both rows and the two differing, the second is
  // the first's stock there; the same product AND warehouse twice is still a
  // repeat, and which of its two quantities is right is not ours to pick.
  const seen = new Map<string, number>()
  const warehousesOf = new Map<number, Set<string>>()
  const warehouseOf = (candidate: CandidateRow) =>
    entity === 'product' ? comparisonKey(String(candidate.values['warehouse'] ?? '')) : ''
  let duplicateInFile = 0

  for (const candidate of candidates) {
    if (!candidate.importable) continue
    const here = warehouseOf(candidate)
    const strong = candidate.keys.filter((key) => key.strength === 'strong')
    // A product with no code is known only by its name. That is too weak to
    // call two rows the same product — unless both also say which warehouse,
    // which is what a per-warehouse stock list looks like.
    const identities =
      strong.length > 0 || here === ''
        ? strong
        : candidate.keys.filter((key) => key.kind === 'name')

    const first = identities.map((key) => seen.get(key.key)).find((row) => row !== undefined)
    if (first === undefined) {
      for (const key of identities) seen.set(key.key, candidate.row)
      warehousesOf.set(candidate.row, new Set(here === '' ? [] : [here]))
      continue
    }

    candidate.importable = false
    const known = warehousesOf.get(first) ?? new Set<string>()
    if (here !== '' && known.size > 0 && !known.has(here)) {
      known.add(here)
      candidate.stockOf = first
      findings.push({
        severity: 'info',
        row: candidate.row,
        column: null,
        code: 'STOCK_ROW_FOR_WAREHOUSE',
        detail: `${first}`,
      })
      continue
    }

    duplicateInFile += 1
    findings.push({
      severity: 'warning',
      row: candidate.row,
      column: null,
      code: here !== '' && known.has(here) ? 'DUPLICATE_STOCK_ROW' : 'DUPLICATE_IN_FILE',
      detail: `${first}`,
    })
  }

  const counts = {
    scanned: rows.length,
    valid: candidates.filter((candidate) => candidate.importable).length,
    fatal: findings.filter((finding) => finding.severity === 'fatal').length,
    warning: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
    duplicateInFile,
  }

  return { candidates, findings, counts }
}

/* ─── Dry run ─────────────────────────────────────────────────────────────── */

export interface DryRunSummary {
  entity: MigrationEntity
  toCreate: number
  toUpdate: number
  toSkip: number
  needsReview: number
  /** Sum of the money fields that WOULD be written. Minor units. */
  financialImpactMinor: Record<string, number>
  /** Production formulas that will be written for the products of this file. */
  boms?: number | undefined
  /** Opening stock that will be written: every unit, and how many (product, warehouse) pairs. */
  stockUnits?: number | undefined
  stockPlacements?: number | undefined
  /** Stated on every dry run, because the user is about to be asked to trust it. */
  productionDataChanged: false
}

/**
 * What committing would do, computed from the candidates and the set of keys
 * that already exist in this workspace.
 *
 * `existingKeys` comes from the database, but this function stays pure so the
 * arithmetic is testable without one. The financial total is the number the
 * reconciliation step is checked against afterwards — if the dry run says
 * 1,284,440 and the reconciliation says something else, one of the two lied,
 * and the migration is reported as completed-with-warnings rather than
 * completed.
 */
export function dryRun(
  entity: MigrationEntity,
  candidates: CandidateRow[],
  existingKeys: ReadonlySet<string>,
): DryRunSummary {
  const moneyFields = ENTITY_FIELDS[entity]
    .filter((spec) => spec.kind === 'money')
    .map((spec) => spec.key)

  const financialImpactMinor: Record<string, number> = {}
  for (const field of moneyFields) financialImpactMinor[field] = 0

  let toCreate = 0
  let toUpdate = 0
  let toSkip = 0
  let needsReview = 0

  for (const candidate of candidates) {
    if (!candidate.importable) {
      toSkip += 1
      continue
    }

    const strong = candidate.keys.filter((key) => key.strength === 'strong')
    const matches = strong.some((key) => existingKeys.has(key.key))

    if (matches) {
      toUpdate += 1
    } else {
      // No strong key at all means the only evidence of identity is a name.
      // That is a review item, not an automatic create: two shops in one town
      // genuinely share a name, and merging them is not recoverable.
      if (strong.length === 0) needsReview += 1
      toCreate += 1
    }

    for (const field of moneyFields) {
      const value = candidate.values[field]
      if (typeof value === 'number') financialImpactMinor[field]! += value
    }
  }

  return {
    entity,
    toCreate,
    toUpdate,
    toSkip,
    needsReview,
    financialImpactMinor,
    productionDataChanged: false,
  }
}

/* ─── Reconciliation ──────────────────────────────────────────────────────── */

export interface ReconciliationLine {
  measure: string
  sourceValue: number
  hisabcheValue: number
  differenceValue: number
  matched: boolean
}

/**
 * Did what we meant to write actually land?
 *
 * Counted AFTER the commit, from the database, against the dry run's own
 * numbers. A migration is not successful because rows were inserted — it is
 * successful because the totals agree. When they do not, the status is
 * `completed_with_warnings` and the difference is shown; it is never rounded
 * away or described as "almost done".
 */
export function reconcile(
  expected: Record<string, number>,
  actual: Record<string, number>,
): { lines: ReconciliationLine[]; matched: boolean } {
  const measures = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()

  const lines = measures.map((measure) => {
    const sourceValue = expected[measure] ?? 0
    const hisabcheValue = actual[measure] ?? 0
    return {
      measure,
      sourceValue,
      hisabcheValue,
      differenceValue: hisabcheValue - sourceValue,
      matched: hisabcheValue === sourceValue,
    }
  })

  return { lines, matched: lines.every((line) => line.matched) }
}
