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
} from './migration.domain'
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

function coerce(
  spec: FieldSpec,
  raw: string,
  row: number,
  column: string,
  findings: Finding[],
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
      return text
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

  const missingRequired = specs
    .filter((spec) => spec.required && mapping[spec.key] === undefined)
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

  rows.forEach((cells, index) => {
    const row = index + 1
    const before = findings.length
    const values: Record<string, string | number | boolean> = {}

    for (const spec of specs) {
      const column = mapping[spec.key]
      if (column === undefined) continue

      const raw = cells[column] ?? ''
      const value = coerce(spec, raw, row, headers[column] ?? `#${column}`, findings)
      if (value !== undefined) values[spec.key] = value
    }

    const rowFindings = findings.slice(before)
    const importable =
      missingRequired.length === 0 && !rowFindings.some((finding) => finding.severity === 'fatal')

    // A row where every mapped cell was blank is an empty line, not a record.
    // Reported so the count adds up, never imported.
    if (Object.keys(values).length === 0) {
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
  const seen = new Map<string, number>()
  let duplicateInFile = 0

  for (const candidate of candidates) {
    if (!candidate.importable) continue
    for (const key of candidate.keys) {
      if (key.strength !== 'strong') continue
      const first = seen.get(key.key)
      if (first === undefined) {
        seen.set(key.key, candidate.row)
        continue
      }
      duplicateInFile += 1
      candidate.importable = false
      findings.push({
        severity: 'warning',
        row: candidate.row,
        column: null,
        code: 'DUPLICATE_IN_FILE',
        detail: `${first}`,
      })
      break
    }
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
