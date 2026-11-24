import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearRegisteredWriterClients,
  FencingTokenRejectedError,
  globalFencingEngine,
  queryReadClient,
  replicaCircuitBreaker,
  selectReadClient,
  selectWriteClient,
  selectWriteClientDistributed,
  setReplicaClientForTest,
  setReplicationLagProbeForTest,
  WriterFencingEngine,
  type DistributedWriterLeaseRecord,
  type WriterLeaseStore,
} from '../db/index'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('Database HA Routing & Fencing Engine', () => {
  const dummyReplica = { name: 'mock-replica-client' } as unknown as SupabaseClient
  const dummyPromotedStandby = { name: 'mock-promoted-standby-client' } as unknown as SupabaseClient

  beforeEach(() => {
    setReplicaClientForTest(null)
    replicaCircuitBreaker.reset()
    clearRegisteredWriterClients()
  })

  afterEach(() => {
    clearRegisteredWriterClients()
    setReplicationLagProbeForTest(null)
    globalFencingEngine.resetForTest()
  })

  describe('selectReadClient', () => {
    it('routes to primary when caller is not in allowlist', () => {
      const decision = selectReadClient({
        callerPath: 'routes/invoices.routes.ts',
        replicaLagMs: 10,
      })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('caller_not_allowlisted')
    })

    it('routes to primary when replica is not configured', () => {
      const decision = selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: 10,
      })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('replica_unset_fallback')
    })

    it('fails closed to primary when replica lag is unknown (null or undefined)', () => {
      setReplicaClientForTest(dummyReplica)
      const undefinedLag = selectReadClient({ callerPath: 'services/reporting/pnl.service.ts' })
      expect(undefinedLag.target).toBe('primary')
      expect(undefinedLag.reason).toBe('replica_lag_unknown')

      const nullLag = selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: null,
      })
      expect(nullLag.target).toBe('primary')
      expect(nullLag.reason).toBe('replica_lag_unknown')
    })

    it('routes to replica when caller is allowlisted, replica is configured, and lag is within threshold', () => {
      setReplicaClientForTest(dummyReplica)
      const decision = selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: 25,
      })
      expect(decision.target).toBe('replica')
      expect(decision.reason).toBe('replica_healthy')
    })

    it('routes to primary when replica lag exceeds max threshold', () => {
      setReplicaClientForTest(dummyReplica)
      const decision = selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: 8000,
        maxLagMs: 5000,
      })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('replica_lag_exceeded')
    })

    it('routes to primary when replica circuit breaker is tripped', () => {
      setReplicaClientForTest(dummyReplica)
      replicaCircuitBreaker.recordFailure()
      replicaCircuitBreaker.recordFailure()
      replicaCircuitBreaker.recordFailure()

      expect(replicaCircuitBreaker.getState()).toBe('open')

      const decision = selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: 10,
      })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('circuit_breaker_open')
    })

    it('queryReadClient probes live WAL lag and fails closed on unknown or excessive lag', async () => {
      setReplicaClientForTest(dummyReplica)

      // Healthy measured WAL replay lag -> routes to replica
      setReplicationLagProbeForTest(async () => ({ lagMs: 42, source: 'wal_replay' }))
      const healthy = await queryReadClient({ callerPath: 'services/reporting/pnl.service.ts' })
      expect(healthy.target).toBe('replica')
      expect(healthy.measuredLagMs).toBe(42)

      // Unreachable/null probe -> fails closed to primary
      setReplicationLagProbeForTest(async () => ({ lagMs: null, source: 'unavailable' }))
      const unknown = await queryReadClient({ callerPath: 'services/reporting/pnl.service.ts' })
      expect(unknown.target).toBe('primary')
      expect(unknown.reason).toBe('replica_lag_unknown')
    })
  })

  describe('Writer Fencing & Split-Brain Prevention', () => {
    it('accepts writes with valid cryptographically signed current-epoch token', () => {
      const engine = new WriterFencingEngine({ initialEpoch: 5, initialWriterId: 'writer-iran-01' })
      const token = engine.generateFencingToken()

      expect(token.epoch).toBe(5)
      expect(token.writerId).toBe('writer-iran-01')
      expect(token.signature).toMatch(/^[0-9a-f]{64}$/)
      expect(() => engine.assertValidWriter(token)).not.toThrow()
    })

    it('rejects missing token, forged HMAC signature, future epoch, and expired lease without auto-renewal', () => {
      const engine = new WriterFencingEngine({
        initialEpoch: 10,
        initialWriterId: 'writer-iran-01',
      })
      const valid = engine.generateFencingToken()

      // Missing token refuses fail-closed
      expect(() => engine.assertValidWriter(null)).toThrow(FencingTokenRejectedError)

      // Tampered signature refuses
      expect(() => engine.assertValidWriter({ ...valid, signature: '0'.repeat(64) })).toThrow(
        FencingTokenRejectedError,
      )

      // Unpromoted future epoch refuses
      expect(() => engine.assertValidWriter({ ...valid, epoch: 11 })).toThrow(
        FencingTokenRejectedError,
      )

      // Expired lease is reported inactive and refuses writes (no silent auto-renewal!)
      engine.expireLeaseForTest()
      expect(engine.getActiveLease().active).toBe(false)
      expect(() => engine.assertValidWriter(valid)).toThrow(FencingTokenRejectedError)

      // Explicit heartbeat renewal by current epoch restores lease
      engine.renewLeaseHeartbeat(10, 'writer-iran-01')
      expect(engine.getActiveLease().active).toBe(true)
      expect(() => engine.assertValidWriter(valid)).not.toThrow()
    })

    it('rejects writes with a stale epoch (Split-Brain defense)', () => {
      const engine = new WriterFencingEngine({
        initialEpoch: 10,
        initialWriterId: 'writer-iran-01',
      })
      const staleToken = {
        epoch: 9,
        writerId: 'writer-iran-01',
        issuedAt: new Date().toISOString(),
      }

      expect(() => engine.assertValidWriter(staleToken)).toThrow(FencingTokenRejectedError)
    })

    it('rejects writes from an unapproved writer node', () => {
      const engine = new WriterFencingEngine({
        initialEpoch: 10,
        initialWriterId: 'writer-iran-01',
      })
      const rogueToken = {
        epoch: 10,
        writerId: 'deposed-writer-02',
        issuedAt: new Date().toISOString(),
      }

      expect(() => engine.assertValidWriter(rogueToken)).toThrow(FencingTokenRejectedError)
    })

    it('promotes standby with strict epoch increment and switches live write target away from deposed primary', () => {
      const engine = new WriterFencingEngine({ initialEpoch: 1, initialWriterId: 'primary-node-a' })
      const oldToken = engine.generateFencingToken()

      const decision = engine.promoteStandby({
        approved: true,
        previousWriterId: 'primary-node-a',
        newWriterId: 'standby-node-b',
        reason: 'Primary failure detected in region',
        authorizedBy: 'Operations Lead (Hamed)',
      })

      expect(decision.newEpoch).toBe(2)
      expect(decision.newWriterId).toBe('standby-node-b')
      expect(engine.getCurrentEpoch()).toBe(2)
      expect(engine.getCurrentWriterId()).toBe('standby-node-b')

      // Old writer token with epoch 1 is now rejected even though it had a valid signature
      expect(() => engine.assertValidWriter(oldToken)).toThrow(FencingTokenRejectedError)

      // New writer token with epoch 2 is accepted
      const newToken = engine.generateFencingToken()
      expect(() => engine.assertValidWriter(newToken)).not.toThrow()
    })

    it('switches selectWriteClient() connection when globalFencingEngine promotes a standby client', () => {
      const originalEpoch = globalFencingEngine.getCurrentEpoch()
      const originalWriter = globalFencingEngine.getCurrentWriterId()

      const initialToken = globalFencingEngine.generateFencingToken()
      const initialRoute = selectWriteClient({ fencingToken: initialToken })
      expect(initialRoute.target).toBe('primary')

      const promoted = globalFencingEngine.promoteStandby({
        approved: true,
        previousWriterId: originalWriter,
        newWriterId: 'standby-node-failover-test',
        reason: 'Primary outage simulation',
        authorizedBy: 'HA Controller',
        newWriterClient: dummyPromotedStandby,
      })

      expect(promoted.newEpoch).toBe(originalEpoch + 1)

      // Deposed primary token is refused immediately
      expect(() => selectWriteClient({ fencingToken: initialToken })).toThrow(
        FencingTokenRejectedError,
      )

      // Promoted writer token resolves directly to promoted standby DB client
      const promotedToken = globalFencingEngine.generateFencingToken()
      const failoverRoute = selectWriteClient({ fencingToken: promotedToken })
      expect(failoverRoute.target).toBe('standby_promoted')
      expect(failoverRoute.writerId).toBe('standby-node-failover-test')
      expect(failoverRoute.client).toBe(dummyPromotedStandby)
    })

    it('enforces shared distributed WriterLeaseStore to stop split-brain partitioned nodes', async () => {
      let sharedState: DistributedWriterLeaseRecord = {
        clusterKey: 'cluster-prod',
        epoch: 1,
        writerId: 'node-a',
        leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
        fenceSignature: 'init',
      }

      const distributedStore: WriterLeaseStore = {
        async readLease() {
          return { ...sharedState }
        },
        async acquireOrRenewLease(p) {
          if (p.epoch < sharedState.epoch) {
            throw new FencingTokenRejectedError('stale', sharedState.epoch, p.epoch)
          }
          sharedState = {
            ...sharedState,
            writerId: p.writerId,
            epoch: p.epoch,
            leaseExpiresAt: new Date(Date.now() + p.ttlMs).toISOString(),
          }
          return { ...sharedState }
        },
        async promoteStandby(p) {
          if (p.expectedEpoch !== sharedState.epoch) {
            throw new FencingTokenRejectedError('cas mismatch', sharedState.epoch, p.expectedEpoch)
          }
          sharedState = {
            ...sharedState,
            epoch: sharedState.epoch + 1,
            writerId: p.newWriterId,
            leaseExpiresAt: new Date(Date.now() + p.ttlMs).toISOString(),
          }
          return { ...sharedState }
        },
        async assertWriterEpoch(p) {
          return (
            p.epoch === sharedState.epoch &&
            p.writerId === sharedState.writerId &&
            new Date(sharedState.leaseExpiresAt).getTime() > Date.now()
          )
        },
      }

      const nodeA = new WriterFencingEngine({
        initialEpoch: 1,
        initialWriterId: 'node-a',
        clusterKey: 'cluster-prod',
        leaseStore: distributedStore,
      })
      const tokenA = nodeA.generateFencingToken()

      // Standby node promotes cluster to epoch 2 in the shared store
      const standbyController = new WriterFencingEngine({
        initialEpoch: 1,
        initialWriterId: 'node-a',
        clusterKey: 'cluster-prod',
        leaseStore: distributedStore,
      })
      await standbyController.promoteStandbyDistributed({
        approved: true,
        previousWriterId: 'node-a',
        newWriterId: 'node-b',
        reason: 'Failover to node-b',
        authorizedBy: 'SRE',
      })

      // Even though partitioned nodeA still thinks epoch=1 in its local RAM, distributed check rejects it
      await expect(nodeA.assertValidWriterDistributed(tokenA)).rejects.toThrow(
        FencingTokenRejectedError,
      )
      await expect(nodeA.syncAndAcquireDistributedLease()).rejects.toThrow(
        FencingTokenRejectedError,
      )

      // Global helper exercises selectWriteClientDistributed with a shared store rejecting deposed token
      globalFencingEngine.setLeaseStore(distributedStore)
      await expect(
        selectWriteClientDistributed({
          fencingToken: globalFencingEngine.generateFencingToken(),
          leaseStore: distributedStore,
        }),
      ).rejects.toThrow(FencingTokenRejectedError)
      globalFencingEngine.setLeaseStore(null)
    })

    it('refuses unapproved promotion', () => {
      const engine = new WriterFencingEngine({ initialEpoch: 1, initialWriterId: 'primary-node-a' })

      expect(() =>
        engine.promoteStandby({
          approved: false,
          previousWriterId: 'primary-node-a',
          newWriterId: 'standby-node-b',
          reason: 'Unverified heartbeat loss',
          authorizedBy: 'Automated Bot',
        }),
      ).toThrow(/Explicit human or controller approval required/)
    })
  })
})
