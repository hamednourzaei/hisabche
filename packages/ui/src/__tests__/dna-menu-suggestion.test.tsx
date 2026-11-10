// ============================================
// V54 5.6 (7 Nov 2026) — the menu Hisabche suggests from the business DNA.
//
//   · reads the resolved modules, never an industry name;
//   · never touches the money pages;
//   · a suggestion, not a lock: written only while the person has no menu of
//     their own, once per profile version — «show everything» is not undone.
// ============================================

import { act, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'
import { ARCHETYPE_PRESETS, type OperationalDna } from '@hisabche/validation'
import { suggestedHiddenMenuPaths } from '../lib/menu/dna-menu-suggestion'
import { __resetPageLooks, usePageLook } from '../lib/page-look'

const preset = (key: string): OperationalDna => {
  const dna = ARCHETYPE_PRESETS[key]
  if (!dna) throw new Error(`missing preset ${key}`)
  return dna
}

describe('suggestedHiddenMenuPaths', () => {
  it('a retail store keeps the warehouse and the till', () => {
    const hidden = suggestedHiddenMenuPaths(preset('RETAIL_STORE'))
    expect(hidden).not.toContain('/warehouse')
    expect(hidden).toContain('/manufacturing')
  })

  it('a solo nail technician is not shown manufacturing, team or the till', () => {
    const hidden = suggestedHiddenMenuPaths(preset('NAIL_TECH_BEAUTY'))
    expect(hidden).toEqual(expect.arrayContaining(['/manufacturing', '/till']))
    // Consumables are stock too: the warehouse stays.
    expect(hidden).not.toContain('/warehouse')
  })

  it.each(Object.keys(ARCHETYPE_PRESETS))('%s: the money pages are never suggested away', (key) => {
    const hidden = suggestedHiddenMenuPaths(preset(key))
    for (const path of ['/dashboard', '/invoices', '/accounting', '/customers', '/settings']) {
      expect(hidden).not.toContain(path)
    }
  })

  it('V55: an UNRESOLVED axis hides nothing — a suggestion is never built on a guess', () => {
    const unresolved: OperationalDna = {
      ...preset('RETAIL_STORE'),
      offering: ['UNRESOLVED'],
      inventory: ['UNRESOLVED'],
      archetypeHint: 'GENERIC_BUSINESS',
    }
    expect(suggestedHiddenMenuPaths(unresolved)).toEqual([])
  })

  it('a growing business gets its pages back when the DNA says so', () => {
    const solo = preset('NAIL_TECH_BEAUTY')
    const salon: OperationalDna = { ...solo, workforce: ['COMMISSION_PROVIDERS'] }
    expect(suggestedHiddenMenuPaths(salon)).not.toContain('/team-and-payroll')
  })

  it('the rule names no industry', () => {
    const source = readFileSync(
      join(__dirname, '..', 'lib', 'menu', 'dna-menu-suggestion.ts'),
      'utf8',
    ).replace(/^\s*\/\/.*$/gm, '')
    expect(source).not.toMatch(/archetypeHint|NAIL_TECH|RETAIL_STORE|tradeKey/)
  })
})

describe('usePageLook.suggest — a starting point, never an override', () => {
  beforeEach(() => {
    window.localStorage.clear()
    __resetPageLooks()
    useAuthStore.setState({ user: { id: 'u1' } } as never)
    useWorkspaceStore.setState({ workspaceId: 'w1' } as never)
  })

  it('applies once to a person with no menu of their own', () => {
    const { result } = renderHook(() => usePageLook('menu'))
    act(() => result.current.suggest(['/till'], 'v1'))
    expect(result.current.hiddenIds).toEqual(['/till'])
  })

  it('«show everything» is not undone by the same suggestion', () => {
    const { result } = renderHook(() => usePageLook('menu'))
    act(() => result.current.suggest(['/till'], 'v1'))
    act(() => result.current.reset())
    act(() => result.current.suggest(['/till'], 'v1'))
    expect(result.current.hiddenIds).toEqual([])
  })

  it('a person who already chose their menu keeps it, even for a new version', () => {
    const { result } = renderHook(() => usePageLook('menu'))
    act(() => result.current.toggle('/analysis'))
    act(() => result.current.suggest(['/till'], 'v2'))
    expect(result.current.hiddenIds).toEqual(['/analysis'])
  })
})

describe('wiring', () => {
  it('every host gets it through the one customizer', () => {
    const source = readFileSync(
      join(__dirname, '..', 'components', 'ui', 'global-page-customizer.tsx'),
      'utf8',
    )
    expect(source).toContain('useDnaMenuSuggestion()')
  })
})
