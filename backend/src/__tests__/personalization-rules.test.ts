// ============================================
// UI visibility, and the line it must never cross.
//
// The whole feature is one sentence: hiding is a preference, not a permission.
// Most of what follows tests that the code cannot express the other reading —
// `resolveVisibility` takes the authorized set as an input and can only return
// a subset of it, so there is no path by which un-hiding grants access.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  applyPatch,
  emptyProfile,
  hiddenKeys,
  isVisible,
  resolveVisibility,
  suggestFrom,
  validatePatch,
  type UiVisibilityProfile,
  type UsageSignal,
} from '../services/personalization'

const profile = (over: Partial<UiVisibilityProfile> = {}): UiVisibilityProfile => ({
  ...emptyProfile('ws-1', 'u-1'),
  ...over,
})

describe('defaults', () => {
  it('shows a module nobody has an opinion about', () => {
    expect(isVisible(profile(), 'module', 'manufacturing')).toBe(true)
  })

  it('shows a page and a widget by default', () => {
    expect(isVisible(profile(), 'page', 'aging')).toBe(true)
    expect(isVisible(profile(), 'widget', 'profit-chart')).toBe(true)
  })

  it('HIDES an advanced field by default', () => {
    // The asymmetry is the shape of the feature: the product grows by adding
    // things people can see, and stays usable by not adding expert inputs to
    // everyone's forms.
    expect(isVisible(profile(), 'field', 'weightGrams')).toBe(false)
  })

  it('honours an explicit choice at either level', () => {
    expect(
      isVisible(profile({ modules: { manufacturing: false } }), 'module', 'manufacturing'),
    ).toBe(false)
    expect(
      isVisible(profile({ advancedFields: { weightGrams: true } }), 'field', 'weightGrams'),
    ).toBe(true)
  })
})

describe('visibility can only ever narrow what authorization allowed', () => {
  const authorized = ['invoices', 'customers', 'accounting']

  it('returns a subset of the authorized set', () => {
    const hidden = profile({ modules: { accounting: false } })
    expect(resolveVisibility(hidden, 'module', authorized)).toEqual(['invoices', 'customers'])
  })

  it('CANNOT add a module the user was not authorized for', () => {
    // The one that matters. A profile saying "manufacturing: true" for a user
    // whose authorized list does not include it changes nothing.
    const wishful = profile({ modules: { manufacturing: true } })
    expect(resolveVisibility(wishful, 'module', authorized)).not.toContain('manufacturing')
  })

  it('returns nothing when nothing was authorized, whatever the profile says', () => {
    const wishful = profile({ modules: { invoices: true, accounting: true } })
    expect(resolveVisibility(wishful, 'module', [])).toEqual([])
  })

  it('leaves an unopinionated profile exactly as authorized', () => {
    expect(resolveVisibility(profile(), 'module', authorized)).toEqual(authorized)
  })
})

describe('patching a profile', () => {
  it('leaves keys it does not mention alone', () => {
    // A full replace would let a client that knows about four modules wipe the
    // preference for a fifth it has not been updated to know about.
    const before = profile({ modules: { a: false, b: true } })
    const after = applyPatch(before, 'module', { c: false })

    expect(after.modules).toEqual({ a: false, b: true, c: false })
  })

  it('rejects a key that is not a stable identifier', () => {
    expect(validatePatch('module', { 'drop table;': false })).toContain('VISIBILITY_KEY_INVALID')
  })

  it('rejects an unknown level', () => {
    expect(validatePatch('everything', { a: false })).toContain('VISIBILITY_LEVEL_INVALID')
  })

  it('bounds how many keys one profile can hold', () => {
    const many = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`k${i}`, false]))
    expect(validatePatch('module', many)).toContain('VISIBILITY_TOO_MANY_KEYS')
  })

  it('accepts an ordinary patch', () => {
    expect(validatePatch('widget', { 'profit-chart': false })).toEqual([])
  })
})

describe('there is always a way back', () => {
  it('lists everything the user has hidden, at every level', () => {
    const hidden = profile({
      modules: { manufacturing: false },
      pages: { aging: false },
      widgets: { chart: true },
      advancedFields: { weightGrams: false },
    })

    expect(hiddenKeys(hidden)).toEqual([
      { level: 'module', key: 'manufacturing' },
      { level: 'page', key: 'aging' },
      { level: 'field', key: 'weightGrams' },
    ])
  })

  it('lists nothing when nothing is hidden', () => {
    expect(hiddenKeys(profile())).toEqual([])
  })
})

describe('suggestions are proposals, never changes', () => {
  const signals: UsageSignal[] = [
    { key: 'manufacturing', level: 'module', uses: 0, daysSinceLastUse: 90 },
    { key: 'invoices', level: 'module', uses: 200, daysSinceLastUse: 0 },
  ]

  it('says nothing before it has seen enough of how somebody works', () => {
    // A week of a new shop's behaviour says more about learning the app than
    // about how they will use it.
    expect(suggestFrom(profile(), signals, { minDaysObserved: 7 })).toEqual([])
  })

  it('offers to hide something never used', () => {
    const suggestions = suggestFrom(profile(), signals, { minDaysObserved: 30 })
    expect(suggestions).toContainEqual({
      level: 'module',
      key: 'manufacturing',
      kind: 'hide',
      reason: 'never_used',
    })
  })

  it('never offers to hide something in daily use', () => {
    const suggestions = suggestFrom(profile(), signals, { minDaysObserved: 30 })
    expect(suggestions.some((s) => s.key === 'invoices')).toBe(false)
  })

  it('offers back something hidden that the person keeps reaching for', () => {
    const hidden = profile({ modules: { reports: false } })
    const suggestions = suggestFrom(
      hidden,
      [{ key: 'reports', level: 'module', uses: 12, daysSinceLastUse: 1 }],
      { minDaysObserved: 30 },
    )

    expect(suggestions).toContainEqual({
      level: 'module',
      key: 'reports',
      kind: 'show',
      reason: 'used_while_hidden',
    })
  })

  it('returns suggestions without touching the profile', () => {
    const before = profile()
    const snapshot = JSON.stringify(before)
    suggestFrom(before, signals, { minDaysObserved: 30 })
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
