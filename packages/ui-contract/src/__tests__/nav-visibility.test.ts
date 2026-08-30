// ============================================
// Applying a visibility profile to the navigation.
//
// One property matters above the rest: hiding can only remove. There is no
// argument that adds a destination, so un-hiding something the server did not
// authorize cannot make it appear.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MORE_GROUPS_CONTRACT,
  NAV_CONTRACT,
  splitForBudget,
  visibleNavGroups,
  visibleNavItems,
  type NavId,
} from '../index'

const authorized: NavId[] = ['today', 'sell', 'stock', 'money', 'settings']

describe('visibility narrows, never widens', () => {
  it('renders what the server authorized', () => {
    const visible = visibleNavItems(NAV_CONTRACT, authorized)
    expect(visible.every((item) => authorized.includes(item.id))).toBe(true)
  })

  it('removes what the user hid', () => {
    const visible = visibleNavItems(NAV_CONTRACT, authorized, ['stock'])
    expect(visible.map((item) => item.id)).not.toContain('stock')
  })

  it('CANNOT ADD a destination the server did not authorize', () => {
    // There is no parameter that adds one. This test exists so that if one is
    // ever introduced, it fails here rather than in production.
    const visible = visibleNavItems(NAV_CONTRACT, ['today'], [])
    expect(visible.map((item) => item.id)).toEqual(['today'])
  })

  it('renders nothing when nothing is authorized', () => {
    expect(visibleNavItems(NAV_CONTRACT, [])).toEqual([])
  })

  it('preserves contract order', () => {
    // Navigation that reshuffles as people hide things is navigation nobody
    // can build muscle memory for.
    const visible = visibleNavItems(NAV_CONTRACT, authorized)
    const expected = NAV_CONTRACT.filter((item) => authorized.includes(item.id)).map((i) => i.id)
    expect(visible.map((i) => i.id)).toEqual(expected)
  })
})

describe('grouped navigation', () => {
  it('drops a group whose every item is hidden', () => {
    const allIds = MORE_GROUPS_CONTRACT.flatMap((g) => g.items.map((i) => i.id))
    const groups = visibleNavGroups(MORE_GROUPS_CONTRACT, allIds, allIds)
    expect(groups).toEqual([])
  })

  it('keeps a group that still has something in it', () => {
    const allIds = MORE_GROUPS_CONTRACT.flatMap((g) => g.items.map((i) => i.id))
    const groups = visibleNavGroups(MORE_GROUPS_CONTRACT, allIds, allIds.slice(1))
    expect(groups.length).toBeGreaterThan(0)
  })
})

describe('the device budget moves items, it does not delete them', () => {
  it('splits at the budget', () => {
    const { visible, overflow } = splitForBudget(['a', 'b', 'c', 'd'], 2)
    expect(visible).toEqual(['a', 'b'])
    expect(overflow).toEqual(['c', 'd'])
  })

  it('LOSES NOTHING — the overflow is still reachable', () => {
    // A destination that silently disappeared on a slow phone would be
    // indistinguishable from a permission the user does not have.
    const items = ['a', 'b', 'c', 'd']
    const { visible, overflow } = splitForBudget(items, 2)
    expect([...visible, ...overflow]).toEqual(items)
  })

  it('puts everything in the overflow when the budget is zero', () => {
    const { visible, overflow } = splitForBudget(['a', 'b'], 0)
    expect(visible).toEqual([])
    expect(overflow).toEqual(['a', 'b'])
  })

  it('keeps everything visible when the budget exceeds the list', () => {
    expect(splitForBudget(['a'], 10).overflow).toEqual([])
  })
})
