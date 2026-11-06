// ============================================
// packages/store/src/slices/__tests__/guide-store.test.ts
// Unit Tests for Guide Progress Store
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { useGuideStore, GUIDE_VERSION } from '../guide.slice'

describe('useGuideStore', () => {
  beforeEach(() => {
    useGuideStore.getState().resetProgress()
  })

  it('initializes with default version and empty progress', () => {
    const state = useGuideStore.getState()
    expect(state.version).toBe(GUIDE_VERSION)
    expect(state.completedSteps).toEqual({})
    expect(state.activeStepId).toBeNull()
    expect(state.dismissedForSession).toBe(false)
  })

  it('marks a step as seen with timestamp and routeId', () => {
    useGuideStore.getState().markStepSeen('invoice-intro', 'invoices')
    const state = useGuideStore.getState()
    expect(state.isStepSeen('invoice-intro')).toBe(true)
    expect(state.completedSteps['invoice-intro']?.routeId).toBe('invoices')
    expect(state.completedSteps['invoice-intro']?.seen).toBe(true)
  })

  it('performs set-union merge without dropping local seen steps', () => {
    useGuideStore.getState().markStepSeen('step-1', 'dashboard')

    useGuideStore.getState().mergeRemoteProgress({
      'step-2': {
        stepId: 'step-2',
        routeId: 'invoices',
        seen: true,
        completedAt: new Date().toISOString(),
      },
    })

    const state = useGuideStore.getState()
    expect(state.isStepSeen('step-1')).toBe(true)
    expect(state.isStepSeen('step-2')).toBe(true)
  })

  it('re-reads one page without forgetting the others', () => {
    const store = useGuideStore.getState()
    store.markStepSeen('dashboard-1', 'dashboard')
    store.markStepSeen('dashboard-2', 'dashboard')
    store.markStepSeen('invoices-1', 'invoices')

    useGuideStore.getState().resetRouteProgress('dashboard')

    const state = useGuideStore.getState()
    expect(state.isStepSeen('dashboard-1')).toBe(false)
    expect(state.isStepSeen('dashboard-2')).toBe(false)
    expect(state.isStepSeen('invoices-1')).toBe(true)
  })
})
