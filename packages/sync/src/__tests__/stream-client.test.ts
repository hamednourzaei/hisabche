import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { connectSyncStream, streamUrl, type SocketLike, STREAM_PROTOCOL } from '../stream-client'
import { decodeFrame, encodeFrame, Op } from '../wire'

type Listener = (event: { data?: unknown; code?: number }) => void

class FakeSocket implements SocketLike {
  binaryType = 'blob'
  readyState = 0
  sent: Uint8Array[] = []
  listeners = new Map<string, Listener[]>()
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  emit(type: string, event: { data?: unknown; code?: number } = {}) {
    for (const l of this.listeners.get(type) ?? []) l(event)
  }
  send(data: Uint8Array) {
    this.sent.push(data)
  }
  close(code = 1000) {
    this.readyState = 3
    this.emit('close', { code })
  }
  serverOpens() {
    this.readyState = 1
    this.emit('open')
  }
  serverSends(op: (typeof Op)[keyof typeof Op], body: unknown) {
    const bytes = encodeFrame(op, body as never)
    this.emit('message', {
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    })
  }
}

let sockets: FakeSocket[] = []
const factory = (url: string, protocols: string[]) => {
  const s = new FakeSocket(url, protocols)
  sockets.push(s)
  return s
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

beforeEach(() => {
  sockets = []
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('connectSyncStream', () => {
  it('offers the protocol and the token as subprotocols — never in the URL', async () => {
    const handle = connectSyncStream({
      url: 'wss://api/x',
      getToken: () => 'tok.en',
      getCursor: () => 0,
      onWake: () => undefined,
      createSocket: factory,
    })
    await flush()
    expect(sockets[0]!.url).toBe('wss://api/x')
    expect(sockets[0]!.protocols).toEqual([STREAM_PROTOCOL, 'hisabche.bearer.tok.en'])
    handle.stop()
  })

  it('sends HELLO with the applied cursor on open, and wakes on CURSOR', async () => {
    const wakes: Array<[string, number]> = []
    const handle = connectSyncStream({
      url: 'wss://api/x',
      getToken: () => 't',
      getCursor: () => 41,
      onWake: (reason, cursor) => wakes.push([reason, cursor]),
      createSocket: factory,
    })
    await flush()
    sockets[0]!.serverOpens()
    await flush()
    expect(decodeFrame(sockets[0]!.sent[0]!)).toEqual({ op: Op.HELLO, body: { cursor: 41 } })
    sockets[0]!.serverSends(Op.CURSOR, { cursor: 44 })
    expect(wakes).toEqual([['stream:cursor', 44]])
    handle.stop()
  })

  it('answers PING with PONG', async () => {
    const handle = connectSyncStream({
      url: 'u',
      getToken: () => 't',
      getCursor: () => 0,
      onWake: () => undefined,
      createSocket: factory,
    })
    await flush()
    sockets[0]!.serverOpens()
    await flush()
    sockets[0]!.serverSends(Op.PING, { t: 9 })
    expect(decodeFrame(sockets[0]!.sent.at(-1)!)).toEqual({ op: Op.PONG, body: { t: 9 } })
    handle.stop()
  })

  it('reconnects after a close, with growing delay', async () => {
    const handle = connectSyncStream({
      url: 'u',
      getToken: () => 't',
      getCursor: () => 0,
      onWake: () => undefined,
      createSocket: factory,
      random: () => 1,
    })
    await flush()
    sockets[0]!.close(1006)
    await vi.advanceTimersByTimeAsync(999)
    expect(sockets).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sockets).toHaveLength(2) // 1s
    sockets[1]!.close(1006)
    await vi.advanceTimersByTimeAsync(1999)
    expect(sockets).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(sockets).toHaveLength(3) // 2s
    handle.stop()
  })

  it('a silent connection is closed and replaced', async () => {
    const handle = connectSyncStream({
      url: 'u',
      getToken: () => 't',
      getCursor: () => 0,
      onWake: () => undefined,
      createSocket: factory,
      random: () => 0,
    })
    await flush()
    sockets[0]!.serverOpens()
    sockets[0]!.serverSends(Op.READY, { cursor: 0, heartbeatMs: 1000 })
    await vi.advanceTimersByTimeAsync(7_001) // 2 × 1s + 5s of silence
    expect(sockets[0]!.readyState).toBe(3)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sockets.length).toBeGreaterThan(1)
    handle.stop()
  })

  it('no token → no socket, retried later', async () => {
    let token: string | null = null
    const handle = connectSyncStream({
      url: 'u',
      getToken: () => token,
      getCursor: () => 0,
      onWake: () => undefined,
      createSocket: factory,
      random: () => 1,
    })
    await flush()
    expect(sockets).toHaveLength(0)
    token = 't'
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sockets).toHaveLength(1)
    handle.stop()
  })

  it('stop() closes and never reconnects', async () => {
    const handle = connectSyncStream({
      url: 'u',
      getToken: () => 't',
      getCursor: () => 0,
      onWake: () => undefined,
      createSocket: factory,
    })
    await flush()
    handle.stop()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sockets).toHaveLength(1)
  })
})

describe('streamUrl', () => {
  it('turns the API base into the ws(s) stream address', () => {
    expect(streamUrl('https://api.hisabche.com/api', 'w-1')).toBe(
      'wss://api.hisabche.com/api/sync/stream?workspaceId=w-1',
    )
    expect(streamUrl('http://localhost:3001/api/', 'w 2')).toBe(
      'ws://localhost:3001/api/sync/stream?workspaceId=w%202',
    )
  })
})
