// packages/ui/src/__tests__/landing-journey-machine.test.ts
//
// The two things the landing scene is built on: one sale whose numbers always
// agree, and one machine that says where the story is. Both are pure, so they
// are tested with values, not by reading source.

import { describe, expect, it } from 'vitest'

import {
  ENTER_AT,
  GATE_AT,
  JOURNEY_STATIONS,
  LEAVE_AT,
  RECORDED_AT,
  journeyAt,
  journeyReduce,
  progressForBeat,
} from '../components/ui/landing/journey/journey-machine'
import {
  DEMO_SALE,
  customerBalanceAfter,
  drawerAfter,
  formatDemoAmount,
  formatDemoCount,
  journalLines,
  lineTotal,
  paymentKind,
  reportFigures,
  saleRemaining,
  saleTotal,
  stockAfter,
  unitsSold,
} from '../components/ui/landing/journey/landing-demo-data'

const N = JOURNEY_STATIONS.length

describe('one sale, numbers that agree', () => {
  it('the total is the sum of its lines — worked out by hand: 2 × 500,000 + 1 × 300,000', () => {
    expect(DEMO_SALE.items.map(lineTotal)).toEqual([1_000_000, 300_000])
    expect(saleTotal()).toBe(1_300_000)
    // Scale, not only the exact figure: more than any one line, less than twice the lines.
    expect(saleTotal()).toBeGreaterThan(1_000_000)
    expect(saleTotal()).toBeLessThan(2_000_000)
  })

  it('what was not paid is what the customer owes', () => {
    expect(saleRemaining()).toBe(saleTotal() - DEMO_SALE.paid)
    expect(saleRemaining()).toBe(500_000)
    expect(customerBalanceAfter()).toBe(DEMO_SALE.customerBalanceBefore + saleRemaining())
    expect(paymentKind()).toBe('partial')
  })

  it('the drawer grows by the cash received, not by the invoice total', () => {
    expect(drawerAfter()).toBe(DEMO_SALE.drawerBefore + DEMO_SALE.paid)
    expect(drawerAfter() - DEMO_SALE.drawerBefore).not.toBe(saleTotal())
  })

  it('stock after is stock before minus what was sold, for every item', () => {
    for (const item of DEMO_SALE.items) {
      expect(stockAfter(item)).toBe(item.stockBefore - item.quantity)
      expect(stockAfter(item)).toBeGreaterThanOrEqual(0)
    }
    expect(unitsSold()).toBe(3)
  })

  it('the journal balances, and a part-paid sale has a receivable line', () => {
    const lines = journalLines()
    const debit = lines.reduce((sum, line) => sum + line.debit, 0)
    const credit = lines.reduce((sum, line) => sum + line.credit, 0)
    expect(debit).toBe(credit)
    expect(debit).toBe(saleTotal())
    expect(lines.find((line) => line.account === 'receivable')?.debit).toBe(saleRemaining())
    expect(lines.find((line) => line.account === 'cash')?.debit).toBe(DEMO_SALE.paid)
    for (const line of lines) expect(line.debit === 0 || line.credit === 0).toBe(true)
  })

  it('the report is made of the same derived values', () => {
    const report = reportFigures()
    expect(report.sales).toBe(saleTotal())
    expect(report.received + report.receivables).toBe(report.sales)
    expect(report.unitsSold).toBe(unitsSold())
  })

  it('every amount is an integer in the base unit', () => {
    for (const value of [saleTotal(), saleRemaining(), drawerAfter(), customerBalanceAfter()]) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('each language reads the amount in its own digits and unit', () => {
    // Iran reads toman: the base amount divided by ten.
    expect(formatDemoAmount(1_300_000, 'fa')).toBe('۱۳۰٬۰۰۰')
    // Afghanistan and the English page read afghani: the same basket, 13,000.
    expect(formatDemoAmount(1_300_000, 'en')).toBe('13,000')
    // Afghan Persian: the same figure in Persian digits.
    expect(formatDemoAmount(1_300_000, 'af')).toMatch(/^۱۳[٬,.]?۰۰۰$/)
    expect(formatDemoAmount(1_300_000, 'af')).not.toMatch(/[0-9]/)
    expect(formatDemoCount(5, 'fa')).toBe('۵')
    expect(formatDemoCount(5, 'en')).toBe('5')
  })
})

describe('one machine says where the story is', () => {
  it('the opening, every station, then the ending — in order, with no gap', () => {
    const beats: number[] = []
    for (let step = 0; step <= 1000; step++) beats.push(journeyAt(step / 1000, N).beat)
    expect(beats[0]).toBe(0)
    expect(beats.at(-1)).toBe(N + 1)
    for (let index = 1; index < beats.length; index++) {
      const jump = (beats[index] ?? 0) - (beats[index - 1] ?? 0)
      expect(jump === 0 || jump === 1).toBe(true)
    }
    expect(new Set(beats).size).toBe(N + 2)
    expect(journeyAt(0, N).beats).toBe(N + 2)
  })

  it('a station moves through its phases in order', () => {
    const at = (local: number) => journeyAt((2 + local) / (N + 2), N)
    expect(at(0.1).station).toBe(1)
    expect(at(0.1).phase).toBe('approaching')
    expect(at(GATE_AT + 0.01).phase).toBe('gate-opening')
    expect(at(ENTER_AT - 0.01).phase).toBe('arrived')
    expect(at(ENTER_AT + 0.01).phase).toBe('handoff')
    expect(at(RECORDED_AT + 0.01).phase).toBe('speaking')
    expect(at(LEAVE_AT + 0.01).phase).toBe('leaving')
  })

  it('exactly on a threshold, the phase that begins there has begun', () => {
    const at = (local: number) => journeyAt((1 + local) / (N + 2), N)
    expect(at(ENTER_AT).phase).toBe('handoff')
    expect(at(RECORDED_AT).recorded).toBe(1)
  })

  it('a station counts as recorded from the moment its machine records, never before', () => {
    const at = (local: number) => journeyAt((3 + local) / (N + 2), N)
    expect(at(RECORDED_AT - 0.01).recorded).toBe(2)
    expect(at(RECORDED_AT + 0.01).recorded).toBe(3)
    expect(journeyAt(0.05, N).recorded).toBe(0)
    expect(journeyAt(1, N).recorded).toBe(N)
  })

  it('gates: closed ahead, open as the agent arrives, passed behind', () => {
    const snapshot = journeyAt((3 + GATE_AT + 0.02) / (N + 2), N)
    expect(snapshot.gates).toEqual(['passed', 'passed', 'open', 'closed', 'closed'])
    expect(snapshot.zones).toEqual(['visited', 'visited', 'current', 'upcoming', 'upcoming'])
    expect(journeyAt(0, N).gates.every((gate) => gate === 'closed')).toBe(true)
    expect(journeyAt(1, N).gates.every((gate) => gate === 'passed')).toBe(true)
  })

  it('scrubbing backward gives exactly what scrubbing forward gave', () => {
    const forward = Array.from({ length: 201 }, (_, step) => journeyAt(step / 200, N))
    const backward = Array.from({ length: 201 }, (_, step) =>
      journeyAt((200 - step) / 200, N),
    ).reverse()
    expect(backward).toEqual(forward)
  })

  it('a click on the route lands on that beat with its result showing', () => {
    for (let beat = 1; beat <= N; beat++) {
      const snapshot = journeyAt(progressForBeat(beat, N), N)
      expect(snapshot.beat).toBe(beat)
      expect(snapshot.recorded).toBe(beat)
    }
    expect(journeyAt(progressForBeat(0, N), N).beat).toBe(0)
    expect(journeyAt(progressForBeat(N + 1, N), N).finished).toBe(true)
    // Out of range is the nearest end, not an error.
    expect(progressForBeat(99, N)).toBe(progressForBeat(N + 1, N))
    expect(progressForBeat(-3, N)).toBe(0)
  })

  it('events: next, previous, rapid jumps, skip and reset all resolve to a place', () => {
    let progress = 0
    progress = journeyReduce(progress, { type: 'next' }, N)
    expect(journeyAt(progress, N).beat).toBe(1)
    for (const beat of [4, 1, 5, 2, 2, 0, 3]) {
      progress = journeyReduce(progress, { type: 'select', beat }, N)
      expect(journeyAt(progress, N).beat).toBe(beat)
    }
    progress = journeyReduce(progress, { type: 'previous' }, N)
    expect(journeyAt(progress, N).beat).toBe(2)
    expect(journeyReduce(progress, { type: 'skip' }, N)).toBe(1)
    expect(journeyReduce(progress, { type: 'reset' }, N)).toBe(0)
    expect(journeyReduce(0, { type: 'previous' }, N)).toBe(0)
    expect(journeyAt(journeyReduce(1, { type: 'next' }, N), N).finished).toBe(true)
  })

  it('a scroll position outside 0…1, or not a number, is brought back inside', () => {
    expect(journeyReduce(0.4, { type: 'scroll', progress: 7 }, N)).toBe(1)
    expect(journeyReduce(0.4, { type: 'scroll', progress: -1 }, N)).toBe(0)
    expect(journeyAt(Number.NaN, N).beat).toBe(0)
  })

  it('the count of everything comes from the station list', () => {
    expect(journeyAt(0.5, 3).beats).toBe(5)
    expect(journeyAt(0.5, 3).gates).toHaveLength(3)
    expect(journeyAt(1, 8).recorded).toBe(8)
  })
})
