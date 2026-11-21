// ============================================
// apps/admin/src/__tests__/monitor-stream.test.ts
//
// The stream client lifecycle (mission §6.3, §14 frontend):
//   frame parsing, auth header, single subscription, event delivery,
//   heartbeat-timeout → reconnect, backoff → fallback, stop() cleanup.
// Fetch and timers are injected — no network, no real waiting.
// ============================================

import { describe, expect, it, vi } from 'vitest'

import {
  MonitorStreamClient,
  parseSseFrame,
  type MonitorStreamEvent,
  type MonitorStreamStatus,
} from '../../lib/monitor-stream'

function sseResponse(chunks: string[], keepOpen = true, signal?: AbortSignal): Response {
  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      if (!keepOpen) controller.close()
    },
  })
  // The real fetch ties the body to the abort signal; the fake must too, or
  // the watchdog's abort() would never reach the reader.
  signal?.addEventListener('abort', () => {
    try {
      streamController?.error(new Error('aborted'))
    } catch {
      // already closed
    }
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

interface Harness {
  client: MonitorStreamClient
  events: MonitorStreamEvent[]
  statuses: MonitorStreamStatus[]
  fetchCalls: Array<{ url: string; headers: Record<string, string> }>
  timers: Array<{ fn: () => void; ms: number; cleared: boolean }>
  clock: { now: number }
  fireTimers: () => void
  respond: (chunks: string[], keepOpen?: boolean) => void
  respondStatus: (status: number) => void
  failNext: () => void
}

function harness(options: { heartbeatTimeoutMs?: number } = {}): Harness {
  const events: MonitorStreamEvent[] = []
  const statuses: MonitorStreamStatus[] = []
  const fetchCalls: Array<{ url: string; headers: Record<string, string> }> = []
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = []
  const clock = { now: 1_000_000 }
  let nextSpec: { chunks: string[]; keepOpen: boolean; status: number } = {
    chunks: ['event: snapshot\ndata: {"v":1,"cores":[]}\n\n'],
    keepOpen: true,
    status: 200,
  }
  let failNext = false

  const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
    fetchCalls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    if (failNext) {
      failNext = false
      throw new Error('network down')
    }
    if (nextSpec.status !== 200) {
      return new Response('error', { status: nextSpec.status })
    }
    return sseResponse(nextSpec.chunks, nextSpec.keepOpen, init?.signal ?? undefined)
  }) as unknown as typeof fetch

  const client = new MonitorStreamClient({
    url: 'https://api.test/admin/monitor/stream',
    getToken: () => 'test-token',
    onEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
    fetchImpl,
    now: () => clock.now,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms, cleared: false })
      return timers.length - 1
    },
    clearTimer: (handle) => {
      const timer = timers[handle as number]
      if (timer) timer.cleared = true
    },
    heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 30_000,
    baseBackoffMs: 1_000,
    maxBackoffMs: 8_000,
    fallbackAfterAttempts: 3,
  })

  return {
    client,
    events,
    statuses,
    fetchCalls,
    timers,
    clock,
    fireTimers: () => {
      const pending = timers.filter((timer) => !timer.cleared)
      for (const timer of pending) {
        timer.cleared = true
        timer.fn()
      }
    },
    respond: (chunks, keepOpen = true) => {
      nextSpec = { chunks, keepOpen, status: 200 }
    },
    respondStatus: (status) => {
      nextSpec = { chunks: [], keepOpen: false, status }
    },
    failNext: () => {
      failNext = true
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('parseSseFrame', () => {
  it('parses event + data', () => {
    expect(parseSseFrame('event: core.metrics\ndata: {"v":1,"a":2}')).toEqual({
      event: 'core.metrics',
      data: { v: 1, a: 2 },
    })
  })

  it('joins multi-line data', () => {
    expect(parseSseFrame('data: {"a":\ndata: 1}')).toEqual({ event: 'message', data: { a: 1 } })
  })

  it('rejects malformed JSON and empty frames — never throws', () => {
    expect(parseSseFrame('data: {broken')).toBeNull()
    expect(parseSseFrame('event: heartbeat')).toBeNull()
    expect(parseSseFrame('data: 42')).toBeNull()
  })
})

describe('MonitorStreamClient', () => {
  it('connects with the Authorization header and delivers the snapshot', async () => {
    const h = harness()
    h.client.start()
    await flush()
    expect(h.fetchCalls).toHaveLength(1)
    expect(h.fetchCalls[0]!.headers.Authorization).toBe('Bearer test-token')
    expect(h.fetchCalls[0]!.url).toBe('https://api.test/admin/monitor/stream')
    expect(h.events[0]).toEqual({ event: 'snapshot', data: { v: 1, cores: [] } })
    expect(h.client.getStatus().state).toBe('connected')
    expect(h.client.getStatus().lastEventAt).toBe(1_000_000)
    h.client.stop()
  })

  it('start() twice opens ONE subscription', async () => {
    const h = harness()
    h.client.start()
    h.client.start()
    await flush()
    expect(h.fetchCalls).toHaveLength(1)
    h.client.stop()
  })

  it('parses frames split across chunks', async () => {
    const h = harness()
    h.respond([
      'event: heart',
      'beat\ndata: {"v":1}\n\nevent: core.metrics\ndata: {"v":1,"x":9}\n\n',
    ])
    h.client.start()
    await flush()
    expect(h.events.map((event) => event.event)).toEqual(['heartbeat', 'core.metrics'])
    h.client.stop()
  })

  it('a silent connection past the heartbeat timeout reconnects', async () => {
    const h = harness({ heartbeatTimeoutMs: 30_000 })
    // A stream that stays open but sends nothing after the snapshot.
    h.respond(['event: snapshot\ndata: {"v":1}\n\n'], true)
    h.client.start()
    await flush()
    expect(h.client.getStatus().state).toBe('connected')

    // Advance past the timeout and run the watchdog timer.
    h.clock.now += 31_000
    h.fireTimers()
    await flush()
    expect(h.client.getStatus().state).toBe('reconnecting')
    h.client.stop()
  })

  it('network failure backs off and becomes fallback after 3 attempts', async () => {
    const h = harness()
    h.failNext()
    h.client.start()
    await flush()
    expect(h.client.getStatus().state).toBe('reconnecting')
    expect(h.client.getStatus().attempt).toBe(1)

    h.failNext()
    h.fireTimers() // reconnect attempt 2
    await flush()
    expect(h.client.getStatus().attempt).toBe(2)

    h.failNext()
    h.fireTimers() // reconnect attempt 3 → fallback (polling resumes in the hook)
    await flush()
    expect(h.client.getStatus().state).toBe('fallback')
    expect(h.fetchCalls).toHaveLength(3)

    // Backoff is capped: the next delay never exceeds maxBackoffMs.
    const delays = h.timers.filter((timer) => !timer.cleared).map((timer) => timer.ms)
    for (const delay of delays) expect(delay).toBeLessThanOrEqual(8_000)
    h.client.stop()
  })

  it('a 401 response schedules a reconnect, never a tight loop', async () => {
    const h = harness()
    h.respondStatus(401)
    h.client.start()
    await flush()
    expect(h.client.getStatus().state).toBe('reconnecting')
    expect(h.fetchCalls).toHaveLength(1)
    h.client.stop()
  })

  it('a successful reconnect resets the attempt counter and state', async () => {
    const h = harness()
    h.failNext()
    h.client.start()
    await flush()
    expect(h.client.getStatus().state).toBe('reconnecting')

    h.respond(['event: snapshot\ndata: {"v":1}\n\n'])
    h.fireTimers()
    await flush()
    expect(h.client.getStatus().state).toBe('connected')
    expect(h.client.getStatus().attempt).toBe(0)
    h.client.stop()
  })

  it('stop() aborts, clears timers and never reconnects', async () => {
    const h = harness()
    h.failNext()
    h.client.start()
    await flush()
    h.client.stop()
    expect(h.client.getStatus().state).toBe('disconnected')
    const callsBefore = h.fetchCalls.length
    h.fireTimers()
    await flush()
    expect(h.fetchCalls).toHaveLength(callsBefore)
  })

  it('a closed stream (server restart) reconnects', async () => {
    const h = harness()
    h.respond(['event: snapshot\ndata: {"v":1}\n\n'], false)
    h.client.start()
    await flush()
    await flush()
    expect(h.client.getStatus().state).toBe('reconnecting')
    h.client.stop()
  })
})
