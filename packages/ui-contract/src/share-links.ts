// ============================================
// Shareable links.
//
// A shared invoice link is the product's main distribution channel — it goes
// into WhatsApp and gets opened by someone who has no account. The link a phone
// sends and the link the browser copies must therefore be the same URL, or the
// two platforms hand customers different things.
//
// The origin is a parameter rather than read from `window`, which is what lets
// React Native build the same URL: web passes `window.location.origin`, mobile
// passes its configured web origin.
// ============================================

/** URL language segment. The app's locales are `fa-IR | fa-AF | en`; the routes are `fa | af | en`. */
export function urlLangFromLocale(locale: string): string {
  if (locale.startsWith('fa-AF')) return 'af'
  if (locale.startsWith('fa')) return 'fa'
  return 'en'
}

/**
 * Link to an invoice.
 *
 * Prefers the public route, which opens without signing in — that is the point
 * of sharing. Falls back to the authenticated route when an invoice has no
 * `publicToken` yet, in which case the recipient is asked to log in; that is
 * the pre-existing behaviour for invoices created before the token column.
 *
 * Returns `null` when there is nothing to link to, so callers disable the
 * control rather than sharing a broken URL.
 */
export function buildInvoiceShareUrl(
  origin: string,
  locale: string,
  invoiceId?: string | null,
  publicToken?: string | null,
): string | null {
  const lang = urlLangFromLocale(locale)
  const base = origin.replace(/\/$/, '')

  if (publicToken) return `${base}/${lang}/public-invoice/${publicToken}`
  if (invoiceId) return `${base}/${lang}/invoices/${invoiceId}`
  return null
}

export interface InvoiceShareSummary {
  invoiceNumber: string
  /** Already formatted for display — this module never formats money. */
  formattedTotal: string
  shareUrl?: string | null
}

/**
 * The text that goes into WhatsApp.
 *
 * Shared because it is the message a customer receives: a phone and a browser
 * sending "the same invoice" must not produce two differently worded messages.
 * Money arrives pre-formatted so currency rules stay in `@hisabche/formatting`.
 */
export function buildInvoiceShareMessage(
  summary: InvoiceShareSummary,
  t: (key: string, fallback?: string) => string,
): string {
  const lines = [
    `${t('invoices.title', 'فاکتور')} #${summary.invoiceNumber}`,
    `${t('invoices.total', 'مجموع')}: ${summary.formattedTotal}`,
  ]

  if (summary.shareUrl) lines.push(summary.shareUrl)

  return lines.join('\n')
}
