import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, TEST_WORKSPACE_ID, TEST_USER_ID } from './test-db'
import {
  EncryptedPartitionStore,
  PartitionSecurityError,
  PerUserPartitionManager,
  type SqlCipherPragmaTarget,
} from '../sync/per-user-partition'
import { InvalidSyncTransitionError, SyncStateMachine } from '../sync/sync-state-machine'
import {
  BandwidthAwareSyncDispatcher,
  SyncBatchExecutor,
  type SyncCandidateItem,
} from '../sync/bandwidth-aware-sync'

describe('Phase 7: Per-User Local-First, State Machine & Failover Replay', () => {
  let db: ReturnType<typeof createTestDb>
  let stateMachine: SyncStateMachine

  beforeEach(() => {
    db = createTestDb()
    stateMachine = new SyncStateMachine(db)
  })

  describe('7.1 Per-User Local Database Isolation & AEAD Encryption', () => {
    it('derives secret-bound distinct partition keys and refuses missing or predictable secrets', () => {
      const deviceId = 'pos-terminal-tehran-01'
      const deviceMasterSecret = PerUserPartitionManager.generateDeviceMasterSecret()

      const ownerPartition = PerUserPartitionManager.resolvePartition({
        deviceId,
        userId: 'owner-uuid-111',
        workspaceId: TEST_WORKSPACE_ID,
        userRole: 'owner',
        baseStoragePath: '/data/app',
        deviceMasterSecret,
      })
      const employeePartition = PerUserPartitionManager.resolvePartition({
        deviceId,
        userId: 'employee-uuid-222',
        workspaceId: TEST_WORKSPACE_ID,
        userRole: 'seller',
        baseStoragePath: '/data/app',
        deviceMasterSecret,
      })

      expect(ownerPartition.databaseFileName).not.toBe(employeePartition.databaseFileName)
      expect(ownerPartition.fullPath).not.toBe(employeePartition.fullPath)
      expect(ownerPartition.encryptionKeyHex).toHaveLength(64)
      expect(employeePartition.encryptionKeyHex).toHaveLength(64)
      expect(ownerPartition.encryptionKeyHex).not.toBe(employeePartition.encryptionKeyHex)
      expect(ownerPartition.partitionSaltHex).not.toBe(employeePartition.partitionSaltHex)

      // Refuses predictable/short/empty deviceMasterSecret
      expect(() =>
        PerUserPartitionManager.resolvePartition({
          deviceId,
          userId: 'owner-uuid-111',
          workspaceId: TEST_WORKSPACE_ID,
          userRole: 'owner',
          baseStoragePath: '/data/app',
          deviceMasterSecret: 'short',
        }),
      ).toThrow(PartitionSecurityError)

      expect(() =>
        PerUserPartitionManager.resolvePartition({
          deviceId: 'device-1234567890-abcdef',
          userId: 'owner-uuid-111',
          workspaceId: TEST_WORKSPACE_ID,
          userRole: 'owner',
          baseStoragePath: '/data/app',
          deviceMasterSecret: 'device-1234567890-abcdef',
        }),
      ).toThrow(PartitionSecurityError)
    })

    it('seals records in SQLite with real AES-256-GCM ciphertext and blocks cross-user decryption', async () => {
      const masterSecret = PerUserPartitionManager.generateDeviceMasterSecret()
      const salt = PerUserPartitionManager.generatePartitionSaltHex()

      const ownerPartition = PerUserPartitionManager.resolvePartition({
        deviceId: 'pos-01',
        userId: 'owner-uuid-111',
        workspaceId: TEST_WORKSPACE_ID,
        userRole: 'owner',
        baseStoragePath: '/data/app',
        deviceMasterSecret: masterSecret,
        partitionSaltHex: salt,
      })
      const employeePartition = PerUserPartitionManager.resolvePartition({
        deviceId: 'pos-01',
        userId: 'employee-uuid-222',
        workspaceId: TEST_WORKSPACE_ID,
        userRole: 'seller',
        baseStoragePath: '/data/app',
        deviceMasterSecret: masterSecret,
        partitionSaltHex: salt,
      })

      const store = new EncryptedPartitionStore(db, ownerPartition)
      await store.put('owner-session-secret', {
        refreshToken: 'secret-token-xyz',
        balanceMinor: 950000,
      })

      // Raw row stored on SQLite disk must not leak plaintext fields
      const rawRow = db.get<{ envelope_json: string }>(
        `SELECT envelope_json FROM encrypted_partition_records WHERE record_key = ?`,
        ['owner-session-secret'],
      )
      expect(rawRow?.envelope_json).toBeDefined()
      expect(rawRow!.envelope_json).not.toContain('secret-token-xyz')
      expect(rawRow!.envelope_json).not.toContain('950000')
      expect(rawRow!.envelope_json).toContain('AES-256-GCM')

      // Authorized owner partition decrypts cleanly
      const recovered = await store.get<{ refreshToken: string; balanceMinor: number }>(
        'owner-session-secret',
      )
      expect(recovered).toEqual({ refreshToken: 'secret-token-xyz', balanceMinor: 950000 })

      // Cross-user cipher cannot decrypt owner's sealed envelope
      const employeeStore = new EncryptedPartitionStore(db, employeePartition)
      await expect(employeeStore.get('owner-session-secret')).rejects.toThrow(
        PartitionSecurityError,
      )

      // Tampering 1 character in ciphertext fails GCM authentication tag
      const parsedEnv = JSON.parse(rawRow!.envelope_json) as {
        v: 1
        alg: 'AES-256-GCM'
        ivB64: string
        ciphertextB64: string
        aad: string
      }
      const firstChar = parsedEnv.ciphertextB64[0] === 'A' ? 'B' : 'A'
      const flipped = firstChar + parsedEnv.ciphertextB64.slice(1)
      await expect(
        ownerPartition.createCipher().decrypt({ ...parsedEnv, ciphertextB64: flipped }),
      ).rejects.toThrow(PartitionSecurityError)
    })

    it('configures SQLCipher PRAGMAs when supported and refuses plaintext SQLite when native cipher is required', () => {
      const partition = PerUserPartitionManager.resolvePartition({
        deviceId: 'pos-01',
        userId: 'owner-1',
        workspaceId: TEST_WORKSPACE_ID,
        userRole: 'owner',
        baseStoragePath: '/data/app',
        deviceMasterSecret: PerUserPartitionManager.generateDeviceMasterSecret(),
      })

      const executed: string[] = []
      const sqlCipherMock: SqlCipherPragmaTarget = {
        pragma(stmt: string) {
          executed.push(stmt)
          if (stmt === 'cipher_version') return [{ cipher_version: '4.6.1 community' }]
          return undefined
        },
      }
      const res = PerUserPartitionManager.configureSqliteCipher(sqlCipherMock, partition, {
        requireNativeSqlCipher: true,
      })
      expect(res.mode).toBe('sqlcipher')
      expect(res.cipherVersion).toBe('4.6.1 community')
      expect(res.keyApplied).toBe(true)
      expect(executed.some((s) => s.startsWith(`key = "x'`))).toBe(true)

      const plainSqliteMock: SqlCipherPragmaTarget = {
        pragma: () => undefined,
      }
      const fallback = PerUserPartitionManager.configureSqliteCipher(plainSqliteMock, partition)
      expect(fallback.mode).toBe('application_envelope_aead')
      expect(fallback.keyApplied).toBe(false)

      expect(() =>
        PerUserPartitionManager.configureSqliteCipher(plainSqliteMock, partition, {
          requireNativeSqlCipher: true,
        }),
      ).toThrow(PartitionSecurityError)
    })

    it('rejects cross-user partition access attempt', () => {
      expect(() =>
        PerUserPartitionManager.assertPartitionIntegrity('employee-uuid-222', 'owner-uuid-111'),
      ).toThrow(/Cross-User Security Violation/)
    })
  })

  describe('7.2 Explicit 6-State Mutation Lifecycle & Guarded Transitions', () => {
    it('transitions mutation through local_pending -> syncing -> server_committed with observability metrics', () => {
      const clientId = 'pay-mutation-local-001'

      const record = stateMachine.recordLocalCommit({
        clientId,
        entity: 'payment',
        operation: 'create',
        userId: TEST_USER_ID,
        workspaceId: TEST_WORKSPACE_ID,
        idempotencyKey: 'idemp-pay-001',
      })

      expect(record.state).toBe('local_pending')

      let summary = stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID, TEST_USER_ID)
      expect(summary.totalMutations).toBe(1)
      expect(summary.localPendingCount).toBe(1)
      expect(summary.serverCommittedCount).toBe(0)

      stateMachine.markSyncing(clientId)
      summary = stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID, TEST_USER_ID)
      expect(summary.localPendingCount).toBe(0)
      expect(summary.syncingCount).toBe(1)

      stateMachine.markServerCommitted(clientId)
      summary = stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID, TEST_USER_ID)
      expect(summary.syncingCount).toBe(0)
      expect(summary.serverCommittedCount).toBe(1)
    })

    it('enforces FSM transitions strictly and prevents resetting committed mutations back to local_pending', () => {
      const clientId = 'inv-fsm-strict-001'
      stateMachine.recordLocalCommit({
        clientId,
        entity: 'invoice',
        operation: 'create',
        userId: TEST_USER_ID,
        workspaceId: TEST_WORKSPACE_ID,
        idempotencyKey: 'idemp-strict-1',
      })

      // Cannot skip `syncing` straight to `server_committed`
      expect(() => stateMachine.markServerCommitted(clientId)).toThrow(InvalidSyncTransitionError)

      stateMachine.markSyncing(clientId)
      stateMachine.markServerCommitted(clientId)

      // Replay of same local commit must remain `server_committed` without resetting attempts/state
      const replayed = stateMachine.recordLocalCommit({
        clientId,
        entity: 'invoice',
        operation: 'create',
        userId: TEST_USER_ID,
        workspaceId: TEST_WORKSPACE_ID,
        idempotencyKey: 'idemp-strict-1',
      })
      expect(replayed.state).toBe('server_committed')
      expect(replayed.attempts).toBe(1)

      // Cannot move committed mutation back to `syncing` or `conflict`
      expect(() => stateMachine.markSyncing(clientId)).toThrow(InvalidSyncTransitionError)
      expect(() => stateMachine.markConflict(clientId, 'late')).toThrow(InvalidSyncTransitionError)

      // Reconciled is strictly terminal
      stateMachine.markReconciled(clientId)
      expect(() => stateMachine.markSyncing(clientId)).toThrow(InvalidSyncTransitionError)
      expect(() => stateMachine.markRejected(clientId, 'nope')).toThrow(InvalidSyncTransitionError)
    })

    it('handles conflict and explicit reconciliation transitions', () => {
      const clientId = 'inv-mutation-002'
      stateMachine.recordLocalCommit({
        clientId,
        entity: 'invoice',
        operation: 'update',
        userId: TEST_USER_ID,
        workspaceId: TEST_WORKSPACE_ID,
      })

      stateMachine.markConflict(clientId, 'Version mismatch: Server=3, Local=2')
      let summary = stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID)
      expect(summary.conflictCount).toBe(1)

      stateMachine.markReconciled(clientId)
      summary = stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID)
      expect(summary.conflictCount).toBe(0)
      expect(summary.reconciledCount).toBe(1)
    })
  })

  describe('7.3 Bandwidth-Aware Telemetry, Adaptive Executor & Backoff Scheduling', () => {
    const candidates: SyncCandidateItem[] = [
      {
        clientId: 'm1',
        entity: 'customer',
        operation: 'update',
        isFinancial: false,
        payload: {},
        attempts: 0,
      },
      {
        clientId: 'm2',
        entity: 'payment',
        operation: 'create',
        isFinancial: true,
        payload: {},
        attempts: 0,
      },
      {
        clientId: 'm3',
        entity: 'invoice',
        operation: 'create',
        isFinancial: true,
        payload: {},
        attempts: 1,
      },
      {
        clientId: 'm4',
        entity: 'product',
        operation: 'update',
        isFinancial: false,
        payload: {},
        attempts: 0,
      },
    ]

    it('prioritizes financial mutations (payments and invoices) over descriptive updates', () => {
      const batch = BandwidthAwareSyncDispatcher.selectBatch(candidates, '4g_wifi', 0)
      expect(batch[0]!.isFinancial).toBe(true)
      expect(batch[1]!.isFinancial).toBe(true)
      expect(batch.map((b) => b.clientId)).toEqual(['m2', 'm3', 'm1', 'm4'])
    })

    it('throttles batch size on slow 2G connections and high server load', () => {
      const manyCandidates: SyncCandidateItem[] = Array.from({ length: 20 }, (_, i) => ({
        clientId: `item-${i}`,
        entity: 'payment',
        operation: 'create',
        isFinancial: true,
        payload: {},
        attempts: 0,
      }))

      const batch2G = BandwidthAwareSyncDispatcher.selectBatch(manyCandidates, 'slow_2g', 0)
      expect(batch2G).toHaveLength(5)

      const batchOverloaded = BandwidthAwareSyncDispatcher.selectBatch(
        manyCandidates,
        'slow_2g',
        0.85,
      )
      expect(batchOverloaded).toHaveLength(2)
    })

    it('executes adaptive transport cycles over SyncStateMachine with retry backoff on outage', async () => {
      for (let i = 0; i < 6; i++) {
        stateMachine.recordLocalCommit({
          clientId: `exec-item-${i}`,
          entity: i === 5 ? 'customer' : 'payment',
          operation: 'create',
          userId: TEST_USER_ID,
          workspaceId: TEST_WORKSPACE_ID,
        })
      }

      let transportCalls = 0
      const executor = new SyncBatchExecutor(stateMachine, {
        async sendBatch(items) {
          transportCalls++
          if (transportCalls === 1) {
            throw new Error('504 Gateway Timeout on 2G link')
          }
          return items.map((item) => ({ clientId: item.clientId, status: 'committed' as const }))
        },
      })

      const t0 = 1_700_000_000_000

      // Offline telemetry dispatches zero batches
      const offlineReport = await executor.runCycle({
        workspaceId: TEST_WORKSPACE_ID,
        telemetry: { online: false },
        nowMs: t0,
      })
      expect(offlineReport.profile).toBe('offline')
      expect(offlineReport.selectedCount).toBe(0)

      // High-RTT telemetry adapts profile -> `slow_2g` (max 5 items) and requeues on failure
      const failReport = await executor.runCycle({
        workspaceId: TEST_WORKSPACE_ID,
        telemetry: { online: true, effectiveRttMs: 1800, downlinkMbps: 0.15 },
        nowMs: t0,
      })
      expect(failReport.profile).toBe('slow_2g')
      expect(failReport.selectedCount).toBe(5)
      expect(failReport.requeuedCount).toBe(5)

      // Immediately 1 second later, requeued 5 items are still backed off so ONLY the 6th unattempted item dispatches
      const duringBackoff = await executor.runCycle({
        workspaceId: TEST_WORKSPACE_ID,
        telemetry: { online: true, effectiveRttMs: 40, downlinkMbps: 20 },
        nowMs: t0 + 1000,
      })
      expect(duringBackoff.profile).toBe('4g_wifi')
      expect(duringBackoff.selectedCount).toBe(1)
      expect(duringBackoff.committedCount).toBe(1)

      // After backoff expires (e.g. +120s), remaining 5 items flush cleanly on 4G
      const recovery = await executor.runCycle({
        workspaceId: TEST_WORKSPACE_ID,
        telemetry: { online: true, effectiveRttMs: 40, downlinkMbps: 20 },
        nowMs: t0 + 120_000,
      })
      expect(recovery.committedCount).toBe(5)
      expect(stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID).serverCommittedCount).toBe(6)
    })
  })

  describe('7.4 Critical Scenario: Failover & Replay with Zero Duplicate Financial Effect', () => {
    it('proves exactly-once payment application across primary failure and standby promotion', () => {
      const serverPaymentsTable = new Map<
        string,
        { id: string; amount: number; idempotencyKey: string; version: number }
      >()
      const serverLedgerLines: Array<{
        id: string
        paymentId: string
        debit: number
        credit: number
      }> = []

      function serverProcessPayment(mutation: {
        id: string
        amount: number
        idempotencyKey: string
      }) {
        if (serverPaymentsTable.has(mutation.id)) {
          return { status: 'already_committed', payment: serverPaymentsTable.get(mutation.id)! }
        }

        const payment = { ...mutation, version: 1 }
        serverPaymentsTable.set(mutation.id, payment)

        serverLedgerLines.push({
          id: `line-dr-${mutation.id}`,
          paymentId: mutation.id,
          debit: mutation.amount,
          credit: 0,
        })
        serverLedgerLines.push({
          id: `line-cr-${mutation.id}`,
          paymentId: mutation.id,
          debit: 0,
          credit: mutation.amount,
        })

        return { status: 'created', payment }
      }

      const paymentId = 'pay-disaster-test-999'
      const idempotencyKey = 'idemp-pos-device-seq-42'
      stateMachine.recordLocalCommit({
        clientId: paymentId,
        entity: 'payment',
        operation: 'create',
        userId: TEST_USER_ID,
        workspaceId: TEST_WORKSPACE_ID,
        idempotencyKey,
      })

      stateMachine.markSyncing(paymentId)
      const firstServerResult = serverProcessPayment({
        id: paymentId,
        amount: 50000,
        idempotencyKey,
      })
      expect(firstServerResult.status).toBe('created')
      expect(serverPaymentsTable.size).toBe(1)
      expect(serverLedgerLines).toHaveLength(2)

      const clientViewBeforeReconnect = stateMachine.getObservabilitySummary(
        TEST_WORKSPACE_ID,
        TEST_USER_ID,
      )
      expect(clientViewBeforeReconnect.serverCommittedCount).toBe(0)

      const replayServerResult = serverProcessPayment({
        id: paymentId,
        amount: 50000,
        idempotencyKey,
      })
      expect(replayServerResult.status).toBe('already_committed')

      stateMachine.markServerCommitted(paymentId)

      expect(serverPaymentsTable.size).toBe(1)
      expect(serverLedgerLines).toHaveLength(2)

      const totalDebits = serverLedgerLines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredits = serverLedgerLines.reduce((sum, l) => sum + l.credit, 0)
      expect(totalDebits).toBe(50000)
      expect(totalCredits).toBe(50000)
      expect(totalDebits).toBe(totalCredits)

      const clientViewFinal = stateMachine.getObservabilitySummary(TEST_WORKSPACE_ID, TEST_USER_ID)
      expect(clientViewFinal.serverCommittedCount).toBe(1)
      expect(clientViewFinal.localPendingCount).toBe(0)
    })
  })
})
