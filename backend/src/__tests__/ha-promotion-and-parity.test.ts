import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  clearRegisteredWriterClients,
  executeControlledStandbyPromotion,
  FencingTokenRejectedError,
  getReplicaObservabilityMetrics,
  queryReadClient,
  recoverFormerPrimary,
  replicaCircuitBreaker,
  resetReplicaMetricsForTest,
  SchemaFingerprintEngine,
  selectReadClient,
  setReplicaClientForTest,
  setReplicationLagProbeForTest,
  WriterFencingEngine,
  type CatalogSchemaSnapshot,
  type DistributedWriterLeaseRecord,
  type WriterLeaseStore,
} from '../db/index'

function makeCatalog(extra?: Partial<CatalogSchemaSnapshot>): CatalogSchemaSnapshot {
  return {
    tables: [
      {
        name: 'invoices',
        columns: [
          { name: 'id', type: 'uuid', nullable: false },
          { name: 'workspace_id', type: 'uuid', nullable: false },
          { name: 'total_minor', type: 'bigint', nullable: false, defaultValue: '0' },
        ],
      },
    ],
    indexes: [
      {
        name: 'invoices_pkey',
        table: 'invoices',
        unique: true,
        definition: 'CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id)',
      },
    ],
    constraints: [
      {
        name: 'invoices_pkey',
        table: 'invoices',
        type: 'p',
        definition: 'PRIMARY KEY (id)',
        validated: true,
      },
    ],
    rlsPolicies: [
      {
        table: 'invoices',
        name: 'tenant_isolation',
        command: 'ALL',
        roles: ['authenticated'],
        usingExpr: 'workspace_id = current_workspace_id()',
      },
    ],
    grants: [
      {
        grantee: 'service_role',
        objectType: 'table',
        objectName: 'invoices',
        privilege: 'SELECT',
      },
    ],
    extensions: ['pgcrypto@1.3'],
    sequences: ['invoice_seq'],
    views: [
      {
        name: 'v_invoice_totals',
        materialized: false,
        definition: 'SELECT workspace_id, count(*) FROM invoices GROUP BY workspace_id',
      },
    ],
    functions: ['post_invoice(uuid)'],
    triggers: ['trg_invoices_audit'],
    ...extra,
  }
}

function createInMemoryLeaseStore(
  initialWriter = 'primary-a',
  initialEpoch = 1,
): {
  store: WriterLeaseStore
  getState: () => DistributedWriterLeaseRecord
} {
  let state: DistributedWriterLeaseRecord = {
    clusterKey: 'primary-cluster',
    epoch: initialEpoch,
    writerId: initialWriter,
    leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
    fenceSignature: 'init-sig',
  }
  const store: WriterLeaseStore = {
    async readLease() {
      return { ...state }
    },
    async acquireOrRenewLease(p) {
      if (p.epoch < state.epoch) {
        throw new FencingTokenRejectedError('stale epoch', state.epoch, p.epoch)
      }
      if (
        p.epoch === state.epoch &&
        p.writerId !== state.writerId &&
        new Date(state.leaseExpiresAt).getTime() > Date.now()
      ) {
        throw new FencingTokenRejectedError('active lease conflict', state.epoch, p.epoch)
      }
      state = {
        ...state,
        epoch: p.epoch,
        writerId: p.writerId,
        leaseExpiresAt: new Date(Date.now() + p.ttlMs).toISOString(),
        fenceSignature: p.fenceSignature,
      }
      return { ...state }
    },
    async promoteStandby(p) {
      if (p.expectedEpoch !== state.epoch) {
        throw new FencingTokenRejectedError('promotion CAS mismatch', state.epoch, p.expectedEpoch)
      }
      state = {
        ...state,
        epoch: state.epoch + 1,
        writerId: p.newWriterId,
        leaseExpiresAt: new Date(Date.now() + p.ttlMs).toISOString(),
        fenceSignature: p.fenceSignature,
      }
      return { ...state }
    },
    async assertWriterEpoch(p) {
      return (
        p.epoch === state.epoch &&
        p.writerId === state.writerId &&
        new Date(state.leaseExpiresAt).getTime() > Date.now()
      )
    },
  }
  return { store, getState: () => ({ ...state }) }
}

describe('HA Promotion, Fail-Closed Fencing, Real Replica Lag & Schema Parity', () => {
  const dummyReplica = { name: 'replica-client' } as unknown as SupabaseClient
  const standbyClient = { name: 'standby-promoted' } as unknown as SupabaseClient

  beforeEach(() => {
    setReplicaClientForTest(null)
    setReplicationLagProbeForTest(null)
    replicaCircuitBreaker.reset()
    resetReplicaMetricsForTest()
    clearRegisteredWriterClients()
  })

  afterEach(() => {
    setReplicaClientForTest(null)
    setReplicationLagProbeForTest(null)
    clearRegisteredWriterClients()
  })

  it('fails closed when distributed lease store is required and missing, and records degraded metrics', async () => {
    const engine = new WriterFencingEngine({
      initialEpoch: 1,
      initialWriterId: 'primary-a',
      requireDistributedLeaseStore: true,
      leaseStore: null,
    })
    const tok = engine.generateFencingToken()

    expect(() => engine.assertValidWriter(tok)).toThrow(FencingTokenRejectedError)
    expect(engine.isDegraded()).toBe(true)

    await expect(engine.syncAndAcquireDistributedLease()).rejects.toThrow(
      /No distributed WriterLeaseStore/,
    )
    const metrics = engine.getObservabilityMetrics()
    expect(metrics.degraded).toBe(true)
    expect(metrics.distributedStoreBound).toBe(false)
    expect(metrics.leaseRenewalFailures).toBe(1)
  })

  it('prevents concurrent promotion and quarantines former primary against returning split-brain writes', async () => {
    const { store } = createInMemoryLeaseStore('primary-a', 1)
    const engine = new WriterFencingEngine({
      initialEpoch: 1,
      initialWriterId: 'primary-a',
      leaseStore: store,
      requireDistributedLeaseStore: true,
    })
    const oldToken = engine.generateFencingToken()
    const catalog = makeCatalog()

    const audit = await executeControlledStandbyPromotion({
      engine,
      leaseStore: store,
      candidate: {
        standbyId: 'standby-b',
        eligible: true,
        replicationHealthy: true,
        lagMs: 45,
        lagSource: 'wal_replay',
        measurementAgeMs: 250,
      },
      primaryCatalog: catalog,
      standbyCatalog: catalog,
      primaryMigrationDigest: 'digest-v75',
      standbyMigrationDigest: 'digest-v75',
      standbyClient,
      approved: true,
      authorizedBy: 'SRE Lead',
      reason: 'Primary host unreachable',
    })

    expect(audit.decision.newEpoch).toBe(2)
    expect(audit.decision.newWriterId).toBe('standby-b')
    expect(audit.completedStages).toContain('AUDITED_COMPLETE')
    expect(audit.quarantinedFormerPrimary).toBe('primary-a')

    // Old primary token is rejected locally AND distributedly
    expect(() => engine.assertValidWriter(oldToken)).toThrow(FencingTokenRejectedError)
    await expect(engine.assertValidWriterDistributed(oldToken, store)).rejects.toThrow(
      FencingTokenRejectedError,
    )

    // Recovery verifies former primary is quarantined & silent failback is blocked
    const recovery = await recoverFormerPrimary({
      engine,
      leaseStore: store,
      formerPrimaryId: 'primary-a',
      formerPrimaryEpoch: 1,
    })
    expect(recovery.status).toBe('QUARANTINED_AS_STANDBY')
    expect(recovery.silentFailbackBlocked).toBe(true)

    // Concurrent second controller trying CAS at stale epoch 1 fails atomically
    await expect(
      store.promoteStandby({
        clusterKey: 'primary-cluster',
        expectedEpoch: 1,
        newWriterId: 'standby-c',
        authorizedBy: 'SRE 2',
        reason: 'Race promotion',
        ttlMs: 30_000,
        fenceSignature: 'sig-c',
      }),
    ).rejects.toThrow(FencingTokenRejectedError)
  })

  it('aborts promotion on RTT-only lag, stale lag measurement, ineligible standby, schema drift, or stage crash', async () => {
    const { store } = createInMemoryLeaseStore('primary-a', 1)
    const engine = new WriterFencingEngine({
      initialEpoch: 1,
      initialWriterId: 'primary-a',
      leaseStore: store,
      requireDistributedLeaseStore: true,
    })
    const primaryCat = makeCatalog()
    const driftedCat = makeCatalog({
      views: [
        {
          name: 'v_invoice_totals',
          materialized: true,
          definition: 'SELECT workspace_id, count(*) FROM invoices GROUP BY workspace_id',
        },
      ],
    })

    // Rejects RTT fallback as unverified lag
    await expect(
      executeControlledStandbyPromotion({
        engine,
        leaseStore: store,
        candidate: {
          standbyId: 'standby-b',
          eligible: true,
          replicationHealthy: true,
          lagMs: 5,
          lagSource: 'rtt_fallback',
          measurementAgeMs: 100,
        },
        primaryCatalog: primaryCat,
        standbyCatalog: primaryCat,
        primaryMigrationDigest: 'd1',
        standbyMigrationDigest: 'd1',
        standbyClient,
        approved: true,
        authorizedBy: 'SRE',
        reason: 'Test RTT rejection',
      }),
    ).rejects.toThrow(/Genuine WAL lag verification required/)

    // Rejects stale measurement
    await expect(
      executeControlledStandbyPromotion({
        engine,
        leaseStore: store,
        candidate: {
          standbyId: 'standby-b',
          eligible: true,
          replicationHealthy: true,
          lagMs: 20,
          lagSource: 'wal_replay',
          measurementAgeMs: 60_000,
        },
        primaryCatalog: primaryCat,
        standbyCatalog: primaryCat,
        primaryMigrationDigest: 'd1',
        standbyMigrationDigest: 'd1',
        standbyClient,
        approved: true,
        authorizedBy: 'SRE',
        reason: 'Test stale rejection',
      }),
    ).rejects.toThrow(/stale/i)

    // Rejects schema/view drift before epoch increment
    await expect(
      executeControlledStandbyPromotion({
        engine,
        leaseStore: store,
        candidate: {
          standbyId: 'standby-b',
          eligible: true,
          replicationHealthy: true,
          lagMs: 20,
          lagSource: 'wal_replay',
          measurementAgeMs: 100,
        },
        primaryCatalog: primaryCat,
        standbyCatalog: driftedCat,
        primaryMigrationDigest: 'd1',
        standbyMigrationDigest: 'd1',
        standbyClient,
        approved: true,
        authorizedBy: 'SRE',
        reason: 'Test schema drift',
      }),
    ).rejects.toThrow(/Schema parity FAILED/)

    // Simulated crash before promotion leaves epoch untouched at 1
    await expect(
      executeControlledStandbyPromotion({
        engine,
        leaseStore: store,
        candidate: {
          standbyId: 'standby-b',
          eligible: true,
          replicationHealthy: true,
          lagMs: 20,
          lagSource: 'wal_replay',
          measurementAgeMs: 100,
        },
        primaryCatalog: primaryCat,
        standbyCatalog: primaryCat,
        primaryMigrationDigest: 'd1',
        standbyMigrationDigest: 'd1',
        standbyClient,
        approved: true,
        authorizedBy: 'SRE',
        reason: 'Crash test',
        failAtStageForTest: 'DISTRIBUTED_LEASE_PROMOTED',
      }),
    ).rejects.toThrow(/Simulated crash/)
    expect(engine.getCurrentEpoch()).toBe(1)
  })

  it('never substitutes network RTT for replication lag, routes strong reads to primary, and tracks observability metrics', async () => {
    const rttOnlyClient = {
      rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'missing rpc' } }),
      from: () => ({
        select: () => ({
          limit: async () => ({ data: [{ id: '1' }], error: null }),
        }),
      }),
    } as unknown as SupabaseClient

    setReplicaClientForTest(rttOnlyClient)
    const routed = await queryReadClient({ callerPath: 'services/reporting/pnl.service.ts' })

    expect(routed.target).toBe('primary')
    expect(routed.reason).toBe('replica_lag_unknown')
    expect(routed.measuredLagMs).toBeNull()
    expect(routed.measurementSource).toBe('unavailable')
    expect(routed.rttMs).not.toBeNull()

    // Strong consistency policy ALWAYS routes to primary even when WAL lag is low
    setReplicaClientForTest(dummyReplica)
    const strongDecision = selectReadClient({
      callerPath: 'services/reporting/pnl.service.ts',
      replicaLagMs: 1,
      measurementSource: 'wal_replay',
      measurementAgeMs: 10,
      consistency: 'strong',
    })
    expect(strongDecision.target).toBe('primary')
    expect(strongDecision.reason).toBe('strong_consistency_required')

    // NaN, negative, and stale measurements fail closed
    expect(
      selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: Number.NaN,
      }).target,
    ).toBe('primary')
    expect(
      selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: -5,
      }).target,
    ).toBe('primary')
    expect(
      selectReadClient({
        callerPath: 'services/reporting/pnl.service.ts',
        replicaLagMs: 10,
        measurementSource: 'wal_replay',
        measurementAgeMs: 45_000,
        maxMeasurementAgeMs: 30_000,
      }).reason,
    ).toBe('replica_measurement_stale')

    const metrics = getReplicaObservabilityMetrics()
    expect(metrics.fallbackCount).toBeGreaterThanOrEqual(4)
    expect(metrics.source).toBe('unavailable')
  })

  it('distinguishes schema parity, migration parity, and data parity in SchemaFingerprintEngine', () => {
    const primary = makeCatalog()
    const standbySame = makeCatalog()
    const reportSame = SchemaFingerprintEngine.compareCatalogsWithReport({
      primary,
      standby: standbySame,
      primaryMigrationDigest: 'abc',
      standbyMigrationDigest: 'abc',
    })
    expect(reportSame.schemaParity).toBe(true)
    expect(reportSame.migrationParity).toBe(true)
    expect(reportSame.dataParityVerified).toBe(false)
    expect(reportSame.runtimeReadiness).toBe(true)

    const standbyIdxDiff = makeCatalog({ indexes: [] })
    const reportIdxDiff = SchemaFingerprintEngine.compareCatalogsWithReport({
      primary,
      standby: standbyIdxDiff,
      primaryMigrationDigest: 'abc',
      standbyMigrationDigest: 'abc',
    })
    expect(reportIdxDiff.nonBlockingDifferences.length).toBeGreaterThan(0)
    expect(reportIdxDiff.schemaParity).toBe(false)
  })
})
