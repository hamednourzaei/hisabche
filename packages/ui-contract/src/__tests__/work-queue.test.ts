// ============================================
// Notifications turned into work.
//
// The two rules worth defending: never render a count that is not known, and
// never offer work the person is not allowed to do.
// ============================================

import { describe, expect, it } from 'vitest'

import { CAPABILITY_NAMES } from './capability-names'
import {
  WORK_ITEMS,
  WORK_ITEM_KINDS,
  buildWorkQueue,
  hasWork,
  mostPressing,
  urgencyRank,
} from '../work-queue'
import { NAV_CONTRACT } from '../navigation'

const ALL: string[] = [...CAPABILITY_NAMES]

describe('the specs are honest', () => {
  it('covers every kind exactly once', () => {
    expect(WORK_ITEMS.map((item) => item.kind).sort()).toEqual([...WORK_ITEM_KINDS].sort())
  })

  it('sends every item somewhere that actually exists', () => {
    // A work item is a verb with a destination. One that leads nowhere is a
    // complaint.
    const paths = new Set(NAV_CONTRACT.map((item) => item.path))
    for (const item of WORK_ITEMS) {
      expect(paths.has(item.path), `${item.kind} -> ${item.path}`).toBe(true)
    }
  })

  it('names only capabilities the server has', () => {
    for (const item of WORK_ITEMS) {
      if (item.capability !== null) expect(ALL).toContain(item.capability)
    }
  })

  it('uses i18n keys, never text', () => {
    for (const item of WORK_ITEMS) {
      expect(item.labelKey).toMatch(/^workQueue\./)
    }
  })
})

describe('a count that is not known is never rendered', () => {
  it('drops null — "we could not check" is not "nothing to do"', () => {
    expect(buildWorkQueue({ conflicts: null }, ALL)).toEqual([])
  })

  it('drops undefined', () => {
    expect(buildWorkQueue({}, ALL)).toEqual([])
  })

  it('drops zero — "0 approvals waiting" is noise', () => {
    expect(buildWorkQueue({ approvals: 0 }, ALL)).toEqual([])
  })

  it('keeps a real count', () => {
    const queue = buildWorkQueue({ approvals: 2 }, ALL)
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ kind: 'approvals', count: 2 })
  })
})

describe('never offers work the person may not do', () => {
  it('hides bank reconciliation from someone without ledger.post', () => {
    const queue = buildWorkQueue({ unmatched_bank: 5 }, ['invoice.read'])
    expect(queue).toEqual([])
  })

  it('shows it to someone who holds it', () => {
    const queue = buildWorkQueue({ unmatched_bank: 5 }, ['ledger.post'])
    expect(queue).toHaveLength(1)
  })

  it('still shows the items that need no capability', () => {
    const queue = buildWorkQueue({ conflicts: 1 }, [])
    expect(queue).toHaveLength(1)
  })
})

describe('order is by consequence, not by count', () => {
  it('puts one conflict above forty overdue invoices', () => {
    // A conflict means two devices disagree about what is true, and every
    // number downstream is provisional until somebody decides. Sorting by
    // count would bury it.
    const queue = buildWorkQueue({ conflicts: 1, overdue_invoices: 40 }, ALL)
    expect(queue[0]?.kind).toBe('conflicts')
    expect(mostPressing(queue)?.kind).toBe('conflicts')
  })

  it('ranks blocking above due above attention', () => {
    expect(urgencyRank('blocking')).toBeLessThan(urgencyRank('due'))
    expect(urgencyRank('due')).toBeLessThan(urgencyRank('attention'))
  })
})

describe('an empty queue shows nothing at all', () => {
  it('has no work', () => {
    // Not an encouraging empty state. A panel that says "nothing to do!" every
    // day trains people to skip that part of the screen.
    expect(hasWork(buildWorkQueue({}, ALL))).toBe(false)
    expect(mostPressing([])).toBeNull()
  })
})
