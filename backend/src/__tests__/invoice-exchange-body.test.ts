// V60 audit (12 Nov 2026): `POST /api/invoices/:id/exchange` read its body as a TypeScript cast,
// wrote every return as «wrong item», sold the replacement as «cash» with nothing paid, and
// created the replacement invoice without an idempotency key when the client sent none.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { invoiceExchangeSchema } from '@hisabche/validation'

const LINE = '11111111-1111-4111-8111-111111111111'
const base = {
  returnNumber: 'EX-1',
  returnDate: '2026-11-12',
  returnedLines: [{ originalLineId: LINE, quantity: 1, conditionCode: 'sealed' }],
}

describe('the exchange body', () => {
  it('needs at least one returned line, a number and a day', () => {
    expect(invoiceExchangeSchema.safeParse({ ...base, returnedLines: [] }).success).toBe(false)
    expect(invoiceExchangeSchema.safeParse({ ...base, returnNumber: ' ' }).success).toBe(false)
    expect(invoiceExchangeSchema.safeParse({ ...base, returnDate: 'tomorrow' }).success).toBe(false)
  })

  it('an unpaid replacement is credit, and the reason defaults to the return form’s', () => {
    const parsed = invoiceExchangeSchema.parse(base)
    expect(parsed.paymentMethod).toBe('credit')
    expect(parsed.paidAmount).toBe(0)
    expect(parsed.reasonCode).toBe('customer_change_of_mind')
  })

  it('«cash» with nothing paid is refused, not recorded as a cash sale', () => {
    const result = invoiceExchangeSchema.safeParse({ ...base, paymentMethod: 'cash' })
    expect(result.success).toBe(false)
    expect(result.success ? '' : result.error.errors[0]?.message).toBe('EXCHANGE_PAYMENT_UNSTATED')
  })

  it('an unknown condition is refused', () => {
    const lines = [{ originalLineId: LINE, quantity: 1, conditionCode: 'like-new' }]
    expect(invoiceExchangeSchema.safeParse({ ...base, returnedLines: lines }).success).toBe(false)
  })
})

describe('the route', () => {
  const source = readFileSync(join(__dirname, '..', 'routes', 'invoice-return.routes.ts'), 'utf8')
  const exchange = source.slice(source.indexOf("'/api/invoices/:id/exchange'"))
  it('parses the body with the shared schema and keeps the caller’s reason', () => {
    expect(exchange).toContain('invoiceExchangeSchema.safeParse(request.body)')
    expect(exchange).not.toContain("reasonCode: 'wrong_item'")
    expect(exchange).not.toContain("?? 'cash'")
  })
  it('never sells a replacement without a retry key', () => {
    expect(exchange).toContain("throw new ValidationError('IDEMPOTENCY_KEY_REQUIRED')")
    expect(exchange).toContain('idempotencyKey: `${clientRequestId}:exchange-sale`')
  })
})
