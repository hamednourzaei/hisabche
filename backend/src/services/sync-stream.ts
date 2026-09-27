// ============================================
// Sync wake-up stream — who needs to hear that a workspace moved.
//
// ⚠️ THE STREAM CARRIES NO DATA (request #153). It says «the workspace head is
// now N»; the client then pulls N's changes over HTTP, through the same
// authenticated, idempotent, cursor-safe path as always. If the socket drops,
// nothing is lost — the next pull (on reconnect, on focus, on the interval)
// catches up. The WebSocket is an accelerator, never the source of truth.
//
// ONE POLLER PER WORKSPACE PER INSTANCE. However many devices of a shop are
// connected to this instance, the head is read once per tick. A push handled
// HERE notifies immediately (`nudge`); a write that happened on another
// instance, or through a domain route (an invoice, a payment — the change-log
// trigger records those too), is seen on the next tick. Correct across any
// number of instances without Redis pub/sub, because the database IS the
// shared state.
// ============================================

import { syncService } from './sync.service'

export const STREAM_POLL_MS = 2_000
/** Hard cap per instance; a socket beyond it is refused, not queued. */
export const MAX_STREAM_SOCKETS = 5_000

export type CursorListener = (cursor: number) => void

interface Watch {
  listeners: Set<CursorListener>
  head: number
  timer: ReturnType<typeof setInterval> | null
  reading: boolean
}

export class CursorWatcher {
  private readonly watches = new Map<string, Watch>()

  constructor(
    private readonly readHead: (workspaceId: string) => Promise<number> = (ws) =>
      syncService.currentCursor(ws),
    private readonly pollMs = STREAM_POLL_MS,
  ) {}

  get socketCount(): number {
    let n = 0
    for (const w of this.watches.values()) n += w.listeners.size
    return n
  }

  /** Current head for a workspace, reading it if nobody is watching yet. */
  async head(workspaceId: string): Promise<number> {
    const watch = this.watches.get(workspaceId)
    if (watch && watch.head > 0) return watch.head
    return this.readHead(workspaceId)
  }

  subscribe(workspaceId: string, listener: CursorListener, knownHead: number): () => void {
    let watch = this.watches.get(workspaceId)
    if (!watch) {
      watch = { listeners: new Set(), head: knownHead, timer: null, reading: false }
      this.watches.set(workspaceId, watch)
    }
    watch.head = Math.max(watch.head, knownHead)
    watch.listeners.add(listener)
    if (!watch.timer) {
      watch.timer = setInterval(() => void this.tick(workspaceId), this.pollMs)
      // Never the thing that keeps the process alive at shutdown.
      ;(watch.timer as { unref?: () => void }).unref?.()
    }
    return () => {
      const current = this.watches.get(workspaceId)
      if (!current) return
      current.listeners.delete(listener)
      if (current.listeners.size === 0) {
        if (current.timer) clearInterval(current.timer)
        this.watches.delete(workspaceId)
      }
    }
  }

  /** A write handled on this instance: read the head now instead of next tick. */
  nudge(workspaceId: string): void {
    if (this.watches.has(workspaceId)) void this.tick(workspaceId)
  }

  private async tick(workspaceId: string): Promise<void> {
    const watch = this.watches.get(workspaceId)
    if (!watch || watch.reading) return
    watch.reading = true
    try {
      const head = await this.readHead(workspaceId)
      // Monotonic: a head that reads lower (replica lag, a failed read that
      // would otherwise be 0) never moves a client backwards.
      if (head > watch.head) {
        watch.head = head
        for (const listener of watch.listeners) {
          try {
            listener(head)
          } catch {
            // One broken socket must not stop the others from hearing.
          }
        }
      }
    } catch {
      // A failed read changes nothing: listeners keep their last head and the
      // next tick tries again. Silence is safe here — the client pulls anyway.
    } finally {
      watch.reading = false
    }
  }

  /** Test/shutdown helper. */
  stopAll(): void {
    for (const watch of this.watches.values()) if (watch.timer) clearInterval(watch.timer)
    this.watches.clear()
  }
}

export const cursorWatcher = new CursorWatcher()
