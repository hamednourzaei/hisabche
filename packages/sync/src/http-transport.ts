// ============================================
// packages/sync/src/http-transport.ts
//
// The Transport implementation that talks to /api/sync.
//
// Kept behind the `Transport` interface and injected, so the engine can be
// tested against a fake that loses responses, times out and returns conflicts
// on demand — none of which is reachable through a real HTTP client.
//
// A NOTE ON WHAT COUNTS AS FAILURE
//
// Anything that is not a well-formed 200 throws. That is deliberate: the
// engine's contract is that a thrown push returns the whole batch to the
// outbox with backoff, and a batch whose fate is unknown MUST be retried. The
// stable mutation_id is what makes retrying a possibly-committed batch safe.
// ============================================

import type { SyncChange, SyncMutation } from '@hisabche/validation'

import type { PushOutcome, Transport } from './types'

export interface HttpTransportOptions {
  /** Already includes `/api` — see the note in CLAUDE.md about this trap. */
  baseUrl: string
  /** Returns the current bearer token, re-read per request so refresh works. */
  getToken: () => string | null | undefined
  fetchImpl?: typeof fetch
  /** Aborts a request that has stopped making progress. */
  timeoutMs?: number
}

interface PushResponseBody {
  batchId: string
  results: PushOutcome[]
  currentCursor: number
}

interface PullResponseBody {
  // Typed as the protocol's own `SyncChange`, not as loose strings. The server
  // is the only writer of this shape and validates it on the way out, so
  // re-widening it here would only push the narrowing onto every caller.
  changes: SyncChange[]
  nextCursor: number
  hasMore: boolean
  mustRehydrate: boolean
}

export class HttpTransport implements Transport {
  private readonly baseUrl: string
  private readonly getToken: () => string | null | undefined
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: HttpTransportOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.getToken = options.getToken
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  private async request<T>(path: string, init: RequestInit & { deviceId: string }): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const token = this.getToken()

      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-hisabche-device': init.deviceId,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      })

      if (!response.ok) {
        // Read the body for the message but do not try to interpret it as a
        // result — a non-200 means the batch outcome is unknown.
        const text = await response.text().catch(() => '')
        throw new Error(`sync ${path} failed: ${response.status} ${text.slice(0, 200)}`)
      }

      return (await response.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  async push(
    batchId: string,
    deviceId: string,
    mutations: SyncMutation[],
  ): Promise<{ results: PushOutcome[]; currentCursor: number }> {
    const body = await this.request<PushResponseBody>('/sync/push', {
      method: 'POST',
      deviceId,
      body: JSON.stringify({ deviceId, batchId, mutations }),
    })

    return { results: body.results ?? [], currentCursor: body.currentCursor ?? 0 }
  }

  async pull(
    cursor: number,
    limit: number,
    deviceId: string,
  ): Promise<{
    changes: SyncChange[]
    nextCursor: number
    hasMore: boolean
    mustRehydrate: boolean
  }> {
    const query = new URLSearchParams({
      cursor: String(cursor),
      limit: String(limit),
      deviceId,
    })

    const body = await this.request<PullResponseBody>(`/sync/pull?${query}`, {
      method: 'GET',
      deviceId,
    })

    return {
      changes: body.changes ?? [],
      // Falling back to the cursor we sent, never to 0: a malformed response
      // must not rewind a client to the beginning of history.
      nextCursor: body.nextCursor ?? cursor,
      hasMore: Boolean(body.hasMore),
      mustRehydrate: Boolean(body.mustRehydrate),
    }
  }
}
