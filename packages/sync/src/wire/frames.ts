// ============================================
// Hisabche Sync Binary (HSB) — frames and messages.
//
//   ┌──────┬──────┬─────────┬────────┬───────────────────┬──────────┐
//   │ 'H'  │ 'S'  │ version │ opcode │ body length u32LE │   body   │
//   └──────┴──────┴─────────┴────────┴───────────────────┴──────────┘
//      1      1       1         1              4           n bytes
//
// The same frame travels in an HTTP body (Content-Type below) and in one
// WebSocket binary message. The 8-byte header lets a reader refuse anything
// that is not ours, or a version it does not speak, before decoding a byte of
// body.
//
// The pull page — the message sent most — has a POSITIONAL layout, the way a
// TL constructor does: no key names for its fixed fields at all.
//
//   PULL_PAGE  = [nextCursor, flags, changes[]]      flags: 1 hasMore, 2 mustRehydrate
//   change     = [syncVersion, entityType, entityId, op, entityVersion, data|null]
//                op: 0 create, 1 update, 2 delete
//
// Row data stays a map: its keys are interned once per frame by the codec, so
// a 500-row page carries each column name once.
// ============================================

import { Reader, WireError, Writer, type WireValue } from './codec'

export const HSB_CONTENT_TYPE = 'application/x-hisabche-sync'
export const HSB_VERSION = 1
const MAGIC_0 = 0x48 // 'H'
const MAGIC_1 = 0x53 // 'S'
export const HEADER_BYTES = 8
/** A frame larger than this is refused unread (a pull page is a few hundred KB at most). */
export const MAX_FRAME_BYTES = 16 * 1024 * 1024

export const Op = {
  /** server → client: one page of the change log. */
  PULL_PAGE: 0x01,
  /** client → server: a batch of mutations (same shape as the JSON push). */
  PUSH_BATCH: 0x02,
  /** server → client: per-mutation results. */
  PUSH_RESULT: 0x03,
  /** server → client: one page of a full rebuild, { rows, nextAfter, hasMore }. */
  SNAPSHOT_PAGE: 0x04,
  /** client → server, first WS frame: who I am and where my cursor is. */
  HELLO: 0x10,
  /** server → client: the workspace head moved. A wake-up, never data. */
  CURSOR: 0x11,
  PING: 0x12,
  PONG: 0x13,
  /** server → client: why the connection or request was refused. */
  ERROR: 0x14,
  /** server → client: HELLO accepted. */
  READY: 0x15,
} as const
export type OpCode = (typeof Op)[keyof typeof Op]
const KNOWN_OPS = new Set<number>(Object.values(Op))

export interface Frame {
  op: OpCode
  body: WireValue
}

export function encodeFrame(op: OpCode, body: WireValue): Uint8Array {
  const w = new Writer()
  w.byte(MAGIC_0)
  w.byte(MAGIC_1)
  w.byte(HSB_VERSION)
  w.byte(op)
  w.u32(0) // patched below, once the body length is known
  w.value(body)
  const out = w.finish()
  new DataView(out.buffer, out.byteOffset, out.byteLength).setUint32(
    4,
    out.length - HEADER_BYTES,
    true,
  )
  return out
}

export function decodeFrame(bytes: Uint8Array): Frame {
  if (bytes.length < HEADER_BYTES) throw new WireError('frame shorter than its header')
  if (bytes.length > MAX_FRAME_BYTES + HEADER_BYTES) throw new WireError('frame too large')
  const r = new Reader(bytes)
  if (r.byte() !== MAGIC_0 || r.byte() !== MAGIC_1) throw new WireError('not a Hisabche frame')
  const version = r.byte()
  if (version !== HSB_VERSION) throw new WireError(`unsupported frame version ${version}`)
  const op = r.byte()
  if (!KNOWN_OPS.has(op)) throw new WireError(`unknown opcode 0x${op.toString(16)}`)
  const length = r.u32()
  if (length !== r.remaining) throw new WireError('frame length does not match body')
  const body = r.value()
  if (r.remaining !== 0) throw new WireError('trailing bytes')
  return { op: op as OpCode, body }
}

/* ── the pull page ──────────────────────────────────────────────────────── */

export type ChangeOperation = 'create' | 'update' | 'delete'
const OP_CODE: Record<ChangeOperation, number> = { create: 0, update: 1, delete: 2 }
const OP_NAME: ChangeOperation[] = ['create', 'update', 'delete']

export interface WireChange {
  syncVersion: number
  entityType: string
  entityId: string
  operation: ChangeOperation
  entityVersion: number
  data: Record<string, unknown> | null
}

export interface WirePullPage {
  changes: WireChange[]
  nextCursor: number
  hasMore: boolean
  mustRehydrate: boolean
}

export function encodePullPage(page: WirePullPage): Uint8Array {
  const flags = (page.hasMore ? 1 : 0) | (page.mustRehydrate ? 2 : 0)
  return encodeFrame(Op.PULL_PAGE, [
    page.nextCursor,
    flags,
    page.changes.map((c) => [
      c.syncVersion,
      c.entityType,
      c.entityId,
      OP_CODE[c.operation],
      c.entityVersion,
      (c.data as WireValue) ?? null,
    ]),
  ])
}

const isInt = (v: WireValue | undefined): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v)
const isRecord = (v: WireValue | undefined): v is { [key: string]: WireValue } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array)

export function decodePullPage(bytes: Uint8Array): WirePullPage {
  const frame = decodeFrame(bytes)
  if (frame.op !== Op.PULL_PAGE) throw new WireError('expected a PULL_PAGE frame')
  const body = frame.body
  if (!Array.isArray(body) || body.length !== 3) throw new WireError('malformed PULL_PAGE')
  const [nextCursor, flags, changes] = body
  if (!isInt(nextCursor) || !isInt(flags) || !Array.isArray(changes))
    throw new WireError('malformed PULL_PAGE')
  return {
    nextCursor,
    hasMore: (flags & 1) === 1,
    mustRehydrate: (flags & 2) === 2,
    changes: changes.map((raw) => {
      if (!Array.isArray(raw) || raw.length !== 6) throw new WireError('malformed change')
      const [syncVersion, entityType, entityId, op, entityVersion, data] = raw
      const operation = isInt(op) ? OP_NAME[op] : undefined
      if (
        !isInt(syncVersion) ||
        typeof entityType !== 'string' ||
        typeof entityId !== 'string' ||
        !operation ||
        !isInt(entityVersion) ||
        !(data === null || isRecord(data))
      ) {
        throw new WireError('malformed change')
      }
      return {
        syncVersion,
        entityType,
        entityId,
        operation,
        entityVersion,
        data: data as Record<string, unknown> | null,
      }
    }),
  }
}

/* ── the snapshot page ──────────────────────────────────────────────────── */

export interface WireSnapshotPage {
  rows: Record<string, unknown>[]
  nextAfter: string | null
  hasMore: boolean
}

export function encodeSnapshotPage(page: WireSnapshotPage): Uint8Array {
  return encodeFrame(Op.SNAPSHOT_PAGE, [page.nextAfter, page.hasMore, page.rows as WireValue[]])
}

export function decodeSnapshotPage(bytes: Uint8Array): WireSnapshotPage {
  const frame = decodeFrame(bytes)
  if (frame.op !== Op.SNAPSHOT_PAGE) throw new WireError('expected a SNAPSHOT_PAGE frame')
  const body = frame.body
  if (!Array.isArray(body) || body.length !== 3) throw new WireError('malformed SNAPSHOT_PAGE')
  const [nextAfter, hasMore, rows] = body
  if (
    !(nextAfter === null || typeof nextAfter === 'string') ||
    typeof hasMore !== 'boolean' ||
    !Array.isArray(rows)
  ) {
    throw new WireError('malformed SNAPSHOT_PAGE')
  }
  if (!rows.every((r) => isRecord(r))) throw new WireError('malformed snapshot row')
  return { nextAfter, hasMore, rows: rows as Record<string, unknown>[] }
}

/** Does this request/response carry HSB? (Accept or Content-Type header value.) */
export function wantsBinary(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header.join(',') : (header ?? '')
  return value.toLowerCase().includes(HSB_CONTENT_TYPE)
}
