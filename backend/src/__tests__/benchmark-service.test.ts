// ============================================
// benchmark.service — one business beside the others on this deployment.
//
// The arithmetic is the domain's (benchmark.test.ts). What can go wrong HERE:
// a median published for three businesses, the business counted among its own
// peers, another business's id or figure leaving the service, the first
// thousand rows read as «everyone», and a missing function answered as «no
// peers».
//
// Hand-checked figures: 30 sales in 30 days = 1.00 a day.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { workspace_id: string; sale_count: number }
let rows: Row[] = []
let rpcError: { code: string; message: string } | null = null
const ranges: Array<[number, number]> = []

vi.mock('../db', () => ({
  supabase: {
    rpc: (name: string, args: { p_days: number }) => ({
      range: async (from: number, to: number) => {
        if (name !== 'benchmark_sale_counts' || args.p_days !== 30) {
          throw new Error(`unexpected rpc ${name} ${JSON.stringify(args)}`)
        }
        ranges.push([from, to])
        if (rpcError) return { data: null, error: rpcError }
        return { data: rows.slice(from, to + 1), error: null }
      },
    }),
  },
}))

import { BenchmarkService } from '../services/analytics/benchmark.service'

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ctx = { workspaceId: ME, userId: 'u1', role: 'owner' } as never
const peer = (index: number, count: number): Row => ({
  workspace_id: `peer-${String(index).padStart(4, '0')}`,
  sale_count: count,
})

let service: BenchmarkService
beforeEach(() => {
  rows = []
  rpcError = null
  ranges.length = 0
  service = new BenchmarkService()
})

describe('enough peers', () => {
  it('publishes the median, the percentile and the difference — and nothing about any one peer', async () => {
    // Ten peers at 30, 60, … 300 sales → 1, 2, … 10 a day. Median 5.5.
    rows = [
      { workspace_id: ME, sale_count: 240 },
      ...Array.from({ length: 10 }, (_, index) => peer(index, (index + 1) * 30)),
    ]
    const result = await service.invoiceRate(ctx)
    expect(result).toEqual({
      metric: 'invoiceRatePerDay',
      periodDays: 30,
      own: 8,
      peerMedian: 5.5,
      // Seven peers below 8, one equal: (7 + 0.5) / 10.
      percentile: 75,
      peerCount: 10,
      minPeers: 10,
      unavailable: null,
      delta: 2.5,
      direction: 'above',
      comparisonBasis: 'SAME_DEPLOYMENT_PEERS_ONLY',
    })
    const sent = JSON.stringify(result)
    expect(sent).not.toContain('peer-')
    expect(sent).not.toContain(ME)
  })

  it('the business is not one of its own peers', async () => {
    // Nine others + the business itself is NINE peers, not ten.
    rows = [
      { workspace_id: ME, sale_count: 30 },
      ...Array.from({ length: 9 }, (_, index) => peer(index, 60)),
    ]
    const result = await service.invoiceRate(ctx)
    expect(result.peerCount).toBe(9)
    expect(result.unavailable).toBe('NOT_ENOUGH_PEERS')
  })
})

describe('not enough to compare', () => {
  it('below ten peers nothing is published, and the answer says why', async () => {
    rows = [
      { workspace_id: ME, sale_count: 90 },
      ...Array.from({ length: 3 }, (_, index) => peer(index, 60)),
    ]
    expect(await service.invoiceRate(ctx)).toMatchObject({
      own: 3,
      peerMedian: null,
      percentile: null,
      delta: null,
      direction: null,
      peerCount: 3,
      unavailable: 'NOT_ENOUGH_PEERS',
    })
  })

  it('alone on the deployment: no peers — and its own figure is NOT shown as the median', async () => {
    rows = [{ workspace_id: ME, sale_count: 90 }]
    const result = await service.invoiceRate(ctx)
    expect(result).toMatchObject({
      own: 3,
      peerMedian: null,
      peerCount: 0,
      unavailable: 'NO_PEERS',
    })
  })

  it('a business that sold nothing in the period has no figure, and gets no comparison', async () => {
    rows = Array.from({ length: 12 }, (_, index) => peer(index, 60))
    expect(await service.invoiceRate(ctx)).toMatchObject({
      own: null,
      peerMedian: null,
      percentile: null,
      unavailable: 'NO_SELF_FIGURE',
    })
  })
})

describe('reading', () => {
  it('reads EVERY business, not the first page', async () => {
    // 2,500 peers: more than any one page. The last ones sell far more.
    rows = [
      { workspace_id: ME, sale_count: 30 },
      ...Array.from({ length: 2_500 }, (_, index) => peer(index, index < 1_000 ? 30 : 300)),
    ]
    const result = await service.invoiceRate(ctx)
    expect(result.peerCount).toBe(2_500)
    // Read from the first page alone the median would be 1; over everyone it is 10.
    expect(result.peerMedian).toBe(10)
    expect(ranges.length).toBeGreaterThan(1)
  })

  it('a missing function is «not set up», never «no peers»', async () => {
    rpcError = { code: 'PGRST202', message: 'Could not find the function' }
    await expect(service.invoiceRate(ctx)).rejects.toMatchObject({
      message: 'BENCHMARK_MIGRATION_PENDING',
      statusCode: 503,
    })
  })

  it('a failed read is an error, not an empty comparison', async () => {
    rpcError = { code: '57014', message: 'timeout' }
    await expect(service.invoiceRate(ctx)).rejects.toThrow('Failed to read the comparison figures')
  })
})
