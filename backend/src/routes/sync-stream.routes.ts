// ============================================
// GET /api/sync/stream — the persistent wake-up connection (request #153).
//
// A WebSocket that speaks Hisabche Sync Binary frames and carries ONE fact:
// the workspace head moved (CURSOR). No row ever travels here — data comes
// over HTTP `/api/sync/pull`, so a dropped socket loses nothing. See
// services/sync-stream.ts.
//
// AUTHENTICATION IS THE SAME CODE AS EVERY OTHER ROUTE. The upgrade is an
// ordinary HTTP GET, so `authenticate` and `requireWorkspaceContext` run as
// its preHandlers, unchanged. A browser cannot set `Authorization` on a
// WebSocket and a token in the URL lands in access logs, so the client puts it
// in the subprotocol list — `['hisabche.v1', 'hisabche.bearer.<token>']` —
// and `liftProtocolToken` moves it to the header before `authenticate` reads
// it. The server only ever SELECTS `hisabche.v1`; the token is never echoed.
//
//   server → READY  { cursor, heartbeatMs }   on connect
//   client → HELLO  { cursor }                 «this is what I have»
//   server → CURSOR { cursor }                 whenever the head passes it
//   either → PING / PONG                       heartbeat; silence → close
// ============================================

import websocket from '@fastify/websocket'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { decodeFrame, encodeFrame, Op, type WireValue } from '@hisabche/sync/wire'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireWorkspace } from '../services/tenancy.service'
import { cursorWatcher, MAX_STREAM_SOCKETS } from '../services/sync-stream'

export const STREAM_PROTOCOL = 'hisabche.v1'
const BEARER_PREFIX = 'hisabche.bearer.'
export const HEARTBEAT_MS = 25_000
/** Two missed heartbeats and the socket is considered dead. */
const DEAD_AFTER_MS = HEARTBEAT_MS * 2 + 5_000
/** Membership is re-checked while the socket lives: a removed member stops hearing. */
const RECHECK_MS = 5 * 60_000
/** Control frames only — anything bigger is not ours. */
const MAX_CLIENT_FRAME = 4 * 1024

/** Move `hisabche.bearer.<token>` from the subprotocol list into Authorization. */
export async function liftProtocolToken(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers['sec-websocket-protocol']
  const offered = (Array.isArray(header) ? header.join(',') : (header ?? ''))
    .split(',')
    .map((p) => p.trim())
  if (!offered.includes(STREAM_PROTOCOL)) {
    return reply.code(400).send({ error: 'unsupported_protocol' })
  }
  const bearer = offered.find((p) => p.startsWith(BEARER_PREFIX))
  if (bearer && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${bearer.slice(BEARER_PREFIX.length)}`
  }
}

export async function syncStreamRoutes(fastify: FastifyInstance) {
  await fastify.register(websocket, {
    options: {
      maxPayload: MAX_CLIENT_FRAME,
      // Select our protocol, never the bearer entry: a selected protocol is
      // echoed in the response, and the token must not be.
      handleProtocols: (protocols: Set<string>) =>
        protocols.has(STREAM_PROTOCOL) ? STREAM_PROTOCOL : false,
    },
  })

  fastify.get(
    '/api/sync/stream',
    {
      websocket: true,
      preHandler: [liftProtocolToken, authenticate, requireWorkspaceContext],
    },
    async (socket, request) => {
      const send = (op: (typeof Op)[keyof typeof Op], body: WireValue) => {
        if (socket.readyState === socket.OPEN) socket.send(encodeFrame(op, body))
      }

      if (cursorWatcher.socketCount >= MAX_STREAM_SOCKETS) {
        send(Op.ERROR, { code: 'overloaded', retryAfterMs: 30_000 })
        socket.close(1013, 'try again later')
        return
      }

      const { workspaceId, userId } = request.tenancy
      let lastSeen = Date.now()
      let clientCursor = 0

      let head = 0
      try {
        head = await cursorWatcher.head(workspaceId)
      } catch (err) {
        request.log.warn({ err, workspaceId }, 'sync stream: head read failed')
        send(Op.ERROR, { code: 'head_unavailable', retryAfterMs: 5_000 })
        socket.close(1011, 'head unavailable')
        return
      }

      const unsubscribe = cursorWatcher.subscribe(
        workspaceId,
        (cursor) => {
          if (cursor > clientCursor) send(Op.CURSOR, { cursor })
        },
        head,
      )

      const heartbeat = setInterval(() => {
        if (Date.now() - lastSeen > DEAD_AFTER_MS) {
          socket.terminate()
          return
        }
        send(Op.PING, { t: Date.now() })
      }, HEARTBEAT_MS)

      const recheck = setInterval(() => {
        requireWorkspace(userId, workspaceId).catch(() => {
          send(Op.ERROR, { code: 'membership_revoked' })
          socket.close(4403, 'membership revoked')
        })
      }, RECHECK_MS)

      const cleanup = () => {
        clearInterval(heartbeat)
        clearInterval(recheck)
        unsubscribe()
      }
      socket.on('close', cleanup)
      socket.on('error', cleanup)

      socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
        lastSeen = Date.now()
        if (!isBinary) {
          socket.close(1003, 'binary frames only')
          return
        }
        try {
          const bytes = Buffer.isBuffer(raw)
            ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
            : raw instanceof ArrayBuffer
              ? new Uint8Array(raw)
              : new Uint8Array(Buffer.concat(raw))
          const frame = decodeFrame(bytes)
          if (frame.op === Op.PING) return send(Op.PONG, frame.body)
          if (frame.op === Op.PONG) return
          if (frame.op === Op.HELLO) {
            const body = frame.body as { cursor?: unknown } | null
            const cursor = Number(body?.cursor)
            clientCursor = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0
            // Tell a client that is already behind right away, instead of on
            // the next write.
            void cursorWatcher.head(workspaceId).then(
              (h) => {
                if (h > clientCursor) send(Op.CURSOR, { cursor: h })
              },
              () => undefined,
            )
            return
          }
          socket.close(1008, 'unexpected frame')
        } catch {
          socket.close(1007, 'malformed frame')
        }
      })

      send(Op.READY, { cursor: head, heartbeatMs: HEARTBEAT_MS })
    },
  )
}
