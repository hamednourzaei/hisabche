import { describe, expect, it } from 'vitest'
import { checkWebVersionSkew, retryChunkLoad } from '../../../../apps/web/lib/web-updater-adapter'

describe('Slice S3 — Web skew detection, chunk retry & financial deferral', () => {
  it('detects version skew, defers during active financial operations, and recommends reload once idle', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ buildId: 'build-v2' }), { status: 200 })

    const deferred = await checkWebVersionSkew({
      runningBuildId: 'build-v1',
      hasActiveFinancialOperation: () => true,
      fetchFn: fakeFetch,
    })
    expect(deferred.status).toBe('DEFERRED_FINANCIAL_OP')
    expect(deferred.serverBuildId).toBe('build-v2')

    const ready = await checkWebVersionSkew({
      runningBuildId: 'build-v1',
      hasActiveFinancialOperation: () => false,
      fetchFn: fakeFetch,
    })
    expect(ready.status).toBe('RELOAD_RECOMMENDED')
  })

  it('never fails normal operation when /api/version check fails', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('network down')
    }
    const res = await checkWebVersionSkew({
      runningBuildId: 'build-v1',
      hasActiveFinancialOperation: () => false,
      fetchFn: failingFetch,
    })
    expect(res.status).toBe('CHECK_FAILED')
  })

  it('retries failed dynamic chunk loads with bounded backoff and succeeds on recovery', async () => {
    let calls = 0
    const delays: number[] = []
    const result = await retryChunkLoad(
      async () => {
        calls += 1
        if (calls < 3) {
          const err = new Error('Loading chunk 42 failed')
          err.name = 'ChunkLoadError'
          throw err
        }
        return 'ok-module'
      },
      {
        maxRetries: 2,
        baseDelayMs: 50,
        sleepFn: async (ms) => {
          delays.push(ms)
        },
      },
    )
    expect(result).toBe('ok-module')
    expect(calls).toBe(3)
    expect(delays).toEqual([50, 100])
  })
})
