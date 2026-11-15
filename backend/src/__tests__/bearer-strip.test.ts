// ============================================
// The two-step routes strip «Bearer » before using the token.
//
// The expression had lost its backslash — `/^Bearers+/i` matches «Bearer» followed by one or more
// «s», never «Bearer » — so every two-step call forwarded «Bearer <token>» as the token.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'routes', 'auth.routes.ts'), 'utf8')

describe('bearer strip', () => {
  it('uses whitespace, not a literal «s»', () => {
    expect(source).not.toContain('/^Bearers+/')
    expect(source).toContain(".replace(/^Bearer\\s+/i, '')")
  })

  it('the expression really removes the scheme', () => {
    expect('Bearer abc.def'.replace(/^Bearer\s+/i, '')).toBe('abc.def')
  })
})
