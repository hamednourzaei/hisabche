// ============================================
// backend/src/services/migration/index.ts
//
// The public surface of the migration core. Routes import from here; nothing
// outside reaches past it into a file.
// ============================================

export {
  MIGRATION_ENTITIES,
  MIGRATION_SOURCE_TYPES,
  MIGRATION_STATUSES,
  INTAKE_LIMITS,
  checkIntake,
  checkParsed,
  parseDelimited,
  detectDelimiter,
  normalizeDigits,
  normalizeText,
  normalizePhone,
  normalizeEmail,
  comparisonKey,
  parseMoneyMinor,
  parseDateIso,
  parseBoolean,
  type MigrationEntity,
  type MigrationSourceType,
  type MigrationStatus,
  type ParsedTable,
} from './migration.domain'

export {
  ENTITY_FIELDS,
  businessKeys,
  detectSource,
  suggestMapping,
  type FieldSpec,
  type MappingStatus,
  type MappingSuggestion,
  type SourceGuess,
} from './migration.entities'

export {
  DETECTABLE_ENTITIES,
  detectEntity,
  type DetectableEntity,
  type EntityDetection,
} from './detect-entity.domain'
export { readXlsx, rowsToCsv, serialToIso, XlsxError, type XlsxSheet } from './xlsx.domain'
export {
  findHeaderRow,
  inspectUpload,
  InspectionError,
  type SheetInspection,
  type UploadInspection,
} from './inspect.domain'
export { jalaliToGregorian, parseJalaliIso } from './jalali.domain'
export { inferMappingFromContent, type InferredMapping } from './column-shape.domain'
export {
  groupInvoiceRows,
  resolveInvoiceParties,
  toInvoiceBody,
  type InvoiceDraft,
} from './invoice-import.domain'

export {
  dryRun,
  reconcile,
  validateRows,
  type CandidateRow,
  type ColumnMapping,
  type DryRunSummary,
  type Finding,
  type FindingSeverity,
  type ReconciliationLine,
  type ValidationResult,
} from './migration.validate'

export { MigrationService, type MigrationDiscovery, type MigrationJob } from './migration.service'
