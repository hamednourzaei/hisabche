// ============================================
// Whose wizard is it?
//
// The onboarding store is persisted in localStorage. Signing out cleared the
// auth, workspace and token stores but never this one, and the dashboard gate
// read `isCompleted` from it. A second account created in the same browser
// therefore inherited «completed» from the first, the wizard never opened, and
// its workspace kept the default currency and no industry.
//
// The fix is ownership: the answers belong to the account that made them.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  const { useOnboardingStore } = await import('../onboarding.slice')
  return useOnboardingStore
}

beforeEach(() => {
  localStorage.removeItem('hisabche-onboarding')
})

describe('the persisted wizard belongs to one account', () => {
  it('⚠️ a second account does NOT inherit «completed»', async () => {
    const store = await freshStore()

    store.getState().claimForUser('account-a')
    store.getState().setDefaultCurrency('XAU')
    store.getState().completeOnboarding()
    expect(store.getState().isCompleted).toBe(true)

    store.getState().claimForUser('account-b')

    expect(store.getState().isCompleted).toBe(false)
    expect(store.getState().step).toBe(0)
    // And not the previous person's money either.
    expect(store.getState().defaultCurrency).toBe('')
  })

  it('the same account keeps its answers', async () => {
    const store = await freshStore()

    store.getState().claimForUser('account-a')
    store.getState().setDefaultCurrency('USD')
    store.getState().completeOnboarding()
    store.getState().claimForUser('account-a')

    expect(store.getState().isCompleted).toBe(true)
    expect(store.getState().defaultCurrency).toBe('USD')
  })

  it('a reset clears the answers but keeps the owner', async () => {
    const store = await freshStore()

    store.getState().claimForUser('account-a')
    store.getState().setDefaultCurrency('USD')
    store.getState().reset()

    expect(store.getState().defaultCurrency).toBe('')
    // Re-claiming cannot mistake this for another person and wipe a half-filled
    // wizard on the next reload.
    store.getState().setDefaultCurrency('XAU')
    store.getState().claimForUser('account-a')
    expect(store.getState().defaultCurrency).toBe('XAU')
  })
})
