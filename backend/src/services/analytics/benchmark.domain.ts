// ============================================
// Capability #135 — benchmarking.
// Engine N12.
//
// ⚠️ THIS PRODUCT HAS NO EXTERNAL DATA, AND THAT DECIDES THE WHOLE DESIGN.
//
// `POSITIONING-2026-09-15.md` records what happened last time a benchmark was
// claimed anyway: «customer counts / ratings» appeared on the landing page and
// had to be deleted because the codebase had no rating system at all. So this
// engine can only compare a shop against OTHER SHOPS IN THE SAME DEPLOYMENT —
// and even that has a privacy floor below which the answer is suppressed.
//
// ⚠️ THEREFORE A BENCHMARK WITH NO PEERS IS `null`, NOT THE SHOP'S OWN FIGURE.
//
// «You have no peers» and «you are your own benchmark» are different statements,
// and only one of them is useful. Returning the shop's own number in the peer
// column is the single failure mode here: a shop with one comparable business
// would see «average margin 34%» and conclude the market is 34%, when it is
// their own shop.
//
// ⚠️ AND A PEER GROUP BELOW THE FLOOR IS NOT PUBLISHED.
//
// Ten shops is not a market. Below `MIN_PEERS` the peer figures are withheld
// and the shop is told why — because a cohort of three shops in one city, one
// of which is the shop looking, produces a percentile that means nothing and
// reads as authoritative.
//
// ⚠️ THE MINIMUM COHORT ALSO PROTECTS THE SHOPS BEING COMPARED. A benchmark
// that could reveal that exactly two shops in a deployment sell a given product
// is a shop directory with extra steps. `anonymousPeers` returns the COUNT and
// the shop's own position, never the list.
import type { ProfitReport } from '../accounting/profit-report.domain'

/**
 * ⚠️ BELOW THIS MANY COMPARABLE SHOPS, NO PEER FIGURE IS PUBLISHED.
 *
 * Chosen with the privacy reading first and the statistics second. Ten is also
 * where a percentile stops being an estimate and starts being a fact about a
 * population.
 */
export const MIN_PEERS = 10

export interface PeerFacts {
  workspaceId: string
  /** Gross margin as a percentage. Null when the shop has no revenue. */
  grossMarginPercent: number | null
  /** Net margin. */
  netMarginPercent: number | null
  /** Invoices per day over the period. */
  invoiceRatePerDay: number | null
  /** Days sales outstanding. */
  dso: number | null
}

/** What the shop is told, and what it is not. */
export interface Benchmark {
  subjectWorkspaceId: string
  metric: keyof Omit<PeerFacts, 'workspaceId'>
  /** The shop's own figure. Null when it has none. */
  own: number | null
  /**
   * ⚠️ THE MEDIAN OF ITS PEERS. Null when there are no peers, when there are
   * fewer than `MIN_PEERS`, or when the shop's own figure is null.
   */
  peerMedian: number | null
  /** Where the shop sits, 0–100. Null for the same reasons. */
  percentile: number | null
  peerCount: number
  /** Why there is no comparison, when there is not one. */
  unavailable: null | 'NO_SELF_FIGURE' | 'NOT_ENOUGH_PEERS' | 'NO_PEERS'
  /**
   * ⚠️ ALWAYS THIS. There is no external benchmark, and a UI that renders
   * «compared to the industry» from this number is making a claim the product
   * cannot source.
   */
  comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY'
}

/**
 * Where the shop sits among its peers.
 *
 * ⚠️ PERCENTILE BY COUNT, NOT BY RANK DIVISION. Rank/(n−1) gives a small shop
 * the 100th percentile when it is alone in a group of one, and gives ties
 * different answers depending on the sort. Counting how many peers are strictly
 * below is the version that behaves.
 */
export function percentileOf(own: number, peers: readonly number[]): number {
  if (peers.length === 0) return 0
  const below = peers.filter((p) => p < own).length
  const equal = peers.filter((p) => p === own).length
  // Half credit for ties, so a shop tied with nine others is at the 50th
  // percentile rather than anywhere between 0 and 10.
  return Math.round(((below + equal / 2) / peers.length) * 100)
}

/** The median of a list. Null for an empty one. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // Even count: the mean of the two middle values, which is what a median is.
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

/**
 * Compare one shop with its peers.
 *
 * ⚠️ THE SHOOP IS EXCLUDED FROM ITS OWN PEERS. Including it means a shop that
 * happens to be average is at the 50th percentile of a group it helped define,
 * and a small deployment reads as though the shop were half the market.
 */
export function benchmark(
  subjectWorkspaceId: string,
  metric: keyof Omit<PeerFacts, 'workspaceId'>,
  all: readonly PeerFacts[],
): Benchmark {
  const others = all.filter((p) => p.workspaceId !== subjectWorkspaceId)
  const own = all.find((p) => p.workspaceId === subjectWorkspaceId)?.[metric] ?? null

  if (own === null) {
    return {
      subjectWorkspaceId,
      metric,
      own: null,
      peerMedian: null,
      percentile: null,
      peerCount: others.length,
      unavailable: 'NO_SELF_FIGURE',
      comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY',
    }
  }

  const peerValues = others
    .map((p) => p[metric])
    .filter((v): v is number => v !== null && v !== undefined)

  if (peerValues.length === 0) {
    return {
      subjectWorkspaceId,
      metric,
      own,
      peerMedian: null,
      percentile: null,
      peerCount: 0,
      unavailable: 'NO_PEERS',
      comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY',
    }
  }

  // ⚠️ The floor is applied to the peers THAT HAVE THE FIGURE, not to the
  // number of shops — a group of twenty where three have a margin is still three
  // data points, and publishing their median is publishing three shops.
  if (peerValues.length < MIN_PEERS) {
    return {
      subjectWorkspaceId,
      metric,
      own,
      peerMedian: null,
      percentile: null,
      peerCount: peerValues.length,
      unavailable: 'NOT_ENOUGH_PEERS',
      comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY',
    }
  }

  return {
    subjectWorkspaceId,
    metric,
    own,
    peerMedian: median(peerValues),
    percentile: percentileOf(own, peerValues),
    peerCount: peerValues.length,
    unavailable: null,
    comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY',
  }
}

/**
 * A comparison the shop can act on, never one that ranks it.
 *
 * ⚠️ RETURNS A DIFFERENCE, NOT A RANKING. «Your margin is 4 points below the
 * median of similar shops» is a fact a shop can act on; «you are 43rd of 71» is
 * a scoreboard that tells a one-person shop it lost.
 *
 * ⚠️ NO SENTENCE IS BUILT HERE. The difference and its direction are data, and
 * the wording is the client's — in one of three languages, and this module does
 * not know which. The first version returned a `plain` string that was always
 * null, which is the exact shape `insights.domain` warns about: a figure with a
 * sentence attached that says nothing.
 */
export function benchmarkDelta(benchmarkResult: Benchmark): {
  delta: number | null
  direction: 'above' | 'below' | 'level' | null
} {
  if (benchmarkResult.own === null || benchmarkResult.peerMedian === null) {
    return { delta: null, direction: null }
  }

  const delta = Math.round((benchmarkResult.own - benchmarkResult.peerMedian) * 100) / 100
  return { delta, direction: delta > 0 ? 'above' : delta < 0 ? 'below' : 'level' }
}

/**
 * Read one shop's figures out of its own profit report.
 *
 * ⚠️ A SEPARATE FUNCTION because the report is already authoritative and the
 * benchmark layer must not recompute a margin. `grossMarginPercent` is null
 * when there is no revenue, and it stays null all the way to the benchmark.
 */
export function peerFactsFrom(
  workspaceId: string,
  report: ProfitReport,
  daysInPeriod: number,
): PeerFacts {
  const { revenue, grossProfit, netMarginPercent } = report.totals

  return {
    workspaceId,
    grossMarginPercent: revenue === 0 ? null : Math.round((grossProfit / revenue) * 10000) / 100,
    netMarginPercent,
    invoiceRatePerDay:
      daysInPeriod > 0 ? Math.round((report.totals.invoiceCount / daysInPeriod) * 100) / 100 : null,
    dso: null,
  }
}
