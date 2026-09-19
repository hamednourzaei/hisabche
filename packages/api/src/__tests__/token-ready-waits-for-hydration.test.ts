// Request #97 — the 401 storm on every page load.
//
// `registerTokenGetter()` used to resolve `tokenReady` as a side effect, and
// the store calls it at module import — before zustand-persist has read the
// session back out of storage. So the first requests of a page load went out
// with no Authorization header, took a 401, and were only rescued by the
// response interceptor's refresh-and-retry. The app worked; the console filled
// with 401s on /notifications, /accounting/accounts, /invoices …
//
// Readiness must mean «hydration finished», which only the store can say.
import { beforeEach, describe, expect, it, vi } from 'vitest'

async function freshProvider() {
  vi.resetModules()
  return import('../lib/tokenProvider')
}

/** Has the promise settled by now? Resolves false rather than hanging. */
const settled = (p: Promise<unknown>) =>
  Promise.race([p.then(() => true), Promise.resolve().then(() => false)])

describe('tokenReady means the session is hydrated', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('registering the getter does NOT release waiting requests', async () => {
    const provider = await freshProvider()

    provider.registerTokenGetter(() => null)

    expect(provider.isTokenProviderReady()).toBe(false)
    await expect(settled(provider.tokenReady)).resolves.toBe(false)
  })

  it('markTokenReady releases them', async () => {
    const provider = await freshProvider()
    provider.registerTokenGetter(() => 'token-from-storage')

    provider.markTokenReady()

    expect(provider.isTokenProviderReady()).toBe(true)
    await expect(settled(provider.tokenReady)).resolves.toBe(true)
    // And the token the waiter was waiting FOR is the hydrated one.
    expect(provider.getToken()).toBe('token-from-storage')
  })

  it('is idempotent — a second call cannot throw or re-arm', async () => {
    const provider = await freshProvider()
    provider.markTokenReady()
    expect(() => provider.markTokenReady()).not.toThrow()
    expect(provider.isTokenProviderReady()).toBe(true)
  })

  it('a signed-out visitor is released too, not left on the timeout', async () => {
    // zustand runs onRehydrateStorage for an empty store as well, so the
    // store calls markTokenReady() with no token. Waiting requests must go
    // out immediately (and get a legitimate 401) rather than stall 2s first.
    const provider = await freshProvider()
    provider.registerTokenGetter(() => null)
    provider.markTokenReady()

    await expect(settled(provider.tokenReady)).resolves.toBe(true)
    expect(provider.getToken()).toBeNull()
  })
})

describe('every app that registers a getter also declares readiness', () => {
  // A renderer that registers but never marks ready would make EVERY request
  // pay the waitForTokenReady() timeout. Four stores wire this client up.
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const root = join(__dirname, '..', '..', '..', '..')

  it.each([
    ['packages/store/src/slices/auth.slice.ts'],
    ['apps/desktop/src/features/auth/auth.store.ts'],
    ['apps/mobile/src/features/auth/auth.store.ts'],
    ['apps/admin/lib/admin-api-token.ts'],
  ])('%s calls markTokenReady', (file) => {
    const src = readFileSync(join(root, file), 'utf8')
    expect(src).toContain('registerTokenGetter')
    expect(src).toContain('markTokenReady()')
  })
})
