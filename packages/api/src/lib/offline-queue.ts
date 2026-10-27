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

/**
 * The filters a device read can honour.
 *
 * The same vocabulary the cache's query understands: exact filters, an order,
 * and a page. A null filter means "the column is empty".
 */
export interface DeviceReadOptions {
  where?: Record<string, string | number | boolean | null>
  orderBy?: string
  direction?: 'asc' | 'desc'
  limit?: number
  offset?: number
  /** The columns the search looks at, when the caller's rule differs. */
  searchColumns?: readonly string[]
}

/**
 * A page of device rows, and how many rows the filter matches in all.
 *
 * ⚠️ THE TOTAL IS NOT THE LENGTH OF THE ROWS. A device read is capped by the
 * page it was asked for; a list that reported the page as the whole business
 * would hide every customer beyond the first page.
 */
export interface DeviceReadResult {
  rows: Array<Record<string, unknown>>
  total: number
  /**
   * Has this device ever pulled this table for this workspace?
   *
   * False means "I do not know", not "there is nothing". A list that answers
   * "nothing here" when the device was never filled shows a shopkeeper an
   * empty business; a list that answers "not available offline" is honest.
   */
  synced?: boolean
}

export interface OfflineQueue {
  /** The host knows the device is offline right now. */
  isOffline(): boolean
  enqueue(input: {
    entity: 'invoice'
    operation: 'create'
    /** The write's Idempotency-Key — one invoice, one identity, online or not. */
    clientId: string
    payload: Record<string, unknown>
    /**
     * Who made the change, and in which business.
     *
     * The device's outbox is not a private drawer: the next person to sign in
     * on this device would otherwise send this change under their own token.
     */
    userId?: string | null
    workspaceId?: string | null
  }): Promise<void>
  /**
   * Rows of the device database, for a list the network cannot answer. The
   * sync engine fills these from the same endpoints, so offline the stock
   * picker shows the stock the device last saw instead of "no products".
   */
  readRows?(
    table: 'product' | 'customer',
    search: string,
    options?: DeviceReadOptions,
  ): Promise<DeviceReadResult>
  /**
   * Active device-database products with exactly this (normalised) barcode.
   * The scanner asks here FIRST: a cashier must not wait on the network for a
   * product the device already has, and offline it is the only answer.
   */
  findByBarcode?(barcode: string): Promise<Array<Record<string, unknown>>>
  /**
   * Has this device ever pulled this table from the cloud?
   *
   * Asked of the HOST's own record, not through the database bridge — that one
   * is gated behind a signed-in session and a device without one must still be
   * able to say "I do not know" instead of "nothing here".
   */
  hasSynced?(table: 'product' | 'customer'): boolean
}

let queue: OfflineQueue | null = null

export function registerOfflineQueue(next: OfflineQueue): void {
  queue = next
}

export function getOfflineQueue(): OfflineQueue | null {
  return queue
}
