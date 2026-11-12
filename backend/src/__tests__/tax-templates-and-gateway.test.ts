import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { aggregateTaxReportByCurrencyAndComponent } from '@hisabche/validation'
import { verifyGatewayHmacSignature } from '../services/payments/customer-gateway.service'

describe('B.2.11 & B.2.12 Tax report + Customer payment gateway', () => {
  it('aggregates output/input/net tax per component and currency and subtracts returns', () => {
    const report = aggregateTaxReportByCurrencyAndComponent([
      {
        direction: 'output',
        isReturn: false,
        currency: 'AFN',
        componentCode: 'BRT',
        taxAmountMinor: 1000,
      },
      {
        direction: 'output',
        isReturn: true,
        currency: 'AFN',
        componentCode: 'BRT',
        taxAmountMinor: 200,
      },
      {
        direction: 'input',
        isReturn: false,
        currency: 'AFN',
        componentCode: 'BRT',
        taxAmountMinor: 300,
      },
      {
        direction: 'output',
        isReturn: false,
        currency: 'USD',
        componentCode: 'VAT',
        taxAmountMinor: 500,
      },
    ])
    const afn = report.find((r) => r.currency === 'AFN' && r.componentCode === 'BRT')
    const usd = report.find((r) => r.currency === 'USD' && r.componentCode === 'VAT')
    expect(afn).toEqual({
      currency: 'AFN',
      componentCode: 'BRT',
      outputTaxMinor: 800,
      inputTaxMinor: 300,
      netTaxMinor: 500,
    })
    expect(usd?.netTaxMinor).toBe(500)
  })

  it('rejects bad HMAC signature and accepts valid HMAC signature', () => {
    const raw = JSON.stringify({ eventId: 'evt-1', amountMinor: 5000 })
    const secret = 'test-gateway-secret'
    const sig = createHmac('sha256', secret).update(raw).digest('hex')
    expect(verifyGatewayHmacSignature(raw, sig, secret)).toBe(true)
    expect(verifyGatewayHmacSignature(raw, 'deadbeef', secret)).toBe(false)
  })
})
