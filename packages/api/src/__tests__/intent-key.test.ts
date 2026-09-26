// ============================================
// A retried payment carries the SAME Idempotency-Key, so the server answers it
// with the first result instead of recording a second payment.
//
// Only invoices sent a key before; payments and transactions — which the
// server has long accepted a key for — went out bare, so a response lost to a
// dropped connection and a second tap was a second payment.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// A hook with no React renderer here: useRef/useCallback as their plain meaning.
vi.mock('react', () => ({
  useRef: <T>(v: T) => ({ current: v }),
  useCallback: <T>(fn: T) => fn,
}))

const { useIntentKey, isDefinitiveRefusal } = await import('../lib/intent-key')

describe('useIntentKey', () => {
  it('⚠️ the same intent keeps its key across a network failure and a 5xx', () => {
    const intent = useIntentKey('pay')
    const first = intent.current()
    intent.settle({ code: 'NETWORK_ERROR', status: 500 })
    expect(intent.current()).toBe(first)
    intent.settle({ status: 503 })
    expect(intent.current()).toBe(first)
  })

  it('a new key after success — the next payment is a new payment', () => {
    const intent = useIntentKey('pay')
    const first = intent.current()
    intent.settle()
    expect(intent.current()).not.toBe(first)
  })

  it('a new key after a definitive refusal (4xx) — the corrected form is a new request', () => {
    const intent = useIntentKey('pay')
    const first = intent.current()
    intent.settle({ status: 400 })
    expect(intent.current()).not.toBe(first)
  })

  it('keys match the server pattern', () => {
    expect(useIntentKey('pay').current()).toMatch(/^[A-Za-z0-9_.:-]{8,128}$/)
  })
})

describe('isDefinitiveRefusal', () => {
  it.each([
    [400, true],
    [403, true],
    [422, true],
    [408, false],
    [429, false],
    [500, false],
    [503, false],
  ])('%i → %s', (status, expected) => {
    expect(isDefinitiveRefusal({ status })).toBe(expected)
  })
  it('no status (network) is not definitive', () => {
    expect(isDefinitiveRefusal({ code: 'NETWORK_ERROR' })).toBe(false)
  })
})

describe('the money writes send it', () => {
  const code = (f: string) =>
    readFileSync(join(__dirname, '..', 'hooks', f), 'utf8')
      .split('\r\n')
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it.each(['payments.ts', 'transactions.ts'])('%s', (file) => {
    const src = code(file)
    expect(src).toContain("'Idempotency-Key': intent.current()")
    expect(src).toContain('onError: (error) => intent.settle(error)')
    expect(src).toContain('intent.settle()')
  })
})
