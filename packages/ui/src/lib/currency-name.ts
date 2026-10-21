// ============================================
// A currency's name as a reader sees it — the one lookup for every screen.
//
// For a metal the name carries the unit it is SHOWN in: «طلا (کیلوگرم)»
// beside a kilogram figure. The old fixed label «طلا (گرم)» would have named
// grams under a kilogram amount (formatting/metal-unit.ts).
// ============================================

import { isMetal, metalDisplayUnit } from '@hisabche/formatting'

type Translate = (key: string, fallback: string) => string

const UNIT_FALLBACK = { g: 'گرم', kg: 'کیلوگرم', t: 'تن' } as const

export function nameOfCurrency(t: Translate, code: string, fallback: string = code): string {
  const key = code.toLowerCase()
  if (isMetal(code)) {
    const unit = metalDisplayUnit()
    return `${t(`metal.${key}`, code)} (${t(`metalUnit.${unit}`, UNIT_FALLBACK[unit])})`
  }
  return t(`currency.${key}`, fallback)
}
