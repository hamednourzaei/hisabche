import { describe, expect, it } from 'vitest'
import { allConnectors, connector } from '../services/connectors/connector.domain'

describe('Connector Domain Extensions', () => {
  it('includes moodian, payment_gateway, bank_statement, and shipping_courier adapters', () => {
    const ids = allConnectors().map((c) => c.id)
    expect(ids).toContain('moodian')
    expect(ids).toContain('payment_gateway')
    expect(ids).toContain('bank_statement')
    expect(ids).toContain('shipping_courier')
  })

  it('moodian connector has correct direction and label', () => {
    const moodian = connector('moodian')
    expect(moodian).not.toBeNull()
    expect(moodian?.labelKey).toBe('connectors.moodian')
    expect(moodian?.direction).toBe('push')
    expect(moodian?.signsPayloads).toBe(true)
  })

  it('payment_gateway connector requires signing payloads', () => {
    const pg = connector('payment_gateway')
    expect(pg).not.toBeNull()
    expect(pg?.signsPayloads).toBe(true)
  })
})
