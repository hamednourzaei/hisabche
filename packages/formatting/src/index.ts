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

export { toCSV, csvFilename, UTF8_BOM, type CsvColumn } from './csv'

export {
  toPersianDigits,
  toArabicDigits,
  toLatinDigits,
  parseNumericInput,
  groupThousands,
} from './digits'
