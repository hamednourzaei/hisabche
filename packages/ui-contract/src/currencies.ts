// ============================================
// Currencies and precious metals offered during onboarding.
//
// The step used to show four fixed cards. Two stay as cards — the two that
// matter for the reader's own language — and everything else moves into the same
// searchable list the business-type step uses.
//
// Metals sit alongside currencies on purpose: a gold trader keeps books in
// grams, and the "default currency" question is really "what unit do you price
// in". Codes follow ISO 4217, including the X-prefixed metal codes (XAU gold,
// XAG silver), so nothing here is invented.
// ============================================

/**
 * The currency Hisabche's OWN subscription plans are priced in.
 *
 * This is a billing fact, not a user preference: it is the currency the
 * business quotes and collects in, and it is the same for every visitor,
 * including anonymous ones who have not chosen anything. It is declared here
 * so the landing pricing table and the schema.org `Offer` in
 * `apps/web/app/[lang]/page.tsx` cannot drift apart — they already had, with
 * the page rendering افغانی while the structured data said USD.
 *
 * Changing it means changing what the business charges. Do NOT convert plan
 * prices into a visitor's currency: no exchange-rate source exists, and a
 * converted figure would be a price the business never set.
 */
export const BILLING_CURRENCY = 'AFN'

export interface CurrencyOption {
  code: string
  labelKey: string
  labelFa: string
  /** Flag or symbol shown before the label. */
  flag: string
}

/**
 * The two shown above the search box, per interface language.
 *
 * Persian readers price in تومان first, Dari readers in افغانی; the dollar is
 * second in both because it is the common reference. Anything else is found by
 * searching.
 */
export function primaryCurrencies(lang: string): readonly CurrencyOption[] {
  const usd: CurrencyOption = { code: 'USD', labelKey: 'currency.usd', labelFa: 'دالر', flag: '🇺🇸' }

  if (lang === 'af' || lang === 'fa-AF') {
    return [{ code: 'AFN', labelKey: 'currency.afn', labelFa: 'افغانی', flag: '🇦🇫' }, usd]
  }

  // fa (and anything else) leads with the toman.
  return [{ code: 'IRT', labelKey: 'currency.irt', labelFa: 'تومان', flag: '🇮🇷' }, usd]
}

/** Everything selectable, including the primaries so search can still find them. */
export const CURRENCIES: readonly CurrencyOption[] = [
  // ─── Region ───
  { code: 'AFN', labelKey: 'currency.afn', labelFa: 'افغانی', flag: '🇦🇫' },
  { code: 'IRT', labelKey: 'currency.irt', labelFa: 'تومان', flag: '🇮🇷' },
  { code: 'IRR', labelKey: 'currency.irr', labelFa: 'ریال ایران', flag: '🇮🇷' },
  { code: 'PKR', labelKey: 'currency.pkr', labelFa: 'روپیه پاکستان', flag: '🇵🇰' },
  { code: 'INR', labelKey: 'currency.inr', labelFa: 'روپیه هند', flag: '🇮🇳' },
  { code: 'TRY', labelKey: 'currency.try', labelFa: 'لیر ترکیه', flag: '🇹🇷' },
  { code: 'AED', labelKey: 'currency.aed', labelFa: 'درهم امارات', flag: '🇦🇪' },
  { code: 'SAR', labelKey: 'currency.sar', labelFa: 'ریال سعودی', flag: '🇸🇦' },
  { code: 'IQD', labelKey: 'currency.iqd', labelFa: 'دینار عراق', flag: '🇮🇶' },
  { code: 'TJS', labelKey: 'currency.tjs', labelFa: 'سامانی تاجیکستان', flag: '🇹🇯' },
  { code: 'UZS', labelKey: 'currency.uzs', labelFa: 'سوم ازبکستان', flag: '🇺🇿' },
  { code: 'TMT', labelKey: 'currency.tmt', labelFa: 'منات ترکمنستان', flag: '🇹🇲' },
  { code: 'CNY', labelKey: 'currency.cny', labelFa: 'یوان چین', flag: '🇨🇳' },
  { code: 'RUB', labelKey: 'currency.rub', labelFa: 'روبل روسیه', flag: '🇷🇺' },

  // ─── Major ───
  { code: 'USD', labelKey: 'currency.usd', labelFa: 'دالر', flag: '🇺🇸' },
  { code: 'EUR', labelKey: 'currency.eur', labelFa: 'یورو', flag: '🇪🇺' },
  { code: 'GBP', labelKey: 'currency.gbp', labelFa: 'پوند انگلیس', flag: '🇬🇧' },
  { code: 'CHF', labelKey: 'currency.chf', labelFa: 'فرانک سوئیس', flag: '🇨🇭' },
  { code: 'JPY', labelKey: 'currency.jpy', labelFa: 'یِن ژاپن', flag: '🇯🇵' },
  { code: 'CAD', labelKey: 'currency.cad', labelFa: 'دالر کانادا', flag: '🇨🇦' },
  { code: 'AUD', labelKey: 'currency.aud', labelFa: 'دالر استرالیا', flag: '🇦🇺' },

  // ─── Precious metals (ISO 4217 X-codes) ───
  { code: 'XAU', labelKey: 'currency.xau', labelFa: 'طلا', flag: '🥇' },
  { code: 'XAG', labelKey: 'currency.xag', labelFa: 'نقره', flag: '🥈' },
  { code: 'XPT', labelKey: 'currency.xpt', labelFa: 'پلاتین', flag: '⚪' },
  { code: 'XPD', labelKey: 'currency.xpd', labelFa: 'پالادیوم', flag: '⚫' },
]
