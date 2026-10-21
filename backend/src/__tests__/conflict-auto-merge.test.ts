// ============================================
// backend/src/__tests__/conflict-auto-merge.test.ts
//
// The two writes `ConflictService` makes that the forward-only trigger
// (docs/sync-conflicts-forward-01-migration.sql) must not break:
//
//   1. An AUTO-MERGE of a non-financial field: filed as resolved/'auto_merge'
//      with a moment and NO decider. The machine decided, not a person.
//   2. A REPLAY of a mutation whose conflict was already decided: the decision
//      stands. `record()` must not try to write 'open' over it, because the
//      trigger refuses and `fileConflict` swallows the refusal — the retry
//      would look successful and change nothing.
//
// And the write it must still make: an OPEN conflict is refreshed by a replay,
// so the guard is narrow rather than «never write».
//
// The store is the fake Postgres used by the HTTP suites; the real trigger is
// proven against real Postgres in sync-conflicts-forward.pg.test.ts.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const SHOP = fakeId('shop')
const USER = fakeId('user')
const CUSTOMER = fakeId('customer')
const INVOICE = fakeId('invoice')

vi.mock('../db', async () => (globalThis as any).__conflictFakeDb)

async function service() {
  ;(globalThis as any).__conflictFakeDb ??= createFakeDb(db, new Map())
  const { ConflictService } = await import('../services/conflict')
  return new ConflictService()
}

beforeEach(() => {
  db.tables.clear()
  db.queries.length = 0
  db.seed('customers', [
    {
      id: CUSTOMER,
      workspace_id: SHOP,
      full_name: 'Ali',
      note: 'old note',
      version: 3,
      deleted_at: null,
    },
  ])
  db.seed('sync_conflicts', [])
})

describe('what the sync path writes, and what it must not', () => {
  it('files an auto-merge as resolved, with a moment and no decider', async () => {
    const conflicts = await service()

    const result = await conflicts.record(
      { workspaceId: SHOP, userId: USER },
      {
        entityType: 'customer',
        entityId: CUSTOMER,
        mutationId: 'm-auto',
        operation: 'update',
        serverRow: { note: 'old note', version: 3 },
        clientPayload: { note: 'new note' },
        clientVersion: 2,
      },
    )

    expect(result.status).toBe('auto_merged')

    const row = db.rows('sync_conflicts')[0]!
    expect(row.status).toBe('resolved')
    expect(row.resolution).toBe('auto_merge')
    // A moment: the merge happened at a known time.
    expect(row.resolved_at).toBeTruthy()
    // No decider: no person decided, and none is invented (D5 / §12).
    expect(row.resolved_by ?? null).toBeNull()
    // The merge itself was applied to the record.
    expect(db.rows('customers')[0]!.note).toBe('new note')
  })

  it('does not reopen a decided conflict when the device resends the mutation', async () => {
    const decidedAt = '2026-10-01T09:00:00.000Z'
    db.seed('sync_conflicts', [
      {
        id: fakeId('conflict'),
        workspace_id: SHOP,
        entity_type: 'invoice',
        entity_id: INVOICE,
        mutation_id: 'm-decided',
        operation: 'update',
        server_version: 3,
        server_row: { total: 500 },
        client_version: 2,
        client_payload: { total: 700 },
        divergences: [{ field: 'total', serverValue: 500, clientValue: 700, financial: true }],
        has_financial_divergence: true,
        status: 'resolved',
        resolution: 'keep_server',
        resolution_reason: 'the server row already carries the sale',
        resolved_by: USER,
        resolved_at: decidedAt,
        created_at: '2026-09-30T09:00:00.000Z',
      },
    ])

    const conflicts = await service()
    const result = await conflicts.record(
      { workspaceId: SHOP, userId: USER },
      {
        entityType: 'invoice',
        entityId: INVOICE,
        mutationId: 'm-decided',
        operation: 'update',
        serverRow: { total: 500 },
        clientPayload: { total: 900 },
        clientVersion: 2,
      },
    )

    expect(result.status).toBe('recorded')
    expect(db.rows('sync_conflicts')).toHaveLength(1)

    const row = db.rows('sync_conflicts')[0]!
    expect(row.status).toBe('resolved')
    expect(row.resolution).toBe('keep_server')
    expect(row.resolved_by).toBe(USER)
    expect(row.resolved_at).toBe(decidedAt)
    // The replay's payload did not overwrite the record of the decision.
    expect(row.client_payload).toEqual({ total: 700 })
  })

  it('still refreshes an OPEN conflict when the same mutation is resent', async () => {
    db.seed('sync_conflicts', [
      {
        id: fakeId('conflict'),
        workspace_id: SHOP,
        entity_type: 'invoice',
        entity_id: INVOICE,
        mutation_id: 'm-open',
        operation: 'update',
        server_version: 3,
        server_row: { total: 500 },
        client_version: 2,
        client_payload: { total: 700 },
        divergences: [{ field: 'total', serverValue: 500, clientValue: 700, financial: true }],
        has_financial_divergence: true,
        status: 'open',
        resolution: null,
        resolution_reason: null,
        resolved_by: null,
        resolved_at: null,
        created_at: '2026-09-30T09:00:00.000Z',
      },
    ])

    const conflicts = await service()
    await conflicts.record(
      { workspaceId: SHOP, userId: USER },
      {
        entityType: 'invoice',
        entityId: INVOICE,
        mutationId: 'm-open',
        operation: 'update',
        serverRow: { total: 500 },
        clientPayload: { total: 900 },
        clientVersion: 2,
      },
    )

    expect(db.rows('sync_conflicts')).toHaveLength(1)
    const row = db.rows('sync_conflicts')[0]!
    // Still waiting for a person, and now carrying the newer payload: an open
    // conflict is a live question, not a frozen one.
    expect(row.status).toBe('open')
    expect(row.client_payload).toEqual({ total: 900 })
  })

  it('keeps a decided oversell decided when the sale is saved again', async () => {
    db.seed('sync_conflicts', [
      {
        id: fakeId('conflict'),
        workspace_id: SHOP,
        entity_type: 'product',
        entity_id: CUSTOMER,
        mutation_id: `${INVOICE}:negative-stock:${CUSTOMER}`,
        operation: 'negative_stock',
        server_row: { product_id: CUSTOMER, on_hand_after: -1, shortfall: 1 },
        client_payload: { quantity_sold: 3, device_believed_on_hand: 5 },
        divergences: [],
        has_financial_divergence: true,
        status: 'resolved',
        resolution: 'keep_client',
        resolution_reason: 'the second sale was real',
        resolved_by: USER,
        resolved_at: '2026-10-01T09:00:00.000Z',
        created_at: '2026-09-30T09:00:00.000Z',
      },
    ])

    const conflicts = await service()
    const result = await conflicts.recordStockBreach(
      { workspaceId: SHOP, userId: USER },
      {
        productId: CUSTOMER,
        mutationId: INVOICE,
        breach: {
          productId: CUSTOMER,
          onHandAfter: -1,
          quantitySold: 3,
          shortfall: 1,
          deviceBelievedOnHand: 5,
          soldBeyondOwnBelief: false,
        },
      },
    )

    expect(result.conflictId).toBe(db.rows('sync_conflicts')[0]!.id)
    const row = db.rows('sync_conflicts')[0]!
    expect(row.status).toBe('resolved')
    expect(row.resolution).toBe('keep_client')
    expect(row.resolved_at).toBe('2026-10-01T09:00:00.000Z')
  })
})
