// ============================================
// apps/admin/lib/monitor-stream.ts
//
// The REAL consumer of GET /api/admin/monitor/stream (mission §6). The old
// admin SSE was removed on 12 Nov because nothing consumed it; this client is
// the reason it returns. Fetch-based SSE (not EventSource) because the
// credential is the normal Authorization header — a token in the query string
// is forbidden.
//
// CONTRACT
//   - one subscription per client; start() twice is a no-op;
//   - initial `snapshot` renders immediately, then live events;
//   - heartbeat watchdog: no event for `heartbeatTimeoutMs` → the connection
//     is presumed dead → abort + reconnect (stale data is never «live»);
//   - reconnect with exponential backoff + jitter, capped;
//   - after `fallbackAfterAttempts` failed attempts the state becomes
//     `fallback` so the hook can enable controlled polling — the client keeps
//     trying to restore the stream at the capped interval;
//   - stop() aborts, clears every timer and never reconnects (unmount-safe).
//
// The class imports nothing from React or the API package: fetch, timers and
// the token getter are injected, so the whole lifecycle is unit-testable.
// ============================================

export type MonitorStreamState =
  'connecting' | 'connected' | 'reconnecting' | 'fallback' | 'disconnected'

export interface MonitorStreamEvent {
  event: string
  data: Record<string, unknown>
}

export interface MonitorStreamStatus {
  state: MonitorStreamState
  lastEventAt: number | null
  attempt: number
}

export interface MonitorStreamOptions {
  url: string
  getToken: () => string | null
  onEvent: (event: MonitorStreamEvent) => void
  onStatus: (status: MonitorStreamStatus) => void
  fetchImpl?: typeof fetch
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  heartbeatTimeoutMs?: number
  baseBackoffMs?: number
  maxBackoffMs?: number
  fallbackAfterAttempts?: number
}

/** Parse one SSE frame block (`event:` + `data:` lines). Malformed → null. */
export function parseSseFrame(block: string): MonitorStreamEvent | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (dataLines.length === 0) return null
  try {
    const data = JSON.parse(dataLines.join('\n')) as unknown
    if (data === null || typeof data !== 'object') return null
    return { event, data: data as Record<string, unknown> }
  } catch {
    return null
  }
}

export class MonitorStreamClient {
  private readonly options: Required<
    Pick<
      MonitorStreamOptions,
      'heartbeatTimeoutMs' | 'baseBackoffMs' | 'maxBackoffMs' | 'fallbackAfterAttempts'
    >
  > &
    MonitorStreamOptions

  private controller: AbortController | null = null
  private reconnectHandle: unknown = null
  private watchdogHandle: unknown = null
  private running = false
  private attempt = 0
  private lastEventAt: number | null = null
  private state: MonitorStreamState = 'disconnected'

  constructor(options: MonitorStreamOptions) {
    this.options = {
      heartbeatTimeoutMs: 30_000,
      baseBackoffMs: 1_000,
      maxBackoffMs: 30_000,
      fallbackAfterAttempts: 3,
      ...options,
    }
  }

  getStatus(): MonitorStreamStatus {
    return { state: this.state, lastEventAt: this.lastEventAt, attempt: this.attempt }
  }

  /** Idempotent: a second start() while running does not open a second stream. */
  start(): void {
    if (this.running) return
    this.running = true
    this.attempt = 0
    void this.connect()
  }

  stop(): void {
    this.running = false
    this.controller?.abort()
    this.controller = null
    this.clearReconnect()
    this.clearWatchdog()
    this.setState('disconnected')
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now()
  }

  private setTimer(fn: () => void, ms: number): unknown {
    return this.options.setTimer ? this.options.setTimer(fn, ms) : setTimeout(fn, ms)
  }

  private clearTimer(handle: unknown): void {
    if (handle === null) return
    if (this.options.clearTimer) this.options.clearTimer(handle)
    else clearTimeout(handle as ReturnType<typeof setTimeout>)
  }

  private setState(state: MonitorStreamState): void {
    this.state = state
    this.options.onStatus(this.getStatus())
  }

  private clearReconnect(): void {
    this.clearTimer(this.reconnectHandle)
    this.reconnectHandle = null
  }

  private clearWatchdog(): void {
    this.clearTimer(this.watchdogHandle)
    this.watchdogHandle = null
  }

  private scheduleReconnect(): void {
    if (!this.running) return
    this.clearWatchdog()
    this.attempt += 1
    const backoff = Math.min(
      this.options.maxBackoffMs,
      this.options.baseBackoffMs * 2 ** (this.attempt - 1),
    )
    // Jitter avoids a thundering herd when the server restarts and every
    // viewer reconnects on the same millisecond.
    const delay = backoff / 2 + Math.random() * (backoff / 2)
    this.setState(this.attempt >= this.options.fallbackAfterAttempts ? 'fallback' : 'reconnecting')
    this.clearReconnect()
    this.reconnectHandle = this.setTimer(() => {
      this.reconnectHandle = null
      if (this.running) void this.connect()
    }, delay)
  }

  private startWatchdog(): void {
    this.clearWatchdog()
    const check = () => {
      if (!this.running) return
      const last = this.lastEventAt
      if (last !== null && this.now() - last > this.options.heartbeatTimeoutMs) {
        // Silent connection: abort and reconnect. The UI shows reconnecting,
        // never «live» beside stale numbers.
        this.controller?.abort()
        return
      }
      this.watchdogHandle = this.setTimer(check, this.options.heartbeatTimeoutMs / 3)
    }
    this.watchdogHandle = this.setTimer(check, this.options.heartbeatTimeoutMs / 3)
  }

  private async connect(): Promise<void> {
    if (!this.running) return
    this.setState(this.attempt === 0 ? 'connecting' : this.state)
    const controller = new AbortController()
    this.controller = controller
    const fetchImpl = this.options.fetchImpl ?? fetch
    const token = this.options.getToken()

    let res: Response
    try {
      res = await fetchImpl(this.options.url, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      })
    } catch {
      if (this.running && !controller.signal.aborted) this.scheduleReconnect()
      return
    }

    if (!res.ok || !res.body) {
      // 401/403 will not fix themselves by retrying fast; backoff still applies
      // (the session may be refreshed by the normal API layer meanwhile).
      if (this.running) this.scheduleReconnect()
      return
    }

    this.attempt = 0
    this.lastEventAt = this.now()
    this.setState('connected')
    this.startWatchdog()

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let separator = buffer.indexOf('\n\n')
        while (separator !== -1) {
          const block = buffer.slice(0, separator)
          buffer = buffer.slice(separator + 2)
          const frame = parseSseFrame(block)
          if (frame) {
            this.lastEventAt = this.now()
            this.options.onEvent(frame)
          }
          separator = buffer.indexOf('\n\n')
        }
      }
    } catch {
      // aborted or network drop — fall through to reconnect
    }
    if (this.running) this.scheduleReconnect()
  }
}
