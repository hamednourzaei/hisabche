'use client'

// ============================================
// packages/ui/src/components/ui/wallet/wallet-format.ts
//
// The wallet's two crossings between the server and a person: an integer in
// the currency's MINOR unit shown as money, and a refusal code shown as a
// sentence. Shared by the wallet page and the pay-from-wallet form on billing.
// ============================================

import { apiErrorMessage } from '@hisabche/api'
import {
  FRACTION_DIGITS,
  formatMoney,
  resolveIntlLocale,
  type KnownCurrency,
} from '@hisabche/formatting'

import { parseAmountMinor } from '../../../lib/bank-statement-csv'

function isKnown(currency: string): currency is KnownCurrency {
  return Object.prototype.hasOwnProperty.call(FRACTION_DIGITS, currency)
}

/** Digits after the point for a currency; null when the product does not know it. */
export function walletDigits(currency: string): 0 | 2 | 3 | null {
  return isKnown(currency) ? FRACTION_DIGITS[currency] : null
}

/**
 * Minor units → «1,250.00 $». A code the product cannot format is shown as
 * the raw minor figure with its code, never under another currency's rules.
 */
export function walletMoney(minor: number, currency: string, lang: string): string {
  if (!isKnown(currency)) return `${minor} ${currency}`
  return formatMoney(minor / 10 ** FRACTION_DIGITS[currency], currency, resolveIntlLocale(lang))
}

/**
 * What a person typed («1,250.5», «۱۲۵۰») → minor units of this currency, or
 * null. Parsed as text, never through a float; more decimals than the
 * currency has is refused rather than rounded.
 */
export function walletAmountToMinor(text: string, currency: string): number | null {
  const digits = walletDigits(currency)
  return digits === null ? null : parseAmountMinor(text, digits)
}

/** Every refusal the wallet routes can answer with (wallet.service.ts). */
export const WALLET_ERROR_CODES = [
  'WALLET_INSUFFICIENT_FUNDS',
  'WALLET_CURRENCY_MISMATCH',
  'WALLET_PLAN_NOT_PRICED',
  'WALLET_TOPUP_DUPLICATE_REFERENCE',
  'WALLET_TOPUP_NOT_PENDING',
  'WALLET_TOPUP_NOT_FOUND',
  'WALLET_METHOD_UNAVAILABLE',
  'WALLET_CARD_LAST4_REQUIRED',
  'WALLET_PAID_AT_IN_FUTURE',
  'WALLET_NOTE_REQUIRED',
  'WALLET_AMOUNT_INVALID',
  'WALLET_CURRENCY_INVALID',
  'WALLET_RECEIPT_EMPTY',
  'WALLET_RECEIPT_TOO_LARGE',
  'WALLET_RECEIPT_TYPE',
  'WALLET_NOT_CONFIGURED',
  'SUBSCRIPTION_ALREADY_ACTIVE',
  'UPGRADE_REQUEST_PENDING',
] as const

/** A refusal in words: a known code is translated, anything else shown as sent. */
export function walletErrorText(error: unknown, t: (key: string) => string): string {
  const message = apiErrorMessage(error, t('wallet.errors.generic'))
  const code = WALLET_ERROR_CODES.find((c) => message.startsWith(c))
  return code ? t(`wallet.errors.${code}`) : message
}

/** The HTTP status of a failed request, when there was one. */
export function statusOf(error: unknown): number | null {
  const e = error as { status?: unknown; response?: { status?: unknown } } | null
  const status = e?.status ?? e?.response?.status
  return typeof status === 'number' ? status : null
}

/** A file's bytes as base64 (no data: prefix). The server sniffs the type. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}
