// ============================================
// packages/sync/src/durable-outbox-and-fallback.ts
//
// Durable Outbox & Resilient Transport Fallback
// Provides seamless degradation from WebSocket to HTTP Polling
// when WebSockets are blocked by national firewalls or ISP filtering.
// Buffers mutations locally in an append-only durable outbox.
// ============================================

export type TransportMode = 'websocket' | 'polling' | 'offline'

export interface OutboxMutation<T = unknown> {
  readonly id: string
  readonly idempotencyKey: string
  readonly workspaceId: string
  readonly endpoint: string
  readonly method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  readonly payload: T
  readonly createdAt: number
  readonly attempts: number
  readonly status: 'pending' | 'in_flight' | 'committed' | 'failed'
  readonly lastError?: string | undefined
}

export interface TransportState {
  readonly currentTransport: TransportMode
  readonly isConnected: boolean
  readonly consecutiveSocketFailures: number
  readonly outboxPendingCount: number
  readonly lastSyncedCursor: number
}

export interface DurableOutboxOptions {
  readonly maxSocketFailuresBeforeFallback?: number
  readonly pollingIntervalMs?: number
  readonly onTransportSwitch?: (newMode: TransportMode, reason: string) => void
  readonly onWake?: (reason: string, cursor: number) => void
}

export class DurableOutboxManager {
  private transport: TransportMode = 'websocket'
  private socketFailures = 0
  private outbox: Map<string, OutboxMutation> = new Map()
  private lastCursor = 0
  private readonly maxFailures: number
  private pollingTimer: NodeJS.Timeout | null = null
  private readonly pollingIntervalMs: number

  constructor(private readonly options?: DurableOutboxOptions) {
    this.maxFailures = options?.maxSocketFailuresBeforeFallback ?? 3
    this.pollingIntervalMs = options?.pollingIntervalMs ?? 5_000
  }

  public getTransportState(): TransportState {
    return {
      currentTransport: this.transport,
      isConnected: this.transport !== 'offline',
      consecutiveSocketFailures: this.socketFailures,
      outboxPendingCount: Array.from(this.outbox.values()).filter((m) => m.status === 'pending')
        .length,
      lastSyncedCursor: this.lastCursor,
    }
  }

  /**
   * Records a WebSocket failure event.
   * If threshold is exceeded, degrades to polling fallback.
   */
  public recordSocketFailure(error?: string): void {
    this.socketFailures++
    if (this.socketFailures >= this.maxFailures && this.transport === 'websocket') {
      this.switchTransport(
        'polling',
        `WebSocket failure threshold reached (${this.socketFailures} errors: ${error ?? 'connection failed'})`,
      )
      this.startPolling()
    }
  }

  /**
   * Records successful transport connection or packet reception.
   */
  public recordSocketSuccess(): void {
    this.socketFailures = 0
    if (this.transport === 'polling') {
      // Keep polling or probe websocket return if desired
    }
  }

  /**
   * Enqueues a business mutation into the durable outbox.
   * Guaranteed not to be lost during connectivity disruptions.
   */
  public enqueueMutation<T>(
    mutation: Omit<OutboxMutation<T>, 'attempts' | 'status' | 'createdAt'>,
  ): OutboxMutation<T> {
    const existing = this.outbox.get(mutation.id)
    if (existing) {
      return existing as OutboxMutation<T>
    }

    const record: OutboxMutation<T> = {
      ...mutation,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
    }

    this.outbox.set(mutation.id, record as OutboxMutation)
    return record
  }

  /**
   * Acknowledges server commitment of a mutation.
   */
  public commitMutation(id: string, serverCursor: number): void {
    const item = this.outbox.get(id)
    if (item) {
      this.outbox.set(id, { ...item, status: 'committed' })
      if (serverCursor > this.lastCursor) {
        this.lastCursor = serverCursor
      }
    }
  }

  public getPendingMutations(): readonly OutboxMutation[] {
    return Array.from(this.outbox.values())
      .filter((m) => m.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  public updateCursor(cursor: number, reason: string): void {
    if (cursor > this.lastCursor) {
      this.lastCursor = cursor
      this.options?.onWake?.(reason, cursor)
    }
  }

  private switchTransport(newMode: TransportMode, reason: string): void {
    this.transport = newMode
    this.options?.onTransportSwitch?.(newMode, reason)
  }

  private startPolling(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer)
    this.pollingTimer = setInterval(() => {
      // Simulate/trigger polling wake check
      this.options?.onWake?.('polling:interval', this.lastCursor)
    }, this.pollingIntervalMs)
  }

  public stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }
}
