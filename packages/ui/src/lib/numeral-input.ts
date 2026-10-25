// ============================================
// packages/ui/src/lib/numeral-input.ts
//
// How a number is TYPED and SHOWN in an input — one place, for every numeric
// field (NumberStepper, MoneyInput, the invoice grid, the preview).
//
// ⚠️ THE VALUE IS ALWAYS LATIN DIGITS; ONLY THE TEXT ON SCREEN CHANGES.
// What a form keeps and sends is `1234567.5`. What the person reads is
// `۱٬۲۳۴٬۵۶۷٫۵` in Persian and `1,234,567.5` in Dari and English (owner rule,
// 25 Oct 2026: Persian = Persian digits, Dari and English = Latin digits).
//
// ⚠️ GROUPING IS LIVE. A separator that only appears after the field loses
// focus is a separator the person cannot trust while typing 25000000. The caret
// is put back after the same number of digits it was after, so grouping never
// moves what the person is typing.
// ============================================

import {
  toLatinDigits,
  toPersianDigits,
  usesLatinDigits,
  type UiLanguage,
} from '@hisabche/formatting'

const GROUP_MARKS = /[,٬،\s]/g

/** The text a person typed or pasted → a clean Latin numeric string. */
export function readNumeralText(text: string): string {
  const latin = toLatinDigits(text).replace(/٫/g, '.').replace(GROUP_MARKS, '')
  const negative = latin.trimStart().startsWith('-')
  const cleaned = latin.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  const normalised =
    firstDot === -1
      ? cleaned
      : `${cleaned.slice(0, firstDot)}.${cleaned.slice(firstDot + 1).replace(/\./g, '')}`
  return negative && normalised ? `-${normalised}` : normalised
}

/** Group the whole part by thousands, leave the decimals as typed. */
export function groupNumeral(raw: string): string {
  if (!raw) return ''
  const negative = raw.startsWith('-')
  const [whole = '', ...rest] = raw.replace('-', '').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}${rest.length ? `.${rest.join('')}` : ''}`
}

/** A clean Latin numeric string → the text the field shows for this language. */
export function showNumeral(raw: string, lang: UiLanguage, group: boolean): string {
  const text = group ? groupNumeral(raw) : raw
  return usesLatinDigits(lang) ? text : toPersianDigits(text).replace(/\./g, '٫')
}

const DIGIT_OR_POINT = /[0-9۰-۹٠-٩.٫]/

/** How many digits (and decimal points) lie before `caret` — what must survive re-formatting. */
export function significantBefore(text: string, caret: number): number {
  let count = 0
  for (let i = 0; i < Math.min(caret, text.length); i++) {
    if (DIGIT_OR_POINT.test(text[i] ?? '')) count++
  }
  return count
}

/** The caret position in `text` that sits after `significant` digits. */
export function caretAfter(text: string, significant: number): number {
  if (significant <= 0) return 0
  let count = 0
  for (let i = 0; i < text.length; i++) {
    if (DIGIT_OR_POINT.test(text[i] ?? '')) count++
    if (count === significant) return i + 1
  }
  return text.length
}
