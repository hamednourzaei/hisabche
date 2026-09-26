// A count on a badge: `999`, then `1.3k`, `12k`, `1.2M`.
//
// ⚠️ ROUNDED DOWN, never up. A badge that says `1k` for 999 claims a thousand
// that is not there; `999,999` must not become `1000k`. The digits follow the
// reader's language (resolveIntlLocale); the k / M suffix is the same in all
// three, as the owner asked («1.3k»).

import { resolveIntlLocale, type UiLanguage } from './locale'

const floor1 = (n: number) => Math.floor(n * 10) / 10

export function formatCompactCount(count: number, lang: UiLanguage): string {
  const nf = new Intl.NumberFormat(resolveIntlLocale(lang), { maximumFractionDigits: 1 })
  const n = Math.max(0, Math.floor(count))
  if (n < 1000) return nf.format(n)
  if (n < 1_000_000) return `${nf.format(floor1(n / 1000))}k`
  return `${nf.format(floor1(n / 1_000_000))}M`
}
