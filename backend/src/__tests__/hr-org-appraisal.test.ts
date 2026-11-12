import { describe, expect, it } from 'vitest'
import { detectOrgCycle, collectSubordinateIds } from '@hisabche/validation'

describe('B.2.17 Employee org chart & subordinate scoping', () => {
  it('detects direct and indirect org cycles', () => {
    const map = new Map<string, string | null>([
      ['e1', null],
      ['e2', 'e1'],
      ['e3', 'e2'],
    ])
    expect(detectOrgCycle(map, 'e1', 'e1')).toBe(true)
    expect(detectOrgCycle(map, 'e1', 'e3')).toBe(true)
    expect(detectOrgCycle(map, 'e3', 'e1')).toBe(false)
  })

  it('collects only direct and indirect reports of a manager', () => {
    const reports = collectSubordinateIds(
      [
        { id: 'ceo', reports_to: null },
        { id: 'm1', reports_to: 'ceo' },
        { id: 'm2', reports_to: 'ceo' },
        { id: 's1', reports_to: 'm1' },
        { id: 's2', reports_to: 'm2' },
      ],
      'm1',
    )
    expect([...reports]).toEqual(['s1'])
  })
})
