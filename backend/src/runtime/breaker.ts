export type BreakerState = 'closed' | 'open' | 'half_open'

export interface BreakerOptions {
  name: string
  failureThreshold?: number | undefined
  resetTimeoutMs?: number | undefined
  timeoutMs?: number | undefined
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN'
  constructor(name: string) {
    super(`Circuit breaker open for dependency: ${name}`)
    this.name = 'CircuitOpenError'
  }
}

export class CircuitBreaker {
  private state: BreakerState = 'closed'
  private failures = 0
  private openedAt = 0
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly timeoutMs: number
  readonly name: string

  constructor(opts: BreakerOptions) {
    this.name = opts.name
    this.failureThreshold = opts.failureThreshold ?? 5
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000
    this.timeoutMs = opts.timeoutMs ?? 10_000
  }

  getState(now = Date.now()): BreakerState {
    if (this.state === 'open' && now - this.openedAt >= this.resetTimeoutMs) {
      this.state = 'half_open'
    }
    return this.state
  }

  async execute<T>(fn: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.state === 'open') {
      if (now - this.openedAt >= this.resetTimeoutMs) {
        this.state = 'half_open'
      } else {
        throw new CircuitOpenError(this.name)
      }
    }

    try {
      const result = await withTimeout(fn, this.timeoutMs, this.name)
      this.failures = 0
      this.state = 'closed'
      return result
    } catch (err) {
      this.failures += 1
      if (this.state === 'half_open' || this.failures >= this.failureThreshold) {
        this.state = 'open'
        this.openedAt = now
      }
      throw err
    }
  }
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`DEPENDENCY_TIMEOUT: ${label} exceeded ${timeoutMs}ms`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function retryIdempotent<T>(
  fn: () => Promise<T>,
  opts: { idempotent: boolean; maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const attempts = opts.idempotent ? (opts.maxAttempts ?? 3) : 1
  const baseDelay = opts.baseDelayMs ?? 100
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i + 1 >= attempts) break
      const jitter = Math.floor(Math.random() * baseDelay)
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i + jitter))
    }
  }
  throw lastErr
}
