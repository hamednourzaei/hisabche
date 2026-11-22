// ============================================
// backend/src/__tests__/core-gauges.test.ts
//
// Verification of core queue latency, bounded retry counting,
// and outbox delivery gauge sampling.
// ============================================

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { sampleCoreGauges } from '../services/monitoring/core-gauges'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../db', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

describe('Core Gauges & Queue Latency Measurement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('measures queueWaitTotalMs as 0 when queue is empty', async () => {
    mockFrom.mockImplementation((_table: string) => ({
      select: () => ({
        eq: () => ({
          count: 0,
          error: null,
          lt: () => ({ count: 0, error: null }),
        }),
        in: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }))

    const now = new Date('2026-11-22T12:00:00.000Z')
    const sample = await sampleCoreGauges(now)
    const jobsCore = sample.cores.find((c) => c.coreId === 'jobs')
    const notifsCore = sample.cores.find((c) => c.coreId === 'notifications')

    expect(jobsCore?.queueDepth).toBe(0)
    expect(jobsCore?.queueWaitTotalMs).toBe(0)
    expect(notifsCore?.queueDepth).toBe(0)
    expect(notifsCore?.queueWaitTotalMs).toBe(0)
  })

  it('calculates real wait latency from the oldest pending item when queue has items', async () => {
    const now = new Date('2026-11-22T12:00:00.000Z')
    const createdAt = new Date('2026-11-22T11:58:30.000Z').toISOString() // 90 seconds ago

    mockFrom.mockImplementation((_table: string) => ({
      select: (fields?: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return {
            eq: (_col: string, val: string) => ({
              count: val === 'pending' ? 5 : 0,
              error: null,
              lt: () => ({ count: 0, error: null }),
            }),
          }
        }
        return {
          in: () => ({
            limit: () =>
              Promise.resolve({
                data: [{ retry_count: 2 }, { retry_count: 3 }, { attempts: 1 }],
                error: null,
              }),
          }),
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { created_at: createdAt, scheduled_at: null },
                  error: null,
                }),
              }),
            }),
          }),
        }
      },
    }))

    const sample = await sampleCoreGauges(now)
    const jobsCore = sample.cores.find((c) => c.coreId === 'jobs')
    expect(jobsCore?.queueDepth).toBe(5)
    expect(jobsCore?.retryCount).toBe(5)
    expect(jobsCore?.queueWaitTotalMs).toBe(90_000) // 90,000 ms = 90s
  })
})
