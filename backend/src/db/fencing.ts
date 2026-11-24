// ============================================
// backend/src/db/fencing.ts
//
// Writer Fencing & Split-Brain Prevention Engine
// Enforces single-writer invariant, HMAC-signed writer epochs, non-self-renewing
// leases, PostgreSQL distributed lease coordination (`writer_fencing_leases`),
// and active database target switching across failover topologies.
// ============================================

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerWriterClient } from './primary'
import type {
  DistributedWriterLeaseRecord,
  FencingToken,
  PromotionDecision,
  WriterLease,
  WriterLeaseStore,
} from './runtime-types'

export class FencingTokenRejectedError extends Error {
  public readonly code = 'ERR_FENCING_TOKEN_REJECTED'
  constructor(
    message: string,
    public readonly expectedEpoch: number,
    public readonly receivedEpoch: number,
  ) {
    super(message)
    this.name = 'FencingTokenRejectedError'
  }
}

function resolveFencingSecret(explicit?: string): string {
  const candidate = explicit ?? process.env.WRITER_FENCING_SECRET ?? process.env.JWT_SECRET
  if (candidate && candidate.trim().length >= 16) {
    return candidate
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'WRITER_FENCING_SECRET (>= 16 chars) is required in production to sign writer fencing tokens.',
    )
  }
  return 'hisabche-dev-fencing-secret-local-only'
}

/**
 * Supabase/Postgres implementation of `WriterLeaseStore` backed by the
 * `writer_fencing_leases` table and atomic RPCs in
 * `docs/ha-writer-fencing-01-migration.sql`.
 */
export class SupabaseWriterLeaseStore implements WriterLeaseStore {
  constructor(private readonly client: SupabaseClient) {}

  async readLease(clusterKey: string): Promise<DistributedWriterLeaseRecord | null> {
    const { data, error } = await this.client
      .from('writer_fencing_leases')
      .select('cluster_key, epoch, writer_id, lease_expires_at, fence_signature')
      .eq('cluster_key', clusterKey)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to read writer lease: ${error.message}`)
    }
    if (!data) return null
    const row = data as {
      cluster_key: string
      epoch: number
      writer_id: string
      lease_expires_at: string
      fence_signature?: string | null
    }
    return {
      clusterKey: row.cluster_key,
      epoch: Number(row.epoch),
      writerId: row.writer_id,
      leaseExpiresAt: row.lease_expires_at,
      fenceSignature: row.fence_signature ?? undefined,
    }
  }

  async acquireOrRenewLease(params: {
    clusterKey: string
    writerId: string
    epoch: number
    ttlMs: number
    fenceSignature: string
  }): Promise<DistributedWriterLeaseRecord> {
    const { data, error } = await this.client.rpc('acquire_or_renew_writer_lease', {
      p_cluster_key: params.clusterKey,
      p_writer_id: params.writerId,
      p_epoch: params.epoch,
      p_ttl_ms: params.ttlMs,
      p_fence_signature: params.fenceSignature,
    })

    if (error) {
      if (error.message.includes('ERR_FENCING_TOKEN_REJECTED')) {
        throw new FencingTokenRejectedError(error.message, -1, params.epoch)
      }
      throw new Error(`Distributed lease acquisition failed: ${error.message}`)
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          cluster_key: string
          epoch: number
          writer_id: string
          lease_expires_at: string
          fence_signature?: string | null
        }
      | undefined

    if (!row) {
      throw new Error('acquire_or_renew_writer_lease returned empty result')
    }

    return {
      clusterKey: row.cluster_key,
      epoch: Number(row.epoch),
      writerId: row.writer_id,
      leaseExpiresAt: row.lease_expires_at,
      fenceSignature: row.fence_signature ?? undefined,
    }
  }

  async promoteStandby(params: {
    clusterKey: string
    expectedEpoch: number
    newWriterId: string
    authorizedBy: string
    reason: string
    ttlMs: number
    fenceSignature: string
  }): Promise<DistributedWriterLeaseRecord> {
    const { data, error } = await this.client.rpc('promote_standby_writer', {
      p_cluster_key: params.clusterKey,
      p_expected_epoch: params.expectedEpoch,
      p_new_writer_id: params.newWriterId,
      p_authorized_by: params.authorizedBy,
      p_reason: params.reason,
      p_ttl_ms: params.ttlMs,
      p_fence_signature: params.fenceSignature,
    })

    if (error) {
      if (error.message.includes('ERR_FENCING_TOKEN_REJECTED')) {
        throw new FencingTokenRejectedError(error.message, params.expectedEpoch, -1)
      }
      throw new Error(`Distributed standby promotion failed: ${error.message}`)
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          cluster_key: string
          epoch: number
          writer_id: string
          lease_expires_at: string
          fence_signature?: string | null
        }
      | undefined

    if (!row) {
      throw new Error('promote_standby_writer returned empty result')
    }

    return {
      clusterKey: row.cluster_key,
      epoch: Number(row.epoch),
      writerId: row.writer_id,
      leaseExpiresAt: row.lease_expires_at,
      fenceSignature: row.fence_signature ?? undefined,
    }
  }

  async assertWriterEpoch(params: {
    clusterKey: string
    writerId: string
    epoch: number
  }): Promise<boolean> {
    const { data, error } = await this.client.rpc('assert_writer_epoch', {
      p_cluster_key: params.clusterKey,
      p_writer_id: params.writerId,
      p_epoch: params.epoch,
    })
    if (error) {
      throw new FencingTokenRejectedError(error.message, -1, params.epoch)
    }
    return data === true
  }
}

export class WriterFencingEngine {
  private currentEpoch: number
  private currentWriterId: string
  private activeLease: WriterLease | null = null
  private readonly defaultLeaseDurationMs: number
  private readonly fencingSecret: string
  private readonly clusterKey: string
  private leaseStore: WriterLeaseStore | null

  constructor(options?: {
    initialEpoch?: number
    initialWriterId?: string
    leaseDurationMs?: number
    fencingSecret?: string
    clusterKey?: string
    leaseStore?: WriterLeaseStore | null
  }) {
    this.currentEpoch = options?.initialEpoch ?? Number(process.env.INITIAL_WRITER_EPOCH ?? 1)
    this.currentWriterId =
      options?.initialWriterId ?? process.env.PRIMARY_WRITER_ID ?? 'primary-master-01'
    this.defaultLeaseDurationMs = options?.leaseDurationMs ?? 30_000
    this.fencingSecret = resolveFencingSecret(options?.fencingSecret)
    this.clusterKey = options?.clusterKey ?? process.env.WRITER_CLUSTER_KEY ?? 'primary-cluster'
    this.leaseStore = options?.leaseStore ?? null
    this.grantFreshLease()
  }

  public setLeaseStore(store: WriterLeaseStore | null): void {
    this.leaseStore = store
  }

  public getClusterKey(): string {
    return this.clusterKey
  }

  public getCurrentEpoch(): number {
    return this.currentEpoch
  }

  public getCurrentWriterId(): string {
    return this.currentWriterId
  }

  /**
   * Returns the current lease snapshot WITHOUT silently renewing an expired lease.
   * When expired, `active` is returned as `false`.
   */
  public getActiveLease(nowMs: number = Date.now()): WriterLease {
    if (!this.activeLease) {
      return {
        epoch: this.currentEpoch,
        writerId: this.currentWriterId,
        grantedAt: new Date(0).toISOString(),
        expiresAt: new Date(0).toISOString(),
        active: false,
      }
    }
    const expired = this.isLeaseExpired(nowMs)
    return {
      ...this.activeLease,
      active: this.activeLease.active && !expired,
    }
  }

  public generateFencingToken(now: Date = new Date()): FencingToken {
    const issuedAt = now.toISOString()
    const signature = this.signTokenPayload(this.currentEpoch, this.currentWriterId, issuedAt)
    return {
      epoch: this.currentEpoch,
      writerId: this.currentWriterId,
      issuedAt,
      signature,
    }
  }

  /**
   * Explicitly renews the active lease heartbeat ONLY if caller holds the exact
   * active epoch & writerId. Must NEVER be invoked implicitly on an expired write.
   */
  public renewLeaseHeartbeat(expectedEpoch: number, writerId: string): WriterLease {
    if (expectedEpoch !== this.currentEpoch || writerId !== this.currentWriterId) {
      throw new FencingTokenRejectedError(
        `Split-Brain Defense: Heartbeat renewal refused for writer '${writerId}' at epoch ${expectedEpoch} (active: '${this.currentWriterId}' epoch ${this.currentEpoch}).`,
        this.currentEpoch,
        expectedEpoch,
      )
    }
    this.grantFreshLease()
    return this.getActiveLease()
  }

  /**
   * Synchronizes local engine state and renews lease against the shared Postgres
   * `writer_fencing_leases` table. Throws `FencingTokenRejectedError` if a standby
   * has promoted a newer epoch in the shared database.
   */
  public async syncAndAcquireDistributedLease(
    storeOverride?: WriterLeaseStore,
  ): Promise<WriterLease> {
    const store = storeOverride ?? this.leaseStore
    if (!store) {
      throw new Error('No distributed WriterLeaseStore configured')
    }
    const token = this.generateFencingToken()
    const record = await store.acquireOrRenewLease({
      clusterKey: this.clusterKey,
      writerId: this.currentWriterId,
      epoch: this.currentEpoch,
      ttlMs: this.defaultLeaseDurationMs,
      fenceSignature: token.signature!,
    })
    this.applyDistributedRecord(record)
    return this.getActiveLease()
  }

  /**
   * Asserts that a write request carries a valid, cryptographically signed fencing
   * token matching the exact active epoch and writer, under an unexpired lease.
   */
  public assertValidWriter(token?: FencingToken | null, nowMs: number = Date.now()): void {
    if (!token) {
      throw new FencingTokenRejectedError(
        'Split-Brain Defense: Explicit signed fencing token is required for write operations.',
        this.currentEpoch,
        -1,
      )
    }

    if (this.isLeaseExpired(nowMs)) {
      throw new FencingTokenRejectedError(
        `Split-Brain Defense: Writer lease for '${this.currentWriterId}' at epoch ${this.currentEpoch} has expired; write refused.`,
        this.currentEpoch,
        token.epoch,
      )
    }

    if (token.epoch < this.currentEpoch) {
      throw new FencingTokenRejectedError(
        `Split-Brain Defense: Write rejected. Received stale epoch ${token.epoch}, active writer epoch is ${this.currentEpoch}.`,
        this.currentEpoch,
        token.epoch,
      )
    }

    if (token.epoch > this.currentEpoch) {
      throw new FencingTokenRejectedError(
        `Split-Brain Defense: Write rejected. Received unpromoted future epoch ${token.epoch}, active writer epoch is ${this.currentEpoch}.`,
        this.currentEpoch,
        token.epoch,
      )
    }

    if (token.writerId !== this.currentWriterId) {
      throw new FencingTokenRejectedError(
        `Split-Brain Defense: Write rejected. Token writer '${token.writerId}' does not match active writer '${this.currentWriterId}'.`,
        this.currentEpoch,
        token.epoch,
      )
    }

    if (!this.verifyTokenSignature(token)) {
      throw new FencingTokenRejectedError(
        'Split-Brain Defense: Invalid or missing cryptographic fencing token signature.',
        this.currentEpoch,
        token.epoch,
      )
    }
  }

  /**
   * Distributed verification: runs local cryptographic & lease checks AND confirms
   * against the shared Postgres `assert_writer_epoch` RPC so even a partitioned
   * node whose local memory is behind cannot commit writes after promotion.
   */
  public async assertValidWriterDistributed(
    token: FencingToken | null | undefined,
    storeOverride?: WriterLeaseStore,
  ): Promise<void> {
    this.assertValidWriter(token)
    const store = storeOverride ?? this.leaseStore
    if (!store) {
      throw new Error('No distributed WriterLeaseStore configured')
    }
    const ok = await store.assertWriterEpoch({
      clusterKey: this.clusterKey,
      writerId: token!.writerId,
      epoch: token!.epoch,
    })
    if (!ok) {
      throw new FencingTokenRejectedError(
        'Split-Brain Defense: Shared lease store rejected writer epoch.',
        this.currentEpoch,
        token!.epoch,
      )
    }
  }

  /**
   * Promotes a standby to the active writer in-process (and switches the live
   * database target if `newWriterClient` is provided).
   */
  public promoteStandby(
    decision: Omit<PromotionDecision, 'newEpoch' | 'timestamp'> & {
      newWriterClient?: SupabaseClient | undefined
    },
  ): PromotionDecision {
    if (!decision.approved) {
      throw new Error(
        `Promotion rejected: Explicit human or controller approval required. Reason: ${decision.reason}`,
      )
    }

    const previousWriter = this.currentWriterId
    this.currentEpoch += 1
    this.currentWriterId = decision.newWriterId
    if (decision.newWriterClient) {
      registerWriterClient(decision.newWriterId, decision.newWriterClient)
    }

    this.grantFreshLease()

    return {
      approved: decision.approved,
      previousWriterId: previousWriter,
      newWriterId: this.currentWriterId,
      newEpoch: this.currentEpoch,
      reason: decision.reason,
      authorizedBy: decision.authorizedBy,
      clusterKey: decision.clusterKey ?? this.clusterKey,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Promotes a standby atomically in the shared Postgres lease store (with CAS on
   * `expectedEpoch`) AND binds the promoted writer client into the live write router.
   */
  public async promoteStandbyDistributed(
    decision: Omit<PromotionDecision, 'newEpoch' | 'timestamp'> & {
      newWriterClient?: SupabaseClient | undefined
      store?: WriterLeaseStore | undefined
    },
  ): Promise<PromotionDecision> {
    if (!decision.approved) {
      throw new Error(
        `Promotion rejected: Explicit human or controller approval required. Reason: ${decision.reason}`,
      )
    }
    const store = decision.store ?? this.leaseStore
    if (!store) {
      throw new Error('No distributed WriterLeaseStore configured')
    }

    const previousWriter = this.currentWriterId
    const nextEpochCandidate = this.currentEpoch + 1
    const nextSig = this.signTokenPayload(
      nextEpochCandidate,
      decision.newWriterId,
      new Date().toISOString(),
    )

    const record = await store.promoteStandby({
      clusterKey: decision.clusterKey ?? this.clusterKey,
      expectedEpoch: this.currentEpoch,
      newWriterId: decision.newWriterId,
      authorizedBy: decision.authorizedBy,
      reason: decision.reason,
      ttlMs: this.defaultLeaseDurationMs,
      fenceSignature: nextSig,
    })

    if (decision.newWriterClient) {
      registerWriterClient(record.writerId, decision.newWriterClient)
    }
    this.applyDistributedRecord(record)

    return {
      approved: true,
      previousWriterId: previousWriter,
      newWriterId: record.writerId,
      newEpoch: record.epoch,
      reason: decision.reason,
      authorizedBy: decision.authorizedBy,
      clusterKey: record.clusterKey,
      timestamp: new Date().toISOString(),
    }
  }

  /** Resets in-memory state (test-only helper to avoid cross-suite contamination). */
  public resetForTest(options?: { epoch?: number; writerId?: string }): void {
    this.currentEpoch = options?.epoch ?? Number(process.env.INITIAL_WRITER_EPOCH ?? 1)
    this.currentWriterId = options?.writerId ?? process.env.PRIMARY_WRITER_ID ?? 'primary-master-01'
    this.leaseStore = null
    this.grantFreshLease()
  }

  /** Forces local lease expiration (used to verify fail-closed behavior under timeout/partition). */
  public expireLeaseForTest(): void {
    if (this.activeLease) {
      this.activeLease = {
        ...this.activeLease,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        active: false,
      }
    }
  }

  private grantFreshLease(nowMs: number = Date.now()): void {
    const grantedAt = new Date(nowMs).toISOString()
    const expiresAt = new Date(nowMs + this.defaultLeaseDurationMs).toISOString()
    const fenceSignature = this.signTokenPayload(this.currentEpoch, this.currentWriterId, grantedAt)
    this.activeLease = {
      epoch: this.currentEpoch,
      writerId: this.currentWriterId,
      grantedAt,
      expiresAt,
      active: true,
      fenceSignature,
    }
  }

  private applyDistributedRecord(record: DistributedWriterLeaseRecord): void {
    this.currentEpoch = record.epoch
    this.currentWriterId = record.writerId
    this.activeLease = {
      epoch: record.epoch,
      writerId: record.writerId,
      grantedAt: new Date().toISOString(),
      expiresAt: record.leaseExpiresAt,
      active: new Date(record.leaseExpiresAt).getTime() > Date.now(),
      fenceSignature: record.fenceSignature,
    }
  }

  private signTokenPayload(epoch: number, writerId: string, issuedAt: string): string {
    return createHmac('sha256', this.fencingSecret)
      .update(`${this.clusterKey}:${epoch}:${writerId}:${issuedAt}`)
      .digest('hex')
  }

  private verifyTokenSignature(token: FencingToken): boolean {
    if (!token.signature || typeof token.signature !== 'string' || !token.issuedAt) {
      return false
    }
    const expected = this.signTokenPayload(token.epoch, token.writerId, token.issuedAt)
    const receivedBuf = Buffer.from(token.signature)
    const expectedBuf = Buffer.from(expected)
    return receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf)
  }

  private isLeaseExpired(nowMs: number = Date.now()): boolean {
    if (!this.activeLease) return true
    return new Date(this.activeLease.expiresAt).getTime() <= nowMs
  }
}

export const globalFencingEngine = new WriterFencingEngine()
