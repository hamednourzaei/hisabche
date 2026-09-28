// ============================================
// packages/ui/src/lib/oauth-labels.ts
//
// Words for what the OAuth and marketplace services return. Every list is
// CLOSED: the values come from the server, and t() throws on a key that does
// not exist — an unknown value is shown as itself, never looked up.
// ============================================

import {
  APP_CATEGORIES,
  APP_HEALTH_LEVELS,
  APP_RISK_FLAGS,
  APP_VERSION_STATUSES,
  OAUTH_APP_STATUSES,
  OAUTH_ERROR_CODES,
  type AppPricing,
} from '@hisabche/validation'
import { apiErrorMessage } from '@hisabche/api'
import {
  fractionDigits,
  formatMoney,
  resolveIntlLocale,
  type KnownCurrency,
} from '@hisabche/formatting'

type T = (key: string) => string

const closed =
  (list: readonly string[], prefix: string) =>
  (t: T, value: string | null | undefined): string =>
    value && list.includes(value) ? t(`${prefix}.${value}`) : (value ?? '')

export const oauthStatusLabel = closed(OAUTH_APP_STATUSES, 'oauth.status')
export const appVersionStatusLabel = closed(APP_VERSION_STATUSES, 'oauth.versionStatus')
export const appCategoryLabel = closed(APP_CATEGORIES, 'oauth.category')
export const appHealthLabel = closed(APP_HEALTH_LEVELS, 'oauth.health')
export const appRiskFlagLabel = closed(APP_RISK_FLAGS, 'oauth.risk')

/** The sentence for a refusal: the shared one if the code is known, else what the server wrote. */
export function oauthErrorMessage(t: T, error: unknown, fallback: string): string {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' && (OAUTH_ERROR_CODES as readonly string[]).includes(code)
    ? t(`oauth.error.${code}`)
    : apiErrorMessage(error, fallback)
}

/** «Free», or the price as the publisher disclosed it — from minor units, in the reader's language. */
export function appPriceLabel(t: T, pricing: AppPricing, lang: string): string {
  if (pricing.model === 'free') return t('oauth.pricing.free')
  const currency = pricing.currency as KnownCurrency
  const amount = formatMoney(
    pricing.priceMinor / 10 ** fractionDigits(currency),
    currency,
    resolveIntlLocale(lang),
  )
  return `${amount} ${t(`oauth.pricing.per.${pricing.interval}`)}`
}
