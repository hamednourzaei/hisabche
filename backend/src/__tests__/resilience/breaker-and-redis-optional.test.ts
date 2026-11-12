import { describe, expect, it, vi } from 'vitest'
import { CircuitBreaker, CircuitOpenError, retryIdempotent } from '../../runtime/breaker'

describe('C.4.6 & C.4.7 Circuit breaker, Retry safety, Redis optional', () => {
  it('opens after threshold, fails fast, and closes after half-open probe succeeds', async () => {
    const breaker = new CircuitBreaker({ name: 'email', failureThreshold: 2, resetTimeoutMs: 50 })
    await expect(
      breaker.execute(async () => {
        throw new Error('down')
      }, 1000),
    ).rejects.toThrow()
    await expect(
      breaker.execute(async () => {
        throw new Error('down')
      }, 1010),
    ).rejects.toThrow()
    expect(breaker.getState(1015)).toBe('open')

    await expect(breaker.execute(async () => 'ok', 1020)).rejects.toBeInstanceOf(CircuitOpenError)

    // After resetTimeoutMs -> half_open probe succeeds -> closed
    const res = await breaker.execute(async () => 'recovered', 1100)
    expect(res).toBe('recovered')
    expect(breaker.getState()).toBe('closed')
  })

  it('never retries non-idempotent calls', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(retryIdempotent(fn, { idempotent: false, maxAttempts: 3 })).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
