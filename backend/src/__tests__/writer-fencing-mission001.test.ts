import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WriterFencingEngine, FencingTokenRejectedError } from '../db/fencing'
import type { DistributedWriterLeaseRecord, WriterLeaseStore } from '../db/runtime-types'
import { buildServer } from '../index'
import { setPrimaryHealthProbeForTest } from '../routes/database-ha.routes'

const DEV_SECRET = 'hisabche-dev-fencing-secret-local-only'

function createInMemoryLeaseStore(initialNowMs = Date.now()): {
  store: WriterLeaseStore
  setNowMs: (ms: number) => void
  setOutage: (down: boolean) => void
  getRecord: (clusterKey: string) => DistributedWriterLeaseRecord | null
} {
  let nowMs = initialNowMs
  let outage = false
  const records = new Map<string, DistributedWriterLeaseRecord>()

  const assertOnline = () => {
    if (outage) {
      throw new Error('Simulated lease store outage')
    }
  }

  const store: WriterLeaseStore = {
    async readLease(clusterKey: string): Promise<DistributedWriterLeaseRecord | null> {
      assertOnline()
      return records.get(clusterKey) ?? null
    },

    async acquireOrRenewLease(params): Promise<DistributedWriterLeaseRecord> {
      assertOnline()
      const existing = records.get(params.clusterKey)
      if (existing) {
        const existingExpiresMs = Date.parse(existing.leaseExpiresAt)
        if (existing.epoch > params.epoch) {
          throw new FencingTokenRejectedError(
            `ERR_FENCING_TOKEN_REJECTED: stale epoch ${params.epoch} < ${existing.epoch}`,
            existing.epoch,
            params.epoch,
          )
        }
        if (
          existing.epoch === params.epoch &&
          existing.writerId !== params.writerId &&
          existingExpiresMs > nowMs
        ) {
          throw new FencingTokenRejectedError(
            `ERR_FENCING_TOKEN_REJECTED: lease held by ${existing.writerId}`,
            existing.epoch,
            params.epoch,
          )
        }
      }

      const next: DistributedWriterLeaseRecord = {
        clusterKey: params.clusterKey,
        epoch: params.epoch,
        writerId: params.writerId,
        leaseExpiresAt: new Date(nowMs + params.ttlMs).toISOString(),
        fenceSignature: params.fenceSignature,
      }
      records.set(params.clusterKey, next)
      return next
    },

    async promoteStandby(params): Promise<DistributedWriterLeaseRecord> {
      assertOnline()
      const existing = records.get(params.clusterKey)
      if (existing && existing.epoch !== params.expectedEpoch) {
        throw new FencingTokenRejectedError(
          `ERR_FENCING_TOKEN_REJECTED: CAS mismatch expected ${params.expectedEpoch}, actual ${existing.epoch}`,
          existing.epoch,
          params.expectedEpoch,
        )
      }
      const nextEpoch = (existing?.epoch ?? params.expectedEpoch) + 1
      const promoted: DistributedWriterLeaseRecord = {
        clusterKey: params.clusterKey,
        epoch: nextEpoch,
        writerId: params.newWriterId,
        leaseExpiresAt: new Date(nowMs + params.ttlMs).toISOString(),
        fenceSignature: params.fenceSignature,
      }
      records.set(params.clusterKey, promoted)
      return promoted
    },

    async assertWriterEpoch(params): Promise<boolean> {
      assertOnline()
      const existing = records.get(params.clusterKey)
      if (!existing) return false
      if (Date.parse(existing.leaseExpiresAt) <= nowMs) return false
      return existing.epoch === params.epoch && existing.writerId === params.writerId
    },
  }

  return {
    store,
    setNowMs: (ms: number) => {
      nowMs = ms
    },
    setOutage: (down: boolean) => {
      outage = down
    },
    getRecord: (clusterKey: string) => records.get(clusterKey) ?? null,
  }
}

describe('WriterFencingEngine — Mission 001', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('1. Configuration', () => {
    it('throws in NODE_ENV=production when WRITER_FENCING_SECRET is missing without leaking secrets', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.WRITER_FENCING_SECRET

      let caught: Error | null = null
      try {
        new WriterFencingEngine({ requireDistributedLeaseStore: false })
      } catch (err) {
        caught = err as Error
      }

      expect(caught).toBeInstanceOf(Error)
      expect(caught?.message).toContain('WRITER_FENCING_SECRET')
      expect(caught?.message).not.toContain(DEV_SECRET)
    })

    it('throws in NODE_ENV=production for empty or whitespace-only secret', () => {
      process.env.NODE_ENV = 'production'
      process.env.WRITER_FENCING_SECRET = '     \t\n  '

      expect(() => new WriterFencingEngine({ requireDistributedLeaseStore: false })).toThrow()
    })

    it('throws in NODE_ENV=production when trimmed secret is shorter than 16 chars', () => {
      process.env.NODE_ENV = 'production'
      process.env.WRITER_FENCING_SECRET = '   short-secret   '

      expect(() => new WriterFencingEngine({ requireDistributedLeaseStore: false })).toThrow()
    })

    it('throws in NODE_ENV=production when hardcoded dev secret is used', () => {
      process.env.NODE_ENV = 'production'
      process.env.WRITER_FENCING_SECRET = DEV_SECRET

      expect(() => new WriterFencingEngine({ requireDistributedLeaseStore: false })).toThrow(
        /local development secret/i,
      )
    })

    it('throws in NODE_ENV=production when JWT_SECRET is set without WRITER_FENCING_SECRET (key separation)', () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'a-very-long-jwt-secret-that-is-over-32-chars'
      delete process.env.WRITER_FENCING_SECRET

      expect(() => new WriterFencingEngine({ requireDistributedLeaseStore: false })).toThrow()
    })

    it('succeeds in NODE_ENV=production with valid >= 16-char secret and trims whitespace', () => {
      process.env.NODE_ENV = 'production'
      const raw = '  prod-fencing-secret-0123456789  '
      process.env.WRITER_FENCING_SECRET = raw

      const engine = new WriterFencingEngine({ requireDistributedLeaseStore: false })
      const trimmedEngine = new WriterFencingEngine({
        fencingSecret: raw.trim(),
        requireDistributedLeaseStore: false,
      })

      const now = new Date()
      const tokenFromEnv = engine.generateFencingToken(now)
      expect(() => trimmedEngine.assertValidWriter(tokenFromEnv, now.getTime())).not.toThrow()
    })

    it('allows development and test environments to operate without WRITER_FENCING_SECRET', () => {
      delete process.env.WRITER_FENCING_SECRET

      process.env.NODE_ENV = 'development'
      const devEngine = new WriterFencingEngine({ requireDistributedLeaseStore: false })
      expect(() => devEngine.assertValidWriter(devEngine.generateFencingToken())).not.toThrow()

      process.env.NODE_ENV = 'test'
      const testEngine = new WriterFencingEngine({ requireDistributedLeaseStore: false })
      expect(() => testEngine.assertValidWriter(testEngine.generateFencingToken())).not.toThrow()
    })
  })

  describe('2. Token integrity', () => {
    const secret = 'test-fencing-secret-0123456789abcdef'

    it('accepts a valid signed fencing token', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        requireDistributedLeaseStore: false,
      })
      const token = engine.generateFencingToken()
      expect(() => engine.assertValidWriter(token)).not.toThrow()
    })

    it('rejects a token with tampered epoch, writerId, or issuedAt', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        initialEpoch: 3,
        initialWriterId: 'writer-a',
        requireDistributedLeaseStore: false,
      })
      const base = engine.generateFencingToken()

      expect(() => engine.assertValidWriter({ ...base, epoch: 4 })).toThrow(
        FencingTokenRejectedError,
      )

      expect(() => engine.assertValidWriter({ ...base, writerId: 'writer-b' })).toThrow(
        FencingTokenRejectedError,
      )

      expect(() =>
        engine.assertValidWriter({
          ...base,
          issuedAt: new Date(Date.parse(base.issuedAt) + 1000).toISOString(),
        }),
      ).toThrow(FencingTokenRejectedError)
    })

    it('rejects a token with invalid signature', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        requireDistributedLeaseStore: false,
      })
      const token = engine.generateFencingToken()
      const badSig = '0'.repeat(token.signature?.length ?? 64)

      expect(() => engine.assertValidWriter({ ...token, signature: badSig })).toThrow(
        FencingTokenRejectedError,
      )
    })

    it('rejects an expired token (beyond maxTokenAgeMs or expired lease)', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        leaseDurationMs: 10_000,
        requireDistributedLeaseStore: false,
      })
      const issuedAt = new Date()
      const token = engine.generateFencingToken(issuedAt)

      // Beyond maxTokenAgeMs while lease is still active
      expect(() =>
        engine.assertValidWriter(token, issuedAt.getTime() + 5_001, { maxTokenAgeMs: 5_000 }),
      ).toThrow(FencingTokenRejectedError)

      // Beyond lease expiration
      expect(() => engine.assertValidWriter(token, issuedAt.getTime() + 10_001)).toThrow(
        FencingTokenRejectedError,
      )
    })

    it('rejects a token with wrong writer identity', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        initialWriterId: 'primary-01',
        requireDistributedLeaseStore: false,
      })
      const otherEngine = new WriterFencingEngine({
        fencingSecret: secret,
        initialWriterId: 'standby-02',
        requireDistributedLeaseStore: false,
      })
      const otherToken = otherEngine.generateFencingToken()

      expect(() => engine.assertValidWriter(otherToken)).toThrow(FencingTokenRejectedError)
    })

    it('rejects future-clock-skew / replay beyond maxClockSkewMs', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        requireDistributedLeaseStore: false,
      })
      const nowMs = Date.now()
      const futureToken = engine.generateFencingToken(new Date(nowMs + 10_000))

      expect(() => engine.assertValidWriter(futureToken, nowMs, { maxClockSkewMs: 5_000 })).toThrow(
        FencingTokenRejectedError,
      )
    })

    it('rejects stale fencing generation (older epoch)', () => {
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        initialEpoch: 1,
        requireDistributedLeaseStore: false,
      })
      const staleToken = engine.generateFencingToken()

      engine.promoteStandby({
        approved: true,
        previousWriterId: 'primary-master-01',
        newWriterId: 'standby-02',
        authorizedBy: 'ops',
        reason: 'failover',
        clusterKey: 'primary-cluster',
      })

      expect(() => engine.assertValidWriter(staleToken)).toThrow(FencingTokenRejectedError)
    })
  })

  describe('3. Distributed behavior', () => {
    const secret = 'dist-fencing-secret-0123456789abcdef'

    it('acquires and renews distributed lease via syncAndAcquireDistributedLease', async () => {
      const t0 = Date.now()
      const harness = createInMemoryLeaseStore(t0)
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        initialWriterId: 'writer-01',
        leaseDurationMs: 10_000,
        leaseStore: harness.store,
        requireDistributedLeaseStore: true,
      })

      const lease1 = await engine.syncAndAcquireDistributedLease()
      expect(lease1.active).toBe(true)
      expect(lease1.writerId).toBe('writer-01')
      expect(lease1.epoch).toBe(1)

      harness.setNowMs(t0 + 5_000)
      const lease2 = await engine.syncAndAcquireDistributedLease()
      expect(lease2.active).toBe(true)
      expect(Date.parse(lease2.expiresAt)).toBe(t0 + 15_000)
    })

    it('detects lease expiration when time advances past TTL', async () => {
      const t0 = Date.now()
      const harness = createInMemoryLeaseStore(t0)
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        leaseDurationMs: 5_000,
        leaseStore: harness.store,
        requireDistributedLeaseStore: true,
      })

      await engine.syncAndAcquireDistributedLease()
      const token = engine.generateFencingToken(new Date(t0))

      expect(engine.getActiveLease(t0 + 5_001).active).toBe(false)
      expect(() => engine.assertValidWriter(token, t0 + 5_001)).toThrow(FencingTokenRejectedError)
    })

    it('handles standby promotion and rejects old writer after promotion', async () => {
      const t0 = Date.now()
      const harness = createInMemoryLeaseStore(t0)

      const primary = new WriterFencingEngine({
        fencingSecret: secret,
        initialWriterId: 'primary-01',
        initialEpoch: 1,
        leaseDurationMs: 10_000,
        leaseStore: harness.store,
        requireDistributedLeaseStore: true,
      })

      await primary.syncAndAcquireDistributedLease()
      const oldToken = primary.generateFencingToken()

      const decision = await primary.promoteStandbyDistributed({
        approved: true,
        previousWriterId: 'primary-01',
        newWriterId: 'standby-02',
        authorizedBy: 'oncall-sre',
        reason: 'planned failover',
        clusterKey: 'primary-cluster',
      })

      expect(decision.newEpoch).toBe(2)
      expect(decision.newWriterId).toBe('standby-02')

      // Old writer's token is rejected both locally and against distributed store
      expect(() => primary.assertValidWriter(oldToken)).toThrow(FencingTokenRejectedError)
      await expect(primary.assertValidWriterDistributed(oldToken)).rejects.toThrow(
        FencingTokenRejectedError,
      )
    })

    it('fails closed during temporary lease-store outage and recovers after outage', async () => {
      const harness = createInMemoryLeaseStore(Date.now())
      const engine = new WriterFencingEngine({
        fencingSecret: secret,
        leaseStore: harness.store,
        requireDistributedLeaseStore: true,
      })

      await engine.syncAndAcquireDistributedLease()

      // Simulate outage
      harness.setOutage(true)
      await expect(engine.syncAndAcquireDistributedLease()).rejects.toThrow(
        /Simulated lease store outage/,
      )
      expect(engine.isDegraded()).toBe(true)

      // Recovery
      harness.setOutage(false)
      const recovered = await engine.syncAndAcquireDistributedLease()
      expect(recovered.active).toBe(true)
      expect(engine.isDegraded()).toBe(false)
    })
  })

  describe('4. HTTP & Regression', () => {
    it('GET /api/health/db via buildServer() + app.inject() does not expose fenceSignature', async () => {
      setPrimaryHealthProbeForTest(async () => ({ healthy: true, latencyMs: 3 }))
      const app = await buildServer()
      try {
        const res = await app.inject({
          method: 'GET',
          url: '/api/health/db',
        })
        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.payload) as {
          routing?: {
            lease?: {
              fenceSignature?: unknown
              hasFenceSignature?: boolean
            }
          }
        }
        expect(body.routing?.lease).toBeDefined()
        expect(body.routing?.lease?.fenceSignature).toBeUndefined()
        expect(body.routing?.lease?.hasFenceSignature).toBe(true)
      } finally {
        await app.close()
      }
    })
  })
})
