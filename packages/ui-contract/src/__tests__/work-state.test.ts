// ============================================
// The one thing the user is told, when several things are true.
//
// These are not tests of a switch statement. Each case is a product decision
// that used to be made four different ways in four components, and the point
// of pinning them here is that changing one is now a visible act.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  WORK_STATES,
  WORK_STATE_PRESENTATION,
  describeWorkState,
  isWorthShowing,
  resolveWorkState,
  statePrecedence,
} from '../work-state'

describe('every state is presentable', () => {
  it.each(WORK_STATES)('%s has a presentation', (state) => {
    expect(WORK_STATE_PRESENTATION[state]).toBeDefined()
  })

  it('never hardcodes text — only i18n keys', () => {
    for (const state of WORK_STATES) {
      expect(WORK_STATE_PRESENTATION[state].labelKey).toMatch(/^state\./)
    }
  })

  it('holds no colour literal, only roles', () => {
    // This package is forbidden from carrying a colour value. A hex here would
    // mean a screen somewhere is painting itself outside the token system.
    const tones = WORK_STATES.map((state) => WORK_STATE_PRESENTATION[state].tone)
    for (const tone of tones) {
      expect(tone).not.toMatch(/#|rgb|hsl/)
    }
  })
})

describe('nothing true means nothing to say', () => {
  it('resolves to ready', () => {
    expect(resolveWorkState({})).toBe('ready')
  })

  it('and ready is not worth showing', () => {
    // A badge reading "fine" on every screen is a badge nobody reads.
    expect(isWorthShowing('ready')).toBe(false)
    expect(isWorthShowing('offline')).toBe(true)
  })
})

describe('precedence — the decisions that used to be made four ways', () => {
  it('a refusal outranks everything', () => {
    expect(
      resolveWorkState({
        isForbidden: true,
        hasError: true,
        conflictCount: 3,
        isOffline: true,
        isSaving: true,
      }),
    ).toBe('forbidden')
  })

  it('a conflict outranks being offline', () => {
    // A conflict is work waiting for a decision. Being offline passes on its
    // own. Telling someone about the condition instead of the decision wastes
    // the one line they read.
    expect(resolveWorkState({ conflictCount: 1, isOffline: true })).toBe('conflict')
  })

  it('being offline outranks a save in flight', () => {
    // "Saving…" while offline is a promise the app cannot keep. The honest
    // message is that the change is held locally.
    expect(resolveWorkState({ isOffline: true, isSaving: true })).toBe('offline')
  })

  it('a background refetch never replaces "saving" with a skeleton', () => {
    // The bug this prevents: a list refetches while the user is mid-edit, the
    // screen blanks to a loading state, and the edit looks lost.
    expect(resolveWorkState({ isSaving: true, isLoading: true })).toBe('saving')
  })

  it('a list that has not loaded is not an empty list', () => {
    // Saying "no customers" before the request returns is a lie the user may
    // act on — by re-adding a customer they already have.
    expect(resolveWorkState({ isLoading: true, isEmpty: true })).toBe('loading')
  })

  it('pending local writes count as syncing even when nothing is in flight', () => {
    expect(resolveWorkState({ pendingCount: 4 })).toBe('syncing')
  })

  it('orders states by how actionable they are', () => {
    expect(statePrecedence('forbidden')).toBeLessThan(statePrecedence('error'))
    expect(statePrecedence('conflict')).toBeLessThan(statePrecedence('offline'))
    expect(statePrecedence('saving')).toBeLessThan(statePrecedence('loading'))
    expect(statePrecedence('ready')).toBe(WORK_STATES.length - 1)
  })
})

describe('what blocks the screen and what does not', () => {
  it('a conflict does not blank the page', () => {
    // The books are still readable; one record needs a decision. Hiding
    // everything makes a small problem look like an outage.
    expect(WORK_STATE_PRESENTATION.conflict.blocksContent).toBe(false)
  })

  it('being offline does not blank the page', () => {
    // The whole point of offline-first.
    expect(WORK_STATE_PRESENTATION.offline.blocksContent).toBe(false)
  })

  it('a refusal does', () => {
    expect(WORK_STATE_PRESENTATION.forbidden.blocksContent).toBe(true)
  })
})

describe('announcements', () => {
  it('interrupts a screen reader only for the two states that change what you may do', () => {
    const assertive = WORK_STATES.filter(
      (state) => WORK_STATE_PRESENTATION[state].announce === 'assertive',
    )
    expect(assertive.sort()).toEqual(['error', 'forbidden'])
  })

  it('never announces "everything is fine"', () => {
    expect(WORK_STATE_PRESENTATION.ready.announce).toBe('silent')
  })
})

describe('the message a screen renders', () => {
  it('carries the count separately so a translator can write the plural', () => {
    // Never `${count} changes need review` built by concatenation — Persian
    // and English disagree about where the number goes.
    const message = describeWorkState({ conflictCount: 2 })
    expect(message).toMatchObject({ state: 'conflict', count: 2, tone: 'warn' })
    expect(message.labelKey).toBe('state.conflict')
  })

  it('drops a zero rather than rendering "syncing 0 changes"', () => {
    expect(describeWorkState({ isSyncing: true, pendingCount: 0 }).count).toBeNull()
  })

  it('carries no count for a state that has none', () => {
    expect(describeWorkState({ isSaving: true }).count).toBeNull()
  })
})
