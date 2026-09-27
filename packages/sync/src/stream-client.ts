// ============================================
// packages/sync/src/stream-client.ts
//
// The client end of `/api/sync/stream` (request #153): one persistent
// WebSocket per signed-in workspace that turns «the head moved» into a wake,
// exactly like wakeup.ts turns «online» or «focus» into one.
//
// It carries no data and owns no correctness. The engine pulls by cursor over
// HTTP; this only changes WHEN it finds out. So every failure here degrades to
// «slower», never to «wrong»: a refused token, a dropped socket, a server
// without the endpoint — all end in the same place, the interval and lifecycle
// wakes the app already has.
//
//   open → HELLO{cursor} → (READY, CURSOR…) → wake('stream:cursor')
//   close → reconnect after backoff (1s, 2s, 4s … 60s, with jitter)
//   silence past two heartbeats → close → reconnect
// ============================================

import { decodeFrame, encodeFrame, Op } from './wire'

export const STREAM_PROTOCOL = 'hisabche.v1'
const BEARER_PREFIX = 'hisabche.bearer.'

/** The subset of the browser WebSocket this needs; injected in tests. */
export interface SocketLike {
  binaryType: string
  readonly readyState: number
  send(data: Uint8Array): void
  close(code?: number, reason?: string): void
  addEventListener(
    type: 'open' | 'close' | 'error' | 'message',
    listener: (event: { data?: unknown; code?: number }) => void,
  ): void
}
export type SocketFactory = (url: string, protocols: string[]) => SocketLike

export interface StreamOptions {
  /** e.g. wss://api.hisabche.com/api/sync/stream?workspaceId=… */
  url: string
  /** The current access token, read fresh on every (re)connect. */
  getToken: () => string | null | Promise<string | null>
  /** The cursor this device has applied, sent in HELLO. */
  getCursor: () => number | Promise<number>
  /** Called when the server says the workspace moved past our cursor. */
  onWake: (reason: string, cursor: number) => void
  createSocket?: SocketFactory
  /** Reconnect backoff bounds (ms). */
  minDelayMs?: number
  maxDelayMs?: number
  random?: () => number
  log?: (event: string, data: Record<string, unknown>) => void
}

export interface StreamHandle {
  stop(): void
  /** Test/diagnostic: connected right now? */
  readonly connected: boolean
}

const OPEN = 1

export function connectSyncStream(options: StreamOptions): StreamHandle {
  const {
    url,
    getToken,
    getCursor,
    onWake,
    minDelayMs = 1_000,
    maxDelayMs = 60_000,
    random = Math.random,
    log,
  } = options
  const createSocket: SocketFactory =
    options.createSocket ??
    ((u, p) => {
      if (typeof WebSocket === 'undefined') throw new Error('no WebSocket in this runtime')
      return new WebSocket(u, p) as unknown as SocketLike
    })

  let stopped = false
  let socket: SocketLike | null = null
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let connected = false
  let heartbeatMs = 25_000

  const armSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    // Two missed heartbeats: the connection is dead even if nobody said so
    // (a laptop lid, a NAT that forgot us). Closing makes the reconnect happen.
    silenceTimer = setTimeout(() => socket?.close(4000, 'silent'), heartbeatMs * 2 + 5_000)
  }

  const scheduleReconnect = (why: string) => {
    connected = false
    if (silenceTimer) clearTimeout(silenceTimer)
    if (stopped || retryTimer) return
    const base = Math.min(maxDelayMs, minDelayMs * 2 ** attempt)
    // Full jitter: a server restart must not see every device return in the same second.
    const delay = Math.round(base / 2 + random() * (base / 2))
    attempt += 1
    log?.('sync.stream_retry', { why, delay, attempt })
    retryTimer = setTimeout(() => {
      retryTimer = null
      void open()
    }, delay)
  }

  const open = async () => {
    if (stopped) return
    let token: string | null
    try {
      token = await getToken()
    } catch {
      token = null
    }
    if (!token) return scheduleReconnect('no_token')

    let s: SocketLike
    try {
      s = createSocket(url, [STREAM_PROTOCOL, `${BEARER_PREFIX}${token}`])
    } catch (err) {
      log?.('sync.stream_unavailable', { error: (err as Error).message })
      return scheduleReconnect('create_failed')
    }
    socket = s
    s.binaryType = 'arraybuffer'

    s.addEventListener('open', () => {
      connected = true
      attempt = 0
      armSilence()
      void Promise.resolve(getCursor()).then(
        (cursor) => {
          if (s.readyState === OPEN) s.send(encodeFrame(Op.HELLO, { cursor }))
        },
        () => undefined,
      )
    })

    s.addEventListener('message', (event) => {
      // Re-armed AFTER the frame is read, so a READY that announces the
      // server's heartbeat applies to this very wait, not the next one.
      try {
        handleMessage(event.data)
      } finally {
        armSilence()
      }
    })

    const handleMessage = (data: unknown) => {
      if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) return
      let frame
      try {
        frame = decodeFrame(data instanceof Uint8Array ? data : new Uint8Array(data))
      } catch {
        return // not ours; the server never sends this, so ignore rather than loop
      }
      const body = (frame.body ?? {}) as { cursor?: unknown; heartbeatMs?: unknown; code?: unknown }
      switch (frame.op) {
        case Op.READY: {
          if (typeof body.heartbeatMs === 'number' && body.heartbeatMs > 0)
            heartbeatMs = body.heartbeatMs
          break
        }
        case Op.CURSOR: {
          const cursor = Number(body.cursor)
          if (Number.isSafeInteger(cursor)) onWake('stream:cursor', cursor)
          break
        }
        case Op.PING:
          if (s.readyState === OPEN) s.send(encodeFrame(Op.PONG, frame.body))
          break
        case Op.ERROR:
          log?.('sync.stream_error', { code: String(body.code ?? '') })
          break
        default:
          break
      }
    }

    s.addEventListener('close', (event) => {
      if (socket === s) socket = null
      scheduleReconnect(`closed:${event.code ?? 0}`)
    })
    // `error` is always followed by `close`; reconnecting happens there.
    s.addEventListener('error', () => undefined)
  }

  void open()

  return {
    stop() {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      if (silenceTimer) clearTimeout(silenceTimer)
      socket?.close(1000, 'stopped')
      socket = null
      connected = false
    },
    get connected() {
      return connected
    },
  }
}

/** https://api.x/api → wss://api.x/api/sync/stream?workspaceId=… */
export function streamUrl(apiBaseUrl: string, workspaceId: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '').replace(/^http/, 'ws')
  return `${base}/sync/stream?workspaceId=${encodeURIComponent(workspaceId)}`
}
