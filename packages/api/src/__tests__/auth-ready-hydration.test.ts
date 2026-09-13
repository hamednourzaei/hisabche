// ============================================
// `useAuthReady` must render the same value on the server and on the first
// client render.
//
// It seeded state with `isTokenProviderReady()` during render: `false` on the
// server (no provider), `true` in the browser. Every query gated on it was
// disabled in the server HTML (empty state) and enabled in the first client
// render (skeleton) — React #418 on /manufacturing and every page like it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'hooks', 'useAuthReady.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '')

describe('useAuthReady hydration', () => {
  it('initial state is a constant, not a render-time read', () => {
    expect(source).toContain('useState<boolean>(false)')
    expect(source).not.toContain('useState<boolean>(() => isTokenProviderReady())')
  })

  it('reads the token provider only inside the effect', () => {
    const effectAt = source.indexOf('useEffect(')
    const readAt = source.indexOf('isTokenProviderReady()')
    expect(effectAt).toBeGreaterThan(-1)
    expect(readAt).toBeGreaterThan(effectAt)
  })
})
