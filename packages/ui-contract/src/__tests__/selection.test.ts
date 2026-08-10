// ============================================
// Selection semantics are shared by the web tables and the native mobile
// lists. These tests pin the decisions that would otherwise drift between the
// two — above all, what "select all" does to rows the user cannot see.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  areAllSelected,
  areSomeSelected,
  emptySelection,
  pruneSelection,
  selectionCount,
  toggleAll,
  toggleId,
} from '../selection'

const setOf = (...ids: string[]): ReadonlySet<string> => new Set(ids)

describe('toggleId', () => {
  it('adds an absent id', () => {
    expect([...toggleId(emptySelection, 'a')]).toEqual(['a'])
  })

  it('removes a present id', () => {
    expect([...toggleId(setOf('a', 'b'), 'a')]).toEqual(['b'])
  })

  it('does not mutate the input', () => {
    const before = setOf('a')
    toggleId(before, 'b')
    expect([...before]).toEqual(['a'])
  })
})

describe('toggleAll', () => {
  it('selects the whole page when none are selected', () => {
    expect([...toggleAll(emptySelection, ['a', 'b'])].sort()).toEqual(['a', 'b'])
  })

  it('selects the whole page when only some are selected', () => {
    expect([...toggleAll(setOf('a'), ['a', 'b'])].sort()).toEqual(['a', 'b'])
  })

  it('clears the page when every id is already selected', () => {
    expect([...toggleAll(setOf('a', 'b'), ['a', 'b'])]).toEqual([])
  })

  it('leaves ids outside the page untouched', () => {
    // Selecting rows on page 2 must not discard what was chosen on page 1.
    const result = toggleAll(setOf('offscreen'), ['a', 'b'])
    expect(result.has('offscreen')).toBe(true)
  })

  it('does not clear an off-page selection when the page is deselected', () => {
    const selected = setOf('offscreen', 'a', 'b')
    const result = toggleAll(selected, ['a', 'b'])
    expect([...result]).toEqual(['offscreen'])
  })

  it('treats an empty page as a no-op rather than a clear', () => {
    // "every one of zero rows is selected" is vacuously true; without the
    // guard an empty filtered page would silently wipe the selection.
    const selected = setOf('a')
    expect(toggleAll(selected, [])).toBe(selected)
  })
})

describe('pruneSelection', () => {
  it('drops ids that are no longer available', () => {
    expect([...pruneSelection(setOf('a', 'b', 'c'), ['a', 'c'])].sort()).toEqual(['a', 'c'])
  })

  it('returns the same reference when nothing was dropped', () => {
    const selected = setOf('a', 'b')
    expect(pruneSelection(selected, ['a', 'b', 'c'])).toBe(selected)
  })

  it('empties the selection when nothing is available', () => {
    expect(selectionCount(pruneSelection(setOf('a'), []))).toBe(0)
  })
})

describe('areAllSelected / areSomeSelected', () => {
  it('reports all-selected only when every id is present', () => {
    expect(areAllSelected(setOf('a', 'b'), ['a', 'b'])).toBe(true)
    expect(areAllSelected(setOf('a'), ['a', 'b'])).toBe(false)
  })

  it('is false for an empty page — nothing to select is not "all selected"', () => {
    expect(areAllSelected(setOf('a'), [])).toBe(false)
  })

  it('reports partial selection as indeterminate, not as all', () => {
    expect(areSomeSelected(setOf('a'), ['a', 'b'])).toBe(true)
    expect(areSomeSelected(setOf('a', 'b'), ['a', 'b'])).toBe(false)
    expect(areSomeSelected(emptySelection, ['a', 'b'])).toBe(false)
  })
})
