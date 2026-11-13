// ============================================
// `useAuthReady` must render the same value on the server and on the first
// client render.
//
// It seeded state with `isTokenProviderReady()` during render: `false` on the
// server (no provider), `true` in the browser. Every query gated on it was
// disabled in the server HTML (empty state) and enabled in the first client
// render (skeleton) — React #418 on /manufacturing and every page like it.
//
// 13 Nov 2026: the hook became a `useSyncExternalStore` read (the lint rule
// against setState-in-effect). The guard checks the BEHAVIOUR now, not the
// source: rendered on the server with the provider already ready, it says false.
// ============================================

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/tokenProvider', () => ({
  isTokenProviderReady: () => true,
  tokenReady: Promise.resolve(),
}))

const { useAuthReady } = await import('../hooks/useAuthReady')

function Probe() {
  return createElement('span', null, String(useAuthReady()))
}

describe('useAuthReady hydration', () => {
  it('is false in the server render even when the provider is ready', () => {
    expect(renderToString(createElement(Probe))).toBe('<span>false</span>')
  })
})
