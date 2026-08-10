// ============================================
// A shared invoice link is the product's main distribution channel — it goes
// into WhatsApp and is opened by someone who has no account. The link a phone
// sends and the link a browser copies must be the same URL, and the message
// wrapped around it must be the same words.
// ============================================

import { describe, expect, it } from 'vitest'

import { buildInvoiceShareMessage, buildInvoiceShareUrl, urlLangFromLocale } from '../share-links'

const t = (_key: string, fallback?: string) => fallback ?? _key

describe('urlLangFromLocale', () => {
  it.each([
    ['fa-AF', 'af'],
    ['fa-IR', 'fa'],
    ['fa', 'fa'],
    ['en', 'en'],
    ['de', 'en'],
  ])('maps %s to the %s route segment', (locale, segment) => {
    expect(urlLangFromLocale(locale)).toBe(segment)
  })

  it('does not collapse Dari into Iranian Persian', () => {
    // They have separate catalogs; a Dari user must not land on the fa route.
    expect(urlLangFromLocale('fa-AF')).not.toBe(urlLangFromLocale('fa-IR'))
  })
})

describe('buildInvoiceShareUrl', () => {
  it('prefers the public route, which opens without signing in', () => {
    expect(buildInvoiceShareUrl('https://hisabche.com', 'fa-AF', 'inv-1', 'tok-9')).toBe(
      'https://hisabche.com/af/public-invoice/tok-9',
    )
  })

  it('falls back to the authenticated route when there is no public token', () => {
    // Invoices created before the public-token migration have none; a link that
    // asks the recipient to log in still beats no link.
    expect(buildInvoiceShareUrl('https://hisabche.com', 'fa-IR', 'inv-1', null)).toBe(
      'https://hisabche.com/fa/invoices/inv-1',
    )
  })

  it('returns null when there is nothing to link to', () => {
    expect(buildInvoiceShareUrl('https://hisabche.com', 'en')).toBeNull()
  })

  it('does not double the slash when the origin has a trailing one', () => {
    expect(buildInvoiceShareUrl('https://hisabche.com/', 'en', 'inv-1')).toBe(
      'https://hisabche.com/en/invoices/inv-1',
    )
  })

  it('builds the same URL for the same invoice regardless of caller', () => {
    // Web passes window.location.origin, mobile passes its configured web
    // origin. Given the same origin the result must be byte-identical.
    const web = buildInvoiceShareUrl('https://hisabche.com', 'fa-AF', 'inv-1', 'tok-9')
    const mobile = buildInvoiceShareUrl('https://hisabche.com', 'fa-AF', 'inv-1', 'tok-9')

    expect(web).toBe(mobile)
  })
})

describe('buildInvoiceShareMessage', () => {
  it('includes the number, the total and the link', () => {
    const message = buildInvoiceShareMessage(
      {
        invoiceNumber: 'INV-001',
        formattedTotal: '5,000 ؋',
        shareUrl: 'https://hisabche.com/af/public-invoice/tok-9',
      },
      t,
    )

    expect(message).toBe(
      'فاکتور #INV-001\nمجموع: 5,000 ؋\nhttps://hisabche.com/af/public-invoice/tok-9',
    )
  })

  it('omits the link line entirely when there is no URL', () => {
    // A trailing blank line reads as a broken message in a chat client.
    const message = buildInvoiceShareMessage(
      { invoiceNumber: 'INV-002', formattedTotal: '100 ؋', shareUrl: null },
      t,
    )

    expect(message).toBe('فاکتور #INV-002\nمجموع: 100 ؋')
    expect(message.endsWith('\n')).toBe(false)
  })

  it('never formats money itself', () => {
    // Currency rules live in @hisabche/formatting; this module only concatenates.
    const message = buildInvoiceShareMessage(
      { invoiceNumber: 'INV-003', formattedTotal: 'RAW_TOTAL' },
      t,
    )

    expect(message).toContain('RAW_TOTAL')
  })
})
