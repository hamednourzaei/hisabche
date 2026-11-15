// ============================================
// The global rate limit: a session gets room for a working day, the key stays the address.
//
// The limit runs before authentication, so its bucket is the client IP. One dashboard load is
// ~33 calls; at 100 a minute three page views answered 429 to a signed-in person — and every
// colleague behind the same connection shared it.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
const block = source.slice(
  source.indexOf('// ─── 6.4 RATE LIMIT'),
  source.indexOf('errorResponseBuilder'),
)

describe('rate limit budgets', () => {
  it('a session gets 300 a minute, anonymous traffic 100, API keys their own', () => {
    expect(source).toContain('const SIGNED_IN_RATE_LIMIT_PER_MINUTE = 300')
    expect(source).toContain('const ANONYMOUS_RATE_LIMIT_PER_MINUTE = 100')
    expect(block).toContain('? API_KEY_RATE_LIMIT_PER_MINUTE')
    expect(block).toContain('? SIGNED_IN_RATE_LIMIT_PER_MINUTE')
    expect(block).toContain(': ANONYMOUS_RATE_LIMIT_PER_MINUTE')
  })

  it('the bucket is still the address, so a made-up token cannot mint a fresh one', () => {
    expect(block).toContain(
      "rateLimitBucket(request.headers.authorization, userId || request.ip || 'anonymous')",
    )
  })
})
