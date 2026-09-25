// ============================================
// A request never leaves with a token that has already expired.
//
// Supabase's auth log: ~36 `GET /user` → 403 "token is expired" in 13 seconds.
// Each request of a page went out with the stale token and was refused before
// one refresh happened. The interceptor now renews first.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isExpiring } from '../lib/client'

const jwt = (claims: object) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_')}.s`
const now = Date.UTC(2026, 8, 26, 0, 24, 30)

describe('isExpiring', () => {
  it('an expired token is expiring', () => {
    expect(isExpiring(jwt({ exp: now / 1000 - 60 }), now)).toBe(true)
  })
  it('a token with under 30 seconds left is expiring', () => {
    expect(isExpiring(jwt({ exp: now / 1000 + 10 }), now)).toBe(true)
  })
  it('a fresh token is not', () => {
    expect(isExpiring(jwt({ exp: now / 1000 + 3600 }), now)).toBe(false)
  })
  it('no readable exp is not an answer', () => {
    expect(isExpiring('opaque', now)).toBe(false)
    expect(isExpiring(jwt({ sub: 'u' }), now)).toBe(false)
  })
})

describe('the interceptor renews before it sends', () => {
  it('checks expiry and awaits the single-flight refresh', () => {
    const src = readFileSync(join(__dirname, '..', 'lib', 'client.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src).toContain('isExpiring(current)')
    expect(src).toContain('await refreshOnce()')
  })
})
