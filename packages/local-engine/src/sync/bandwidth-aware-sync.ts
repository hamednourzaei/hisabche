// ============================================
// packages/local-engine/src/sync/bandwidth-aware-sync.ts
//
// Bandwidth-Aware & Load-Aware Sync Dispatcher
// Automatically adapts sync batch size, concurrency, and retry backoff
// to client link quality and server load. Prioritizes financial transactions.
// ============================================

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

export interface SyncCandidateItem {
  readonly clientId: string
  readonly entity: string
  readonly operation: string
  readonly isFinancial: boolean
  readonly payload: unknown
  readonly attempts: number
}

export class BandwidthAwareSyncDispatcher {
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
