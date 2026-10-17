import { describe, it, expect } from 'vitest'
import {
  normalizePersianWord,
  persianWordsMatch,
  tokenizePersianSentence,
} from '../engine/persian-text'

describe('Persian Text Normalizer & Token Matching', () => {
  it('normalizes Arabic Yeh (ي, ى) to Persian Yeh (ی)', () => {
    expect(normalizePersianWord('مشتري')).toBe('مشتری')
    expect(normalizePersianWord('حتي')).toBe('حتی')
  })

  it('normalizes Arabic Kaf (ك) to Persian Keheh (ک)', () => {
    expect(normalizePersianWord('بانك')).toBe('بانک')
    expect(normalizePersianWord('كمك')).toBe('کمک')
  })

  it('normalizes Teh Marbuta (ة) to Heh (ه)', () => {
    expect(normalizePersianWord('دقیقّة')).toBe('دقیقه')
  })

  it('strips Persian and Arabic Harakat (Fatha, Damma, Kasra, Tanween, Tashdeed)', () => {
    expect(normalizePersianWord('فُرُوشَتْ')).toBe('فروشت')
    expect(normalizePersianWord('مُشْتَرِیٍ')).toBe('مشتری')
    expect(normalizePersianWord('شَفّافْ')).toBe('شفاف')
  })

  it('converts Persian and Eastern Arabic numerals to ASCII digits', () => {
    expect(normalizePersianWord('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890')
    expect(normalizePersianWord('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890')
  })

  it('strips Persian and Latin punctuation marks while retaining letters', () => {
    expect(normalizePersianWord('فروشت،')).toBe('فروشت')
    expect(normalizePersianWord('زیاده…')).toBe('زیاده')
    expect(normalizePersianWord('خالیه؟')).toBe('خالیه')
    expect(normalizePersianWord('«حسابچه»!')).toBe('حسابچه')
  })

  it('handles نیم‌فاصله (ZWNJ) in normalization and loose matching', () => {
    const withZwnj = 'می\u200Cکنه'
    const withoutZwnj = 'میکنه'
    expect(persianWordsMatch(withZwnj, withoutZwnj)).toBe(true)

    const pluralWithZwnj = 'مشتری\u200Cها'
    const pluralWithoutZwnj = 'مشتریها'
    expect(persianWordsMatch(pluralWithZwnj, pluralWithoutZwnj)).toBe(true)
  })

  it('correctly tokenizes sentences while preserving order', () => {
    const tokens = tokenizePersianSentence('فروشت زیاده… اما آخر ماه پولت کجا رفته!')
    expect(tokens).toEqual(['فروشت', 'زیاده…', 'اما', 'آخر', 'ماه', 'پولت', 'کجا', 'رفته!'])
  })
})
