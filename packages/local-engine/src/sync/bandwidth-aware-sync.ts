// ============================================
// packages/local-engine/src/sync/bandwidth-aware-sync.ts
//
// Bandwidth-Aware & Load-Aware Sync Dispatcher + Execution Coordinator
// Dynamically infers network link profile from RTT/downlink telemetry, adapts
// sync batch sizes & retry backoffs, prioritizes financial transactions, and
// executes guarded SyncStateMachine transitions end-to-end.
// ============================================

import type { SyncStateMachine } from './sync-state-machine'

export type NetworkLinkProfile = 'slow_2g' | '3g' | '4g_wifi' | 'offline'

export interface BandwidthSyncConfig {
  readonly maxBatchSize: number
  readonly requestTimeoutMs: number
  readonly retryBackoffBaseMs: number
  readonly maxBackoffMs: number
}

export const LINK_CONFIGS: Record<NetworkLinkProfile, BandwidthSyncConfig> = {
  slow_2g: {
    maxBatchSize: 5,
    requestTimeoutMs: 30_000,
    retryBackoffBaseMs: 5_000,
    maxBackoffMs: 60_000,
  },
  '3g': {
    maxBatchSize: 20,
    requestTimeoutMs: 15_000,
    retryBackoffBaseMs: 2_000,
    maxBackoffMs: 30_000,
  },
  '4g_wifi': {
    maxBatchSize: 50,
    requestTimeoutMs: 8_000,
    retryBackoffBaseMs: 1_000,
    maxBackoffMs: 15_000,
  },
  offline: {
    maxBatchSize: 0,
    requestTimeoutMs: 0,
    retryBackoffBaseMs: 0,
    maxBackoffMs: 0,
  },
}

export interface NetworkTelemetry {
  readonly online: boolean
  readonly effectiveRttMs?: number | undefined
  readonly downlinkMbps?: number | undefined
}

export interface SyncCandidateItem {
  readonly clientId: string
  readonly entity: string
  readonly operation: string
  readonly isFinancial: boolean
  readonly payload: unknown
  readonly attempts: number
}

export type SyncItemOutcome =
  | {
      readonly clientId: string
      readonly status: 'committed'
      readonly serverTimestamp?: string | undefined
    }
  | { readonly clientId: string; readonly status: 'conflict'; readonly reason: string }
  | { readonly clientId: string; readonly status: 'rejected'; readonly reason: string }
  | { readonly clientId: string; readonly status: 'retryable_error'; readonly reason: string }

export interface SyncBatchTransport {
  sendBatch(
    items: readonly SyncCandidateItem[],
    timeoutMs: number,
  ): Promise<readonly SyncItemOutcome[]>
}

export interface SyncDispatchReport {
  readonly profile: NetworkLinkProfile
  readonly selectedCount: number
  readonly committedCount: number
  readonly conflictCount: number
  readonly rejectedCount: number
  readonly requeuedCount: number
}

export class BandwidthAwareSyncDispatcher {
  /**
   * Maps live network measurements (online flag, RTT, downlink speed) to an
   * adaptive bandwidth profile rather than relying on static caller labels.
   */
  public static inferLinkProfile(telemetry: NetworkTelemetry): NetworkLinkProfile {
    if (!telemetry.online) return 'offline'
    const rtt = telemetry.effectiveRttMs
    const mbps = telemetry.downlinkMbps

    if ((rtt !== undefined && rtt >= 1200) || (mbps !== undefined && mbps < 0.25)) {
      return 'slow_2g'
    }
    if ((rtt !== undefined && rtt >= 350) || (mbps !== undefined && mbps < 2.0)) {
      return '3g'
    }
    return '4g_wifi'
  }

  /**
   * Sorts and slices pending mutations into a load-aware batch.
   * Prioritizes financial mutations (payments, invoices) first, then older mutations.
   */
  public static selectBatch(
    items: readonly SyncCandidateItem[],
    profile: NetworkLinkProfile,
    serverLoadScore = 0, // 0 = idle, 1 = overloaded
  ): SyncCandidateItem[] {
    if (profile === 'offline') return []

    const baseConfig = LINK_CONFIGS[profile]
    // Under high server load (e.g. score > 0.7), reduce batch size by half to prevent server saturation
    const adjustedBatchSize =
      serverLoadScore > 0.7
        ? Math.max(1, Math.floor(baseConfig.maxBatchSize / 2))
        : baseConfig.maxBatchSize

    // Priority sort: Financial mutations first (payments, invoices), then lowest attempts
    const sorted = [...items].sort((a, b) => {
      if (a.isFinancial && !b.isFinancial) return -1
      if (!a.isFinancial && b.isFinancial) return 1
      return a.attempts - b.attempts
    })

    return sorted.slice(0, adjustedBatchSize)
  }

  /**
   * Computes exponential backoff with jitter for retries.
   */
  public static calculateBackoffMs(attempts: number, profile: NetworkLinkProfile): number {
    const config = LINK_CONFIGS[profile]
    if (attempts <= 0) return 0
    const rawBackoff = config.retryBackoffBaseMs * Math.pow(2, Math.min(attempts - 1, 5))
    const jitter = Math.floor(Math.random() * 500)
    return Math.min(config.maxBackoffMs, rawBackoff + jitter)
  }
}

/**
 * Executes an adaptive sync cycle against a real `SyncStateMachine` & SQLite outbox:
 * measures network telemetry, filters eligible mutations (respecting retry backoff),
 * advances states strictly through `syncing`, dispatches to transport, and settles
 * each outcome (`server_committed` | `conflict` | `rejected` | `requeueForRetry`).
 */
export class SyncBatchExecutor {
  constructor(
    private readonly stateMachine: SyncStateMachine,
    private readonly transport: SyncTransportOrBatch,
  ) {}

  async runCycle(params: {
    workspaceId: string
    userId?: string | undefined
    telemetry: NetworkTelemetry
    serverLoadScore?: number | undefined
    payloadByClientId?: ReadonlyMap<string, unknown> | undefined
    financialEntities?: ReadonlySet<string> | undefined
    nowMs?: number | undefined
  }): Promise<SyncDispatchReport> {
    const profile = BandwidthAwareSyncDispatcher.inferLinkProfile(params.telemetry)
    if (profile === 'offline') {
      return {
        profile,
        selectedCount: 0,
        committedCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
        requeuedCount: 0,
      }
    }

    const nowMs = params.nowMs ?? Date.now()
    const nowIso = new Date(nowMs).toISOString()
    const pendingRecords = this.stateMachine.getDispatchablePending(
      params.workspaceId,
      params.userId,
      nowIso,
    )
    const financialSet =
      params.financialEntities ?? new Set(['payment', 'payments', 'invoice', 'invoices', 'journal'])

    const candidates: SyncCandidateItem[] = pendingRecords.map((rec) => ({
      clientId: rec.clientId,
      entity: rec.entity,
      operation: rec.operation,
      isFinancial: financialSet.has(rec.entity),
      payload: params.payloadByClientId?.get(rec.clientId) ?? {},
      attempts: rec.attempts,
    }))

    const selected = BandwidthAwareSyncDispatcher.selectBatch(
      candidates,
      profile,
      params.serverLoadScore ?? 0,
    )
    if (selected.length === 0) {
      return {
        profile,
        selectedCount: 0,
        committedCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
        requeuedCount: 0,
      }
    }

    for (const item of selected) {
      this.stateMachine.markSyncing(item.clientId)
    }

    const timeoutMs = LINK_CONFIGS[profile].requestTimeoutMs
    let outcomes: readonly SyncItemOutcome[]
    try {
      outcomes = await this.transport.sendBatch(selected, timeoutMs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network transport failed'
      for (const item of selected) {
        const backoffMs = BandwidthAwareSyncDispatcher.calculateBackoffMs(
          item.attempts + 1,
          profile,
        )
        this.stateMachine.requeueForRetry(item.clientId, msg, backoffMs, nowMs)
      }
      return {
        profile,
        selectedCount: selected.length,
        committedCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
        requeuedCount: selected.length,
      }
    }

    const outcomeById = new Map(outcomes.map((o) => [o.clientId, o]))
    let committedCount = 0
    let conflictCount = 0
    let rejectedCount = 0
    let requeuedCount = 0

    for (const item of selected) {
      const outcome = outcomeById.get(item.clientId)
      if (!outcome) {
        const backoffMs = BandwidthAwareSyncDispatcher.calculateBackoffMs(
          item.attempts + 1,
          profile,
        )
        this.stateMachine.requeueForRetry(
          item.clientId,
          'Missing server acknowledgement',
          backoffMs,
          nowMs,
        )
        requeuedCount++
        continue
      }
      if (outcome.status === 'committed') {
        this.stateMachine.markServerCommitted(item.clientId, outcome.serverTimestamp)
        committedCount++
      } else if (outcome.status === 'conflict') {
        this.stateMachine.markConflict(item.clientId, outcome.reason)
        conflictCount++
      } else if (outcome.status === 'rejected') {
        this.stateMachine.markRejected(item.clientId, outcome.reason)
        rejectedCount++
      } else {
        const backoffMs = BandwidthAwareSyncDispatcher.calculateBackoffMs(
          item.attempts + 1,
          profile,
        )
        this.stateMachine.requeueForRetry(item.clientId, outcome.reason, backoffMs, nowMs)
        requeuedCount++
      }
    }

    return {
      profile,
      selectedCount: selected.length,
      committedCount,
      conflictCount,
      rejectedCount,
      requeuedCount,
    }
  }
}

type SyncTransportOrBatch = SyncBatchTransport
