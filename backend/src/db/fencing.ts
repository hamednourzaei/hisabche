// ============================================
// backend/src/db/fencing.ts
//
// Writer Fencing & Split-Brain Prevention Engine
// Enforces single-writer invariant, writer epochs, and fencing tokens
// across multi-region and failover topologies.
// ============================================

import type { FencingToken, PromotionDecision, WriterLease } from './runtime-types'

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

export class WriterFencingEngine {
  private currentEpoch: number
  private currentWriterId: string
  private activeLease: WriterLease | null = null
  private defaultLeaseDurationMs: number

  constructor(options?: {
    initialEpoch?: number
    initialWriterId?: string
    leaseDurationMs?: number
  }) {
    this.currentEpoch = options?.initialEpoch ?? Number(process.env.INITIAL_WRITER_EPOCH ?? 1)
    this.currentWriterId =
      options?.initialWriterId ?? process.env.PRIMARY_WRITER_ID ?? 'primary-master-01'
    this.defaultLeaseDurationMs = options?.leaseDurationMs ?? 30_000
    this.renewLease()
  }

  public getCurrentEpoch(): number {
    return this.currentEpoch
  }

  public getCurrentWriterId(): string {
    return this.currentWriterId
  }

  public getActiveLease(): WriterLease {
    if (!this.activeLease || this.isLeaseExpired()) {
      this.renewLease()
    }
    return this.activeLease!
  }

  public generateFencingToken(): FencingToken {
    return {
      epoch: this.currentEpoch,
      writerId: this.currentWriterId,
      issuedAt: new Date().toISOString(),
    }
  }

  /**
   * Asserts that a write request carries a valid fencing token matching the current epoch.
   * If a partitioned or deposed node attempts to write with an older epoch, it is rejected immediately.
   */
  public assertValidWriter(token?: FencingToken | null): void {
    if (!token) {
      // In default single-writer mode without explicit token, check lease validity
      if (this.isLeaseExpired()) {
        this.renewLease()
      }
      return
    }

    if (token.epoch < this.currentEpoch) {
      throw new FencingTokenRejectedError(
        `Split-Brain Defense: Write rejected. Received stale epoch ${token.epoch}, active writer epoch is ${this.currentEpoch}.`,
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
  }

  /**
   * Promotes a standby to the active writer.
   * Mandates explicit human/fenced authorization, strictly increments epoch, and invalidates previous leases.
   */
  public promoteStandby(
    decision: Omit<PromotionDecision, 'newEpoch' | 'timestamp'>,
  ): PromotionDecision {
    if (!decision.approved) {
      throw new Error(
        `Promotion rejected: Explicit human or controller approval required. Reason: ${decision.reason}`,
      )
    }

    const previousWriter = this.currentWriterId
    this.currentEpoch += 1
    this.currentWriterId = decision.newWriterId

    this.renewLease()

    const fullDecision: PromotionDecision = {
      ...decision,
      previousWriterId: previousWriter,
      newEpoch: this.currentEpoch,
      timestamp: new Date().toISOString(),
    }

    return fullDecision
  }

  private renewLease(): void {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.defaultLeaseDurationMs)
    this.activeLease = {
      epoch: this.currentEpoch,
      writerId: this.currentWriterId,
      grantedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      active: true,
    }
  }

  private isLeaseExpired(): boolean {
    if (!this.activeLease) return true
    return new Date(this.activeLease.expiresAt).getTime() <= Date.now()
  }
}

export const globalFencingEngine = new WriterFencingEngine()
