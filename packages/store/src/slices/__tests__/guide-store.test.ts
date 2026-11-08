// ============================================
// packages/store/src/slices/__tests__/guide-store.test.ts
// Unit Tests for Guide Progress Store
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { useGuideStore, GUIDE_VERSION } from '../guide.slice'

describe('useGuideStore', () => {
  beforeEach(() => {
    useGuideStore.setState({ ownerId: null })
    useGuideStore.getState().resetProgress()
  })

  it('initializes with default version and empty progress', () => {
    const state = useGuideStore.getState()
    expect(state.version).toBe(GUIDE_VERSION)
    expect(state.completedSteps).toEqual({})
    expect(state.activeStepId).toBeNull()
    expect(state.replayRoute).toBeNull()
  })

  it('marks a step as seen with timestamp and routeId', () => {
    useGuideStore.getState().markStepSeen('invoice-intro', 'invoices')
    const state = useGuideStore.getState()
    expect(state.isStepSeen('invoice-intro')).toBe(true)
    expect(state.completedSteps['invoice-intro']?.routeId).toBe('invoices')
    expect(state.completedSteps['invoice-intro']?.seen).toBe(true)
  })

  it('marks several steps at once (closing a page guide) and keeps the first time', () => {
    const store = useGuideStore.getState()
    store.markStepSeen('a', 'invoices')
    const first = useGuideStore.getState().completedSteps.a?.completedAt
    useGuideStore.getState().markStepsSeen([
      { stepId: 'a', routeId: 'invoices' },
      { stepId: 'b', routeId: 'invoices' },
    ])
    const state = useGuideStore.getState()
    expect(state.isStepSeen('b')).toBe(true)
    expect(state.completedSteps.a?.completedAt).toBe(first)
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

  it('⚠️ another person on the same browser starts with an empty copy', () => {
    useGuideStore.getState().bindOwner('person-a')
    useGuideStore.getState().markStepSeen('dashboard-1', 'dashboard')
    useGuideStore.getState().bindOwner('person-a')
    expect(useGuideStore.getState().isStepSeen('dashboard-1')).toBe(true)

    useGuideStore.getState().bindOwner('person-b')
    expect(useGuideStore.getState().isStepSeen('dashboard-1')).toBe(false)
  })

  it('reading a page again forgets nothing', () => {
    const store = useGuideStore.getState()
    store.markStepSeen('dashboard-1', 'dashboard')
    store.startReplay('dashboard')
    useGuideStore.getState().advanceReplay('dashboard-1')
    let state = useGuideStore.getState()
    expect(state.replayRoute).toBe('dashboard')
    expect(state.replaySeen).toEqual(['dashboard-1'])
    expect(state.isStepSeen('dashboard-1')).toBe(true)

    state.endReplay()
    state = useGuideStore.getState()
    expect(state.replayRoute).toBeNull()
    expect(state.isStepSeen('dashboard-1')).toBe(true)
  })
})
