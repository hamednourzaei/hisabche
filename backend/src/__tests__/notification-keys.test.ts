import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readBackend = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
const readI18n = (lang: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'packages', 'i18n', 'messages', lang, 'common.json'),
      'utf8',
    ),
  )

describe('invoice and payment notifications carry structured localization keys', () => {
  const invoiceServiceCode = readBackend('services/invoice.service.ts')

  it('invoice creation notification carries title_key, body_key, and params', () => {
    // Locate the invoice creation notification block
    const notifSection = invoiceServiceCode.slice(
      invoiceServiceCode.indexOf('void this.notificationService'),
      invoiceServiceCode.indexOf('.catch((notifError: unknown) =>'),
    )

    expect(notifSection).toContain("title_key: 'notifications.invoiceCreated'")
    expect(notifSection).toContain("body_key: 'notifications.invoiceRegisteredBody'")
    expect(notifSection).toContain('params: { number: invoice.invoice_number }')
  })

  it('invoice payment notification carries title_key, body_key, and params', () => {
    // Locate the payment notification block
    const paymentNotifSection = invoiceServiceCode.slice(
      invoiceServiceCode.indexOf('await this.notificationService.create(workspaceId, {'),
      invoiceServiceCode.indexOf(
        "console.error('[InvoiceService] Failed to create payment notification:'",
      ),
    )

    expect(paymentNotifSection).toContain("title_key: 'notifications.invoicePaid'")
    expect(paymentNotifSection).toContain("body_key: 'notifications.invoicePaidBody'")
    expect(paymentNotifSection).toContain('params: { number: invoice.invoice_number }')
  })

  it('notification keys are defined across en, fa, and af i18n catalogs', () => {
    for (const lang of ['en', 'fa', 'af']) {
      const messages = readI18n(lang)
      expect(messages.notifications).toBeDefined()
      expect(messages.notifications.invoiceCreated).toBeDefined()
      expect(typeof messages.notifications.invoiceCreated).toBe('string')
      expect(messages.notifications.invoiceRegisteredBody).toBeDefined()
      expect(typeof messages.notifications.invoiceRegisteredBody).toBe('string')
      expect(messages.notifications.invoicePaid).toBeDefined()
      expect(typeof messages.notifications.invoicePaid).toBe('string')
      expect(messages.notifications.invoicePaidBody).toBeDefined()
      expect(typeof messages.notifications.invoicePaidBody).toBe('string')
    }
  })
})
