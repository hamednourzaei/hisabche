// How a number is typed and shown: Latin value always, language's own digits on
// screen, thousands grouped LIVE, caret kept after the same digits.
import { describe, expect, it } from 'vitest'
import {
  caretAfter,
  groupNumeral,
  readNumeralText,
  showNumeral,
  significantBefore,
} from '../lib/numeral-input'

describe('numeral input', () => {
  it('reads every digit script and separator into a clean Latin string', () => {
    expect(readNumeralText('۲۵٬۴۰۰٬۰۰۰')).toBe('25400000')
    expect(readNumeralText('25,400,000')).toBe('25400000')
    expect(readNumeralText('١٢٫٥')).toBe('12.5')
    expect(readNumeralText('1.2.3')).toBe('1.23')
    expect(readNumeralText('-1,000')).toBe('-1000')
    expect(readNumeralText('abc')).toBe('')
  })

  it('groups after every three digits, keeps the decimals, keeps a trailing point', () => {
    expect(groupNumeral('25400000')).toBe('25,400,000')
    expect(groupNumeral('1234.5678')).toBe('1,234.5678')
    expect(groupNumeral('12.')).toBe('12.')
    expect(groupNumeral('-1000')).toBe('-1,000')
    expect(groupNumeral('')).toBe('')
  })

  it('shows Persian digits for Persian, Latin for Dari and English', () => {
    expect(showNumeral('25400000', 'fa', true)).toBe('۲۵,۴۰۰,۰۰۰')
    expect(showNumeral('25400000', 'af', true)).toBe('25,400,000')
    expect(showNumeral('25400000', 'en', true)).toBe('25,400,000')
    expect(showNumeral('1.5', 'fa', false)).toBe('۱٫۵')
    expect(showNumeral('1.5', 'en', false)).toBe('1.5')
  })

  it('keeps the caret after the same digits when a comma appears', () => {
    // typed «2500» then «0» at the end → «25,000», caret must stay at the end
    const typed = '25000'
    const before = significantBefore(typed, typed.length)
    expect(caretAfter('25,000', before)).toBe(6)
    // typing in the middle of «1,000» after the first digit
    expect(caretAfter('10,000', significantBefore('1|0000'.replace('|', ''), 1))).toBe(1)
  })
})
