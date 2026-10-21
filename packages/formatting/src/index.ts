// ============================================
// @hisabche/formatting — canonical display formatting.
//
// Formatting only. Nothing in this package returns a number, so it can never
// participate in a financial calculation.
// ============================================

export {
  CURRENCY_SIGN,
  FRACTION_DIGITS,
  currencySign,
  fractionDigits,
  formatAmount,
  formatMoney,
  formatNumber,
  type ActiveCurrency,
  type KnownCurrency,
} from './money'

export { resolveIntlLocale, usesLatinDigits, type UiLanguage } from './locale'

export { formatDate, formatDateLong, formatDateTime, toIsoDay, type DateInput } from './dates'

export { toCSV, csvFilename, UTF8_BOM, type CsvColumn } from './csv'

export {
  buildCsvZip,
  buildXlsx,
  cellText,
  columnsOf,
  markdownTable,
  mdEscape,
  type XlsxSheet,
} from './table-export'

export {
  toPersianDigits,
  toArabicDigits,
  toLatinDigits,
  parseNumericInput,
  groupThousands,
} from './digits'

export { formatCompactCount, formatCompactValue } from './compact'

export { formatBytes } from './bytes'
export {
  METAL_UNITS,
  METAL_UNIT_GRAMS,
  METAL_UNIT_SIGN,
  isMetal,
  metalDisplayUnit,
  metalFactor,
  metalFractionDigits,
  setMetalDisplayUnit,
  toShownMetal,
  toStoredMetal,
  type MetalUnit,
} from './metal-unit'
