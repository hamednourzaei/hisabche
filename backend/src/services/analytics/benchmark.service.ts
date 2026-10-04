// ============================================
// backend/src/services/analytics/benchmark.service.ts
//
// Capability #135 — how a business compares with the others on this deployment.
//
// ONE figure is compared: sale invoices per day over the last 30 days. It needs
// no currency and no ledger, so it means the same thing for every business.
// Margins are NOT compared — they would need every business's profit report.
//
// The RULE is the domain's (`benchmark`):
//   · the business is never one of its own peers;
//   · BELOW TEN PEERS NOTHING IS PUBLISHED — no median, no percentile — and the
//     answer says why;
//   · a business with no figure of its own gets no comparison.
//
// ⚠️ WHAT LEAVES THIS FILE: the business's own figure, the peers' MEDIAN, its
// PERCENTILE and HOW MANY peers there were. Never a peer's figure, never a
// peer's id. The rows the database function returns stay in this function.
//
// ⚠️ THERE IS NO OUTSIDE DATA. `comparisonBasis` is always
// `SAME_DEPLOYMENT_PEERS_ONLY`, and the screen must not call it «the market».
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError } from '../../errors/database.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'
import { MIN_PEERS, benchmark, benchmarkDelta, type PeerFacts } from './benchmark.domain'

const MISSING_SCHEMA = new Set(['42883', 'PGRST202'])

/** The window the rate is taken over. Stated on the screen. */
export const BENCHMARK_PERIOD_DAYS = 30

export class BenchmarkNotConfiguredError extends BaseError {
  constructor() {
    super('BENCHMARK_MIGRATION_PENDING', 503)
    this.name = 'BenchmarkNotConfiguredError'
  }
}

export interface PeerBenchmark {
  metric: 'invoiceRatePerDay'
  periodDays: number
  /** Sale invoices per day. Null when the business sold nothing in the period. */
  own: number | null
  peerMedian: number | null
  percentile: number | null
  /** How many OTHER businesses had a figure. */
  peerCount: number
  /** The fewest peers a comparison is published for. */
  minPeers: number
  unavailable: null | 'NO_SELF_FIGURE' | 'NOT_ENOUGH_PEERS' | 'NO_PEERS'
  /** `own − peerMedian`, and which side of the median the business is on. */
  delta: number | null
  direction: 'above' | 'below' | 'level' | null
  comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY'
}

const perDay = (count: number) => Math.round((count / BENCHMARK_PERIOD_DAYS) * 100) / 100

export class BenchmarkService {
  async invoiceRate(ctx: TenancyContext): Promise<PeerBenchmark> {
    type Row = { workspace_id: string; sale_count: number | string }
    // Every business, not the first thousand: a capped read would make the
    // median a median of whoever sorted first.
    const { data, error } = await selectAllPages<Row, { message: string; code?: string }>(
      (from, to) =>
        supabase.rpc('benchmark_sale_counts', { p_days: BENCHMARK_PERIOD_DAYS }).range(from, to),
    )
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) throw new BenchmarkNotConfiguredError()
      throw new DatabaseError('Failed to read the comparison figures', error)
    }

    const facts: PeerFacts[] = (data ?? []).map((row) => ({
      workspaceId: row.workspace_id,
      grossMarginPercent: null,
      netMarginPercent: null,
      invoiceRatePerDay: perDay(Number(row.sale_count) || 0),
      dso: null,
    }))

    const result = benchmark(ctx.workspaceId, 'invoiceRatePerDay', facts)
    const { delta, direction } = benchmarkDelta(result)

    // Built field by field: nothing about any other business is carried along.
    return {
      metric: 'invoiceRatePerDay',
      periodDays: BENCHMARK_PERIOD_DAYS,
      own: result.own,
      peerMedian: result.peerMedian,
      percentile: result.percentile,
      peerCount: result.peerCount,
      minPeers: MIN_PEERS,
      unavailable: result.unavailable,
      delta,
      direction,
      comparisonBasis: result.comparisonBasis,
    }
  }
}

export const benchmarkService = new BenchmarkService()
