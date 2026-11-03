import { describe, expect, it } from 'vitest'

import {
  CREDIT_OVERRIDE_MIN_REASON,
  creditStopFrom,
  isCreditOverrideForbidden,
} from '../components/ui/invoice-builder/credit-override-panel'

describe('credit override panel', () => {
  it('reads the over-limit refusal the server sends', () => {
    expect(creditStopFrom('CREDIT_LIMIT_EXCEEDED: over by 100')).toEqual({
      code: 'CREDIT_LIMIT_EXCEEDED',
      overBy: '100',
    })
    expect(creditStopFrom('CASH_ONLY_CUSTOMER: over by 12.5')).toEqual({
      code: 'CASH_ONLY_CUSTOMER',
      overBy: '12.5',
    })
  })

  it('does not take any other failure for a credit refusal', () => {
    expect(creditStopFrom('INVOICE_EXCHANGE_RATE_REQUIRED')).toBeNull()
    expect(creditStopFrom('')).toBeNull()
  })

  it('knows when the permission itself was refused', () => {
    expect(isCreditOverrideForbidden('CREDIT_OVERRIDE_FORBIDDEN')).toBe(true)
    expect(isCreditOverrideForbidden('CREDIT_LIMIT_EXCEEDED: over by 1')).toBe(false)
  })

  it('asks for at least the reason length the server enforces', () => {
    expect(CREDIT_OVERRIDE_MIN_REASON).toBe(3)
  })
})

describe('the preview sends the override only with a reason', () => {
  it('wires the reason into the request body and the refusal into the panel', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(
      join(__dirname, '../components/ui/invoice-builder/containers/invoice-preview-container.tsx'),
      'utf8',
    )
      .split(/\s+/)
      .join(' ')
    expect(source).toContain('creditStop && creditReason.trim()')
    expect(source).toContain('{ creditOverride: { reason: creditReason.trim() } }')
    expect(source).toContain('<CreditOverridePanel')
  })
})
