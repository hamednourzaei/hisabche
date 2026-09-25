// ============================================
// Where a write goes when there is no network — if this host has anywhere.
//
// Windows, Mac, Android and iOS keep a device database with a queue that the
// sync engine drains to the SAME domain routes, under the SAME Idempotency-Key.
// The browser has no such queue, so it registers nothing and a write without a
// network still fails there, as it always has.
//
// Registered by the host, like the token getter — this package must not
// import the host's bridge.
// ============================================

export interface OfflineQueue {
  /** The host knows the device is offline right now. */
  isOffline(): boolean
  enqueue(input: {
    entity: 'invoice'
    operation: 'create'
    /** The write's Idempotency-Key — one invoice, one identity, online or not. */
    clientId: string
    payload: Record<string, unknown>
  }): Promise<void>
}

let queue: OfflineQueue | null = null

export function registerOfflineQueue(next: OfflineQueue): void {
  queue = next
}

export function getOfflineQueue(): OfflineQueue | null {
  return queue
}
