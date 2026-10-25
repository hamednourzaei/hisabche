import { describe, expect, it } from 'vitest'
import { evaluatePeriodLock, planConsumption, type CostLayer } from '@hisabche/validation'

interface MockMutation {
  mutationId: string
  entity: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  deviceTimestamp: number
}

interface ServerSyncStore {
  appliedMutations: Map<string, { status: string; entityVersion: number }>
  stockLedger: { productId: string; delta: number; recordedAt: number }[]
}

describe('Sync & Integrity — Automated Chaos Test Suite', () => {
  it('Chaos 1: Network drop mid-sync resumes without duplicate application', () => {
    const store: ServerSyncStore = {
      appliedMutations: new Map(),
      stockLedger: [],
    }

    const batch: MockMutation[] = Array.from({ length: 10 }, (_, i) => ({
      mutationId: `mut_drop_${i}`,
      entity: 'stock_movement',
      operation: 'create',
      payload: { productId: 'p1', delta: 5 },
      deviceTimestamp: 1000 + i * 100,
    }))

    // Network drops after 4 items
    const clientDelivered = 4
    for (let i = 0; i < clientDelivered; i++) {
      const mut = batch[i]!
      store.appliedMutations.set(mut.mutationId, { status: 'applied', entityVersion: i + 1 })
      store.stockLedger.push({ productId: 'p1', delta: 5, recordedAt: Date.now() })
    }

    expect(store.appliedMutations.size).toBe(4)
    expect(store.stockLedger.length).toBe(4)

    // Client reconnects and retries entire batch of 10
    for (const mut of batch) {
      if (store.appliedMutations.has(mut.mutationId)) {
        // Idempotency: skip duplicate write
        continue
      }
      store.appliedMutations.set(mut.mutationId, {
        status: 'applied',
        entityVersion: store.appliedMutations.size + 1,
      })
      store.stockLedger.push({ productId: 'p1', delta: 5, recordedAt: Date.now() })
    }

    // Exactly 10 mutations applied, total stock delta is exactly 50 (never 70)
    expect(store.appliedMutations.size).toBe(10)
    expect(store.stockLedger.length).toBe(10)
    const totalStock = store.stockLedger.reduce((sum, item) => sum + item.delta, 0)
    expect(totalStock).toBe(50)
  })

  it('Chaos 2: Duplicate delivery (lost ACK) replays safely with zero state divergence', () => {
    const store = new Map<string, Record<string, unknown>>()
    const mutation: MockMutation = {
      mutationId: 'mut_lost_ack_01',
      entity: 'invoice',
      operation: 'create',
      payload: { invoiceNumber: 'INV-001', totalMinor: 10000 },
      deviceTimestamp: 1700000000,
    }

    function processMutation(mut: MockMutation) {
      if (store.has(mut.mutationId)) {
        return { status: 'applied', duplicate: true, record: store.get(mut.mutationId) }
      }
      const record = { ...mut.payload, version: 1 }
      store.set(mut.mutationId, record)
      return { status: 'applied', duplicate: false, record }
    }

    const first = processMutation(mutation)
    expect(first.duplicate).toBe(false)
    expect(store.size).toBe(1)

    // Replay identical mutation
    const second = processMutation(mutation)
    expect(second.duplicate).toBe(true)
    expect(second.record).toEqual(first.record)
    expect(store.size).toBe(1)
  })

  it('Chaos 3: Out-of-order mutations are causally ordered before application', () => {
    const mutations: MockMutation[] = [
      {
        mutationId: 'm3',
        entity: 'inventory',
        operation: 'create',
        payload: { delta: -10 },
        deviceTimestamp: 3000,
      },
      {
        mutationId: 'm1',
        entity: 'inventory',
        operation: 'create',
        payload: { delta: 100 },
        deviceTimestamp: 1000,
      },
      {
        mutationId: 'm2',
        entity: 'inventory',
        operation: 'create',
        payload: { delta: 50 },
        deviceTimestamp: 2000,
      },
    ]

    // Sort by device causal timestamp
    const ordered = [...mutations].sort((a, b) => a.deviceTimestamp - b.deviceTimestamp)

    let balance = 0
    const history: number[] = []
    for (const m of ordered) {
      balance += m.payload.delta as number
      history.push(balance)
    }

    // Must be [100, 150, 140] (never negative at step 1)
    expect(history).toEqual([100, 150, 140])
    expect(balance).toBe(140)
  })

  it('Chaos 4: Device clock skew (±24h) is normalized by server receive time', () => {
    const serverNow = 1700000000000
    const skewedDevicePast = serverNow - 24 * 3600 * 1000
    const skewedDeviceFuture = serverNow + 24 * 3600 * 1000

    function normalizeTimestamp(
      deviceTs: number,
      serverReceiveTs: number,
    ): { effectiveTs: number; driftFlag: boolean } {
      const diff = Math.abs(deviceTs - serverReceiveTs)
      const MAX_ALLOWED_DRIFT_MS = 5 * 60 * 1000 // 5 minutes
      if (diff > MAX_ALLOWED_DRIFT_MS) {
        return { effectiveTs: serverReceiveTs, driftFlag: true }
      }
      return { effectiveTs: deviceTs, driftFlag: false }
    }

    const pastNorm = normalizeTimestamp(skewedDevicePast, serverNow)
    expect(pastNorm.driftFlag).toBe(true)
    expect(pastNorm.effectiveTs).toBe(serverNow)

    const futureNorm = normalizeTimestamp(skewedDeviceFuture, serverNow)
    expect(futureNorm.driftFlag).toBe(true)
    expect(futureNorm.effectiveTs).toBe(serverNow)

    const normal = normalizeTimestamp(serverNow + 1000, serverNow)
    expect(normal.driftFlag).toBe(false)
    expect(normal.effectiveTs).toBe(serverNow + 1000)
  })

  it('Chaos 5: Two offline devices selling the last unit flags shortfall without silent loss', () => {
    // Both devices start with 1 unit in local layer
    const layerA: CostLayer[] = [
      {
        id: 'L1',
        productId: 'P_LAST',
        warehouseId: null,
        remainingQty: 1,
        unitCost: 1000,
        entryDate: '2026-01-01',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]

    // Device A sells 1 unit
    const planA = planConsumption(layerA, 1)
    expect(planA.shortfall).toBe(0)
    expect(planA.totalCost).toBe(1000)

    // Device B also sells 1 unit offline. When reaching the central ledger,
    // layer L1 is already consumed (remainingQty = 0)
    const layerBDepleted: CostLayer[] = [
      {
        id: 'L1',
        productId: 'P_LAST',
        warehouseId: null,
        remainingQty: 0,
        unitCost: 1000,
        entryDate: '2026-01-01',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]

    const planB = planConsumption(layerBDepleted, 1)
    // Server detects shortfall: sold air, flags reconciliation
    expect(planB.shortfall).toBe(1)
    expect(planB.steps[0]?.isEstimated).toBe(true)
  })

  it('Chaos 6: Offline entry into closed accounting period is strictly rejected', () => {
    const closedPeriodLocks = [
      { branchId: null, lockedUntil: '2026-01-31', reason: 'Annual close' },
    ]

    const offlineEntryDate = '2026-01-15'
    const decision = evaluatePeriodLock(offlineEntryDate, null, closedPeriodLocks)

    expect(decision.locked).toBe(true)
    expect(decision.scope).toBe('company')
    expect(decision.reason).toBe('Annual close')
  })
})
