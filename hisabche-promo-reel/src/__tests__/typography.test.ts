import { describe, expect, it } from 'vitest'
import { getOpticalFontSize, shouldStackCards, splitTitleSubtitle } from '../ui/typography'

describe('Persian Optical Typography & Adaptive Layout Engine', () => {
  describe('getOpticalFontSize', () => {
    it('returns appropriate sizes for card-half containers', () => {
      const short = getOpticalFontSize('اکسل', 'card-half')
      expect(short.fontSize).toBe('22px')
      expect(short.lineHeight).toBeGreaterThanOrEqual(1.5)

      const medium = getOpticalFontSize('سود فاکتور خرید', 'card-half')
      expect(medium.fontSize).toBe('18px')
      expect(medium.lineHeight).toBeGreaterThanOrEqual(1.55)

      const long = getOpticalFontSize('سود تضمین‌شده روی هر دستگاه خروجی سوله', 'card-half')
      expect(long.fontSize).toBe('15px')
      expect(long.lineHeight).toBeGreaterThanOrEqual(1.65)
    })

    it('returns generous line heights for Persian ascenders and descenders (never < 1.45)', () => {
      const hero = getOpticalFontSize('تیتر اصلی کمپین حسابچه', 'hero')
      expect(hero.lineHeight).toBeGreaterThanOrEqual(1.45)

      const caption = getOpticalFontSize(
        'تولیدکننده موفق کسی است که بهای ساخت را قبل از تراشکاری می‌داند',
        'caption',
      )
      expect(caption.lineHeight).toBeGreaterThanOrEqual(1.65)
    })
  })

  describe('shouldStackCards', () => {
    it('returns false for micro-copy (<= 18 chars and <= 3 words on both sides)', () => {
      expect(shouldStackCards('اکسل سنتی', 'حسابچه')).toBe(false)
      expect(shouldStackCards('۲۰۰ میلیون', '۸۵ میلیون')).toBe(false)
      expect(shouldStackCards('نامشخص؟', 'دقیق و شفاف')).toBe(false)
    })

    it('returns true when either card exceeds 18 chars or 3 words', () => {
      expect(shouldStackCards('ذوب شدن سرمایه + تلاش بی‌ثمر', 'سود تضمین‌شده')).toBe(true)

      expect(shouldStackCards('سود تضمین‌شده روی هر دستگاه خروجی سوله', 'روش دستی')).toBe(true)

      expect(
        shouldStackCards(
          'تلاش بی‌ثمر شبانه‌روزی + ذوب شدن سرمایه',
          'سود تضمین‌شده روی هر دستگاه خروجی سوله',
        ),
      ).toBe(true)
    })
  })

  describe('splitTitleSubtitle', () => {
    it('leaves short punchy phrases intact as title only', () => {
      const result = splitTitleSubtitle('سود خالص')
      expect(result.title).toBe('سود خالص')
      expect(result.subtitle).toBeUndefined()
    })

    it('splits on explicit + delimiter for clear hierarchy', () => {
      const left = splitTitleSubtitle(
        'ذوب شدن سرمایه + تلاش بی‌ثمر شبانه‌روزی بدون احتساب ضایعات و قطعات',
      )
      expect(left.title).toBe('ذوب شدن سرمایه')
      expect(left.subtitle).toBe('تلاش بی‌ثمر شبانه‌روزی بدون احتساب ضایعات و قطعات')

      const right = splitTitleSubtitle(
        'سود تضمین‌شده + محاسبه دقیق بهای ساخت روی هر دستگاه خروجی سوله',
      )
      expect(right.title).toBe('سود تضمین‌شده')
      expect(right.subtitle).toBe('محاسبه دقیق بهای ساخت روی هر دستگاه خروجی سوله')
    })

    it('splits multi-word sentences without delimiter into 2-word title and rest as subtitle', () => {
      const result = splitTitleSubtitle('سود تضمین‌شده روی هر دستگاه خروجی سوله')
      expect(result.title).toBe('سود تضمین‌شده')
      expect(result.subtitle).toBe('روی هر دستگاه خروجی سوله')
    })
  })
})
