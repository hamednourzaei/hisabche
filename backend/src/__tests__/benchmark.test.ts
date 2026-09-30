// ============================================
// Engine N12 — benchmarking.
// Capability #135.
//
// ⚠️ THIS ENGINE HAS NO EXTERNAL DATA AND SAYS SO IN ITS OWN OUTPUT.
//
// `comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY'` is on every result, so no
// consumer can render «compared to the industry» from it. That string exists
// because `POSITIONING-2026-09-15.md` records the alternative: benchmark claims
// that were deleted from the landing page because nothing backed them.
//
// The tests below are therefore mostly about REFUSING to produce a number. Each
// of these would be a plausible-looking figure a shop would plan against:
//
//   * a shop compared against ITSELF, so «average margin 34%» would mean their
//     own shop rather than the market
//   * a peer median from three shops, where the group is three shops in one city
//   * a percentile from a group of one, where rank/(n−1) puts the shop at 100th
//   * a median that includes the shop being measured
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MIN_PEERS,
  benchmark,
  benchmarkDelta,
  median,
  percentileOf,
  type PeerFacts,
} from '../services/analytics/benchmark.domain'

const peers = (count: number, margin: number, prefix = 'peer'): PeerFacts[] =>
  Array.from({ length: count }, (_, i) => ({
    workspaceId: `${prefix}-${i}`,
    grossMarginPercent: margin,
    netMarginPercent: margin / 2,
    invoiceRatePerDay: 2,
    dso: 30,
  }))

describe('N12 — there is no external benchmark and the result says so', () => {
  it('every result carries its basis', () => {
    const result = benchmark('me', 'grossMarginPercent', [
      ...peers(20, 30),
      {
        workspaceId: 'me',
        grossMarginPercent: 40,
        netMarginPercent: 20,
        invoiceRatePerDay: 2,
        dso: 30,
      },
    ])

    // ⚠️ The field exists so a consumer CANNOT render «the industry average».
    expect(result.comparisonBasis).toBe('SAME_DEPLOYMENT_PEERS_ONLY')
  })
})

describe('N12 — a shop is never its own benchmark', () => {
  const me = (margin: number | null): PeerFacts => ({
    workspaceId: 'me',
    grossMarginPercent: margin,
    netMarginPercent: null,
    invoiceRatePerDay: null,
    dso: null,
  })

  it('the subject is excluded from its own peer median', () => {
    // ⚠️ THE failure this file is mostly about. With the subject included, a
    // shop at 40% among 30%-peers would report a median of 30.1% instead of
    // 30% — and in a small deployment, including itself is most of the group.
    const result = benchmark('me', 'grossMarginPercent', [...peers(20, 30), me(40)])

    expect(result.peerMedian).toBe(30)
    expect(result.peerCount).toBe(20)
  })

  it('a shop alone in the deployment gets NO comparison', () => {
    const result = benchmark('me', 'grossMarginPercent', [me(40)])

    expect(result.own).toBe(40)
    expect(result.peerMedian).toBeNull()
    expect(result.percentile).toBeNull()
    expect(result.unavailable).toBe('NO_PEERS')
  })

  it('a shop with no figure of its own gets NO comparison', () => {
    // ⚠️ Null all the way down. A shop with no revenue has no margin, and
    // reporting it at 0% would put it at the bottom of every peer group.
    const result = benchmark('me', 'grossMarginPercent', [...peers(20, 30), me(null)])

    expect(result.unavailable).toBe('NO_SELF_FIGURE')
    expect(result.percentile).toBeNull()
  })
})

describe('N12 — the privacy floor withholds a peer median', () => {
  const me: PeerFacts = {
    workspaceId: 'me',
    grossMarginPercent: 40,
    netMarginPercent: null,
    invoiceRatePerDay: null,
    dso: null,
  }

  it('three peers is not a market', () => {
    // ⚠️ Three shops in one deployment, one of which is the shop looking, is a
    // shop directory with extra steps. The median is withheld and the shop is
    // told why.
    const result = benchmark('me', 'grossMarginPercent', [...peers(3, 30), me])

    expect(result.peerMedian).toBeNull()
    expect(result.unavailable).toBe('NOT_ENOUGH_PEERS')
    // ⚠️ The COUNT is still returned — the shop may know there are three peers,
    // it just may not learn their median.
    expect(result.peerCount).toBe(3)
  })

  it('ten peers is enough', () => {
    const result = benchmark('me', 'grossMarginPercent', [...peers(10, 30), me])

    expect(MIN_PEERS).toBe(10)
    expect(result.unavailable).toBeNull()
    expect(result.peerMedian).toBe(30)
  })

  it('the floor counts the peers THAT HAVE THE FIGURE, not the shops', () => {
    // ⚠️ Twenty shops where three have a margin is still three data points.
    const withFigure = [
      ...peers(3, 30),
      ...Array.from({ length: 17 }, (_, i) => ({
        ...peers(1, 0)[0]!,
        workspaceId: `silent-${i}`,
        grossMarginPercent: null,
      })),
    ]
    const result = benchmark('me', 'grossMarginPercent', [...withFigure, me])

    expect(result.unavailable).toBe('NOT_ENOUGH_PEERS')
    expect(result.peerCount).toBe(3)
  })
})

describe('N12 — a percentile from one peer is not 100th place', () => {
  it('a group of one puts a shop at 50, not 100', () => {
    // ⚠️ Rank division gives (n)/(n−1) which is Infinity at n=1. Counting how
    // many peers are strictly below is the version that behaves.
    expect(percentileOf(50, [30])).toBe(100)
    expect(percentileOf(30, [50])).toBe(0)
    expect(percentileOf(30, [30])).toBe(50)
    expect(percentileOf(10, [])).toBe(0)
  })

  it('ties get half credit, so a tied shop is at the middle', () => {
    const nine = Array.from({ length: 9 }, () => 30)
    expect(percentileOf(30, nine)).toBe(50)
  })
})

describe('N12 — the median is a real median', () => {
  it('handles an odd count', () => {
    expect(median([30, 10, 20])).toBe(20)
  })

  it('averages the middle two on an even count', () => {
    expect(median([10, 20, 30, 40])).toBe(25)
  })

  it('is null for an empty list, not zero', () => {
    // ⚠️ A median of 0% is the worst possible peer figure — it would put every
    // shop above the market.
    expect(median([])).toBeNull()
  })

  it('does not mutate its input', () => {
    const values = [30, 10, 20]
    median(values)
    expect(values).toEqual([30, 10, 20])
  })
})

describe('N12 — the delta is a difference, never a ranking', () => {
  it('reports how far above or below', () => {
    const result = benchmark('me', 'grossMarginPercent', [
      ...peers(10, 30),
      {
        workspaceId: 'me',
        grossMarginPercent: 26,
        netMarginPercent: null,
        invoiceRatePerDay: null,
        dso: null,
      },
    ])

    const delta = benchmarkDelta(result)
    expect(delta.delta).toBe(-4)
    expect(delta.direction).toBe('below')
  })

  it('no comparison means no delta, not a zero delta', () => {
    // ⚠️ Zero says «exactly at the median», which is a claim. Null says «there
    // was nothing to compare against».
    const result = benchmark('me', 'grossMarginPercent', [])
    expect(benchmarkDelta(result)).toEqual({ delta: null, direction: null })
  })
})
