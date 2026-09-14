import { readFileSync } from 'fs'
import { join } from 'path'

jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn() }))
jest.mock('@hisabche/api', () => ({
  useCreateInvoice: jest.fn(),
  invoiceKeys: { all: ['invoices'] },
}))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: jest.fn() }))

import { isRetryableFailure } from '../hooks/use-create-invoice'

const source = readFileSync(join(__dirname, '../hooks/use-create-invoice.ts'), 'utf8').replace(
  /\/\/.*$/gm,
  '',
)

describe('offline invoice submit — one id per sale', () => {
  it('the online attempt and the outbox fallback share ONE client id', () => {
    expect(source.match(/newClientId\(\)/g)).toHaveLength(2) // definition + one call
    expect(source).toContain('idempotencyKey: clientId')
    expect(source.match(/enqueue\(\{ clientId, kind: 'invoice\.create'/g)).toHaveLength(2)
  })

  it('only unanswered / server-fault failures are queued', () => {
    expect(isRetryableFailure(new Error('Network Error'))).toBe(true)
    expect(isRetryableFailure({ status: 500 })).toBe(true)
    expect(isRetryableFailure({ status: 503 })).toBe(true)
    expect(isRetryableFailure({ status: 408 })).toBe(true)
    expect(isRetryableFailure({ status: 429 })).toBe(true)
    expect(isRetryableFailure({ status: 400 })).toBe(false)
    expect(isRetryableFailure({ status: 403 })).toBe(false)
    expect(isRetryableFailure({ status: 422 })).toBe(false)
  })
})
