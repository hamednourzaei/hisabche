// The sync wake-up stream over a REAL socket: a listening Fastify server and
// Node's browser-standard WebSocket client (the same API the desktop renderer
// uses). Proves: the token rides the subprotocol and goes through the real
// preHandlers; no token → no socket; the server announces the head, answers
// PING, tells a HELLO-ing client it is behind, pushes CURSOR when the head
// moves — and never echoes the token back.
import Fastify, { type FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFrame, encodeFrame, Op, type Frame } from '@hisabche/sync/wire'

const WS_ID = '22222222-2222-4222-8222-222222222222'
const GOOD_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJl'

vi.mock('../middleware/auth.middleware', () => ({
  // The real middleware's contract: 401 without a valid Authorization header.
  authenticate: async (
    request: { headers: Record<string, string | undefined>; userId?: string },
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  ) => {
    if (request.headers.authorization !== `Bearer ${GOOD_TOKEN}`) {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }
    request.userId = 'u-1'
    return undefined
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy: unknown }) => {
    request.tenancy = { workspaceId: WS_ID, userId: 'u-1', role: 'owner' }
  },
}))
vi.mock('../services/tenancy.service', () => ({ requireWorkspace: vi.fn(async () => ({})) }))

const head = vi.hoisted(() => ({ value: 10 }))
vi.mock('../services/sync.service', () => ({
  syncService: { currentCursor: vi.fn(async () => head.value) },
}))

const { syncStreamRoutes, STREAM_PROTOCOL } = await import('../routes/sync-stream.routes')
const { cursorWatcher } = await import('../services/sync-stream')

let app: FastifyInstance
let url = ''

beforeAll(async () => {
  app = Fastify()
  await app.register(syncStreamRoutes)
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  if (!address || typeof address === 'string') throw new Error('no port')
  url = `ws://127.0.0.1:${address.port}/api/sync/stream?workspaceId=${WS_ID}`
})
afterAll(async () => {
  cursorWatcher.stopAll()
  await app.close()
})
beforeEach(() => {
  head.value = 10
})

/** Open a socket and collect decoded frames. */
function connect(protocols: string[]) {
  const socket = new WebSocket(url, protocols)
  socket.binaryType = 'arraybuffer'
  const frames: Frame[] = []
  const waiters: Array<() => void> = []
  socket.addEventListener('message', (event) => {
    frames.push(decodeFrame(new Uint8Array(event.data as ArrayBuffer)))
    waiters.splice(0).forEach((w) => w())
  })
  const next = (predicate: (f: Frame) => boolean, timeoutMs = 4000) =>
    new Promise<Frame>((resolve, reject) => {
      const check = () => {
        const hit = frames.find(predicate)
        if (hit) {
          frames.splice(frames.indexOf(hit), 1)
          resolve(hit)
          return true
        }
        return false
      }
      if (check()) return
      const timer = setTimeout(() => reject(new Error('timed out waiting for a frame')), timeoutMs)
      const wait = () => {
        if (check()) clearTimeout(timer)
        else waiters.push(wait)
      }
      waiters.push(wait)
    })
  const opened = new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve())
    socket.addEventListener('error', () => reject(new Error('socket error')))
  })
  return { socket, next, opened }
}

describe('/api/sync/stream', () => {
  it('no token → the upgrade is refused (the real preHandler answered 401)', async () => {
    const { opened } = connect([STREAM_PROTOCOL])
    await expect(opened).rejects.toThrow()
  })

  it('a wrong token is refused the same way', async () => {
    const { opened } = connect([STREAM_PROTOCOL, 'hisabche.bearer.not-a-real-token'])
    await expect(opened).rejects.toThrow()
  })

  it('with the token: READY carries the head, and the token is never echoed', async () => {
    const { socket, next, opened } = connect([STREAM_PROTOCOL, `hisabche.bearer.${GOOD_TOKEN}`])
    await opened
    expect(socket.protocol).toBe(STREAM_PROTOCOL)
    const ready = await next((f) => f.op === Op.READY)
    expect(ready.body).toMatchObject({ cursor: 10 })
    socket.close()
  })

  it('answers PING with PONG carrying the same body', async () => {
    const { socket, next, opened } = connect([STREAM_PROTOCOL, `hisabche.bearer.${GOOD_TOKEN}`])
    await opened
    await next((f) => f.op === Op.READY)
    socket.send(encodeFrame(Op.PING, { t: 123 }))
    const pong = await next((f) => f.op === Op.PONG)
    expect(pong.body).toEqual({ t: 123 })
    socket.close()
  })

  it('HELLO with an old cursor → told the current head at once', async () => {
    const { socket, next, opened } = connect([STREAM_PROTOCOL, `hisabche.bearer.${GOOD_TOKEN}`])
    await opened
    await next((f) => f.op === Op.READY)
    socket.send(encodeFrame(Op.HELLO, { cursor: 4 }))
    const cursor = await next((f) => f.op === Op.CURSOR)
    expect(cursor.body).toEqual({ cursor: 10 })
    socket.close()
  })

  it('a moved head reaches the socket (nudge = a push on this instance)', async () => {
    const { socket, next, opened } = connect([STREAM_PROTOCOL, `hisabche.bearer.${GOOD_TOKEN}`])
    await opened
    await next((f) => f.op === Op.READY)
    socket.send(encodeFrame(Op.HELLO, { cursor: 10 }))
    head.value = 17
    cursorWatcher.nudge(WS_ID)
    const cursor = await next(
      (f) => f.op === Op.CURSOR && (f.body as { cursor: number }).cursor === 17,
    )
    expect(cursor.body).toEqual({ cursor: 17 })
    socket.close()
  })

  it('a text frame closes the socket — binary only', async () => {
    const { socket, next, opened } = connect([STREAM_PROTOCOL, `hisabche.bearer.${GOOD_TOKEN}`])
    await opened
    await next((f) => f.op === Op.READY)
    const closed = new Promise<number>((resolve) =>
      socket.addEventListener('close', (e) => resolve(e.code)),
    )
    socket.send('{"cursor":1}')
    expect(await closed).toBe(1003)
  })
})

describe('CursorWatcher', () => {
  it('is monotonic: a lower (failed or lagging) read never moves anyone backwards', async () => {
    const { CursorWatcher } = await import('../services/sync-stream')
    let value = 50
    const watcher = new CursorWatcher(async () => value, 60_000)
    const heard: number[] = []
    const stop = watcher.subscribe('ws', (c) => heard.push(c), 50)
    value = 0
    watcher.nudge('ws')
    await new Promise((r) => setTimeout(r, 10))
    value = 51
    watcher.nudge('ws')
    await new Promise((r) => setTimeout(r, 10))
    expect(heard).toEqual([51])
    stop()
    watcher.stopAll()
  })

  it('stops polling a workspace once its last listener leaves', async () => {
    const { CursorWatcher } = await import('../services/sync-stream')
    const read = vi.fn(async () => 1)
    const watcher = new CursorWatcher(read, 60_000)
    const stop = watcher.subscribe('ws', () => undefined, 1)
    expect(watcher.socketCount).toBe(1)
    stop()
    expect(watcher.socketCount).toBe(0)
    watcher.nudge('ws')
    expect(read).not.toHaveBeenCalled()
  })
})
