import { describe, expect, it } from 'vitest'

import {
  draftLineTotalMinor,
  draftTotalMinor,
} from '../schemas/universal-core/sales-order-draft.domain'

describe('WP-13 offline draft money (one financial engine)', () => {
  it('multiplies quantity by an integer minor price', () => {
    expect(draftLineTotalMinor(2, 150_000)).toBe(300_000)
    expect(draftLineTotalMinor(1, 75_000)).toBe(75_000)
  })

  it('rounds a fractional quantity once, in the shared core', () => {
    expect(draftLineTotalMinor(0.5, 101)).toBe(51)
  })

  it('refuses unknown operands instead of showing zero', () => {
    expect(draftLineTotalMinor(Number.NaN, 100)).toBeNull()
    expect(draftLineTotalMinor(0, 100)).toBeNull()
    expect(draftLineTotalMinor(2, 1.5)).toBeNull()
    expect(draftLineTotalMinor(2, -100)).toBeNull()
  })

  it('a total with one unknown line is unknown, not a partial number', () => {
    expect(draftTotalMinor([300_000, 75_000])).toBe(375_000)
    expect(draftTotalMinor([300_000, null])).toBeNull()
    expect(draftTotalMinor([])).toBeNull()
  })
})
