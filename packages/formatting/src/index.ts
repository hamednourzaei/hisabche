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
  toPersianDigits,
  toArabicDigits,
  toLatinDigits,
  parseNumericInput,
  groupThousands,
} from './digits'

export { formatCompactCount } from './compact'

export { formatBytes } from './bytes'
