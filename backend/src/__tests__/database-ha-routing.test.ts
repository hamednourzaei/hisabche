import { beforeEach, describe, expect, it } from 'vitest'
import {
  selectReadClient,
  selectWriteClient,
  setReplicaClientForTest,
  globalFencingEngine,
  WriterFencingEngine,
  FencingTokenRejectedError,
  replicaCircuitBreaker,
} from '../db/index'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('Database HA Routing & Fencing Engine', () => {
  const dummyReplica = { name: 'mock-replica-client' } as unknown as SupabaseClient

  beforeEach(() => {
    setReplicaClientForTest(null)
    replicaCircuitBreaker.reset()
  })

  describe('selectReadClient', () => {
    it('routes to primary when caller is not in allowlist', () => {
      const decision = selectReadClient({ callerPath: 'routes/invoices.routes.ts' })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('caller_not_allowlisted')
    })

    it('routes to primary when replica is not configured', () => {
      const decision = selectReadClient({ callerPath: 'services/reporting/pnl.service.ts' })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('replica_unset_fallback')
    })

    it('routes to replica when caller is allowlisted and replica is configured', () => {
      setReplicaClientForTest(dummyReplica)
      const decision = selectReadClient({ callerPath: 'services/reporting/pnl.service.ts' })
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
      // Trip the breaker with consecutive failures
      replicaCircuitBreaker.recordFailure()
      replicaCircuitBreaker.recordFailure()
      replicaCircuitBreaker.recordFailure()

      expect(replicaCircuitBreaker.getState()).toBe('open')

      const decision = selectReadClient({ callerPath: 'services/reporting/pnl.service.ts' })
      expect(decision.target).toBe('primary')
      expect(decision.reason).toBe('circuit_breaker_open')
    })
  })

  describe('Writer Fencing & Split-Brain Prevention', () => {
    it('accepts writes with valid current epoch', () => {
      const engine = new WriterFencingEngine({ initialEpoch: 5, initialWriterId: 'writer-iran-01' })
      const token = engine.generateFencingToken()

      expect(token.epoch).toBe(5)
      expect(token.writerId).toBe('writer-iran-01')
      expect(() => engine.assertValidWriter(token)).not.toThrow()
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

    it('promotes standby with strict epoch increment and fencing of old writer', () => {
      const engine = new WriterFencingEngine({ initialEpoch: 1, initialWriterId: 'primary-node-a' })

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

      // Old writer token with epoch 1 is now rejected
      const oldToken = {
        epoch: 1,
        writerId: 'primary-node-a',
        issuedAt: new Date().toISOString(),
      }
      expect(() => engine.assertValidWriter(oldToken)).toThrow(FencingTokenRejectedError)

      // New writer token with epoch 2 is accepted
      const newToken = engine.generateFencingToken()
      expect(() => engine.assertValidWriter(newToken)).not.toThrow()
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

    it('selectWriteClient integrates with globalFencingEngine', () => {
      const token = globalFencingEngine.generateFencingToken()
      const writeClient = selectWriteClient({ fencingToken: token })

      expect(writeClient.target).toBe('primary')
      expect(writeClient.epoch).toBe(globalFencingEngine.getCurrentEpoch())
      expect(writeClient.writerId).toBe(globalFencingEngine.getCurrentWriterId())
    })
  })
})
