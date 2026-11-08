// ============================================
// advances-02: the dashboard card «پیش‌دریافت / پیش‌پرداخت باز».
//
// Customer side / supplier side, each per currency — never added across
// currencies. undefined = no answer yet (the card waits); null = the server
// could not read it (the card says so, never «0»).
// ============================================

import { FRACTION_DIGITS, formatMoney, type KnownCurrency } from '@hisabche/formatting'

export interface OpenAdvancesFigures {
  openAdvances?: { customer: Record<string, number>; supplier: Record<string, number> } | undefined
  openAdvancesUnread?: boolean | undefined
}

function side(amounts: Record<string, number>, locale: string, none: string): string {
  const parts = Object.entries(amounts)
    .filter(([, minor]) => minor > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, minor]) =>
      code in FRACTION_DIGITS
        ? formatMoney(
            minor / 10 ** FRACTION_DIGITS[code as KnownCurrency],
            code as KnownCurrency,
            locale,
          )
        : `${minor} ${code}`,
    )
  return parts.length > 0 ? parts.join(' · ') : none
}

export function openAdvancesText(
  kpis: OpenAdvancesFigures | null | undefined,
  locale: string,
  none: string,
): string | null | undefined {
  if (!kpis) return undefined
  if (kpis.openAdvancesUnread) return null
  if (!kpis.openAdvances) return undefined
  return `${side(kpis.openAdvances.customer, locale, none)} / ${side(kpis.openAdvances.supplier, locale, none)}`
}
