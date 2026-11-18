// ============================================
// backend/src/__tests__/warranty-claim-idempotency.test.ts
//
// WP-02 — a warranty claim submitted twice is ONE claim.
//
// The claim travels from a device that may lose the response
// (`useIntentKey('warranty-claim')` → `Idempotency-Key`). Three paths matter:
//
//   1. the key was already used   → the stored claim is returned, nothing inserted
//   2. two requests race          → the unique index refuses the second insert
//                                    (23505) and the winner's row is returned
//   3. no key at all              → the claim is recorded (the key is optional)
// ============================================

import { beforeAll, describe, expect, it, vi } from 'vitest'

interface ClaimRow extends Record<string, unknown> {
  id: string
  workspace_id: string
  client_request_id: string | null
}

const state = {
  claims: [] as ClaimRow[],
  inserts: 0,
  /** The next insert loses the race to a concurrent twin (the 23505 case). */
  nextInsertConflicts: false,
  warranty: {
    id: 'w1111111-1111-4111-8111-111111111111',
    invoice_id: 'i1111111-1111-4111-8111-111111111111',
    product_id: 'p1111111-1111-4111-8111-111111111111',
    serial_number: 'SN-001',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    warranty_months: 12,
    customer_id: 'c1111111-1111-4111-8111-111111111111',
  },
}

vi.mock('../services/warehouse.service', () => ({
  WarehouseService: class MockWarehouseService {
    transferStock = vi.fn()
  },
}))

vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(undefined),
}))

/** A read that remembers the equality filters it was given. */
function selectChain(table: string) {
  const filters: Record<string, unknown> = {}
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value
      return builder
    },
    maybeSingle: async () => {
      if (table === 'warranties') return { data: state.warranty, error: null }
      if (table === 'warranty_claims') {
        const hit = state.claims.find(
          (claim) =>
            claim.workspace_id === filters.workspace_id &&
            claim.client_request_id === filters.client_request_id,
        )
        return { data: hit ?? null, error: null }
      }
      return { data: null, error: null }
    },
  }
  return builder
}

function insertChain(table: string, row: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    single: async () => {
      if (table !== 'warranty_claims') return { data: { id: 'other-id', ...row }, error: null }
      state.inserts += 1
      if (state.nextInsertConflicts) {
        // The twin stored the row a microsecond earlier; the unique index
        // (workspace_id, client_request_id) is what the database answered.
        state.nextInsertConflicts = false
        const twin: ClaimRow = {
          id: 'twin-claim',
          ...row,
          workspace_id: String(row.workspace_id),
          client_request_id: (row.client_request_id as string | null) ?? null,
        }
        state.claims.push(twin)
        return { data: null, error: { code: '23505', message: 'duplicate key value' } }
      }
      const inserted: ClaimRow = {
        id: `claim-${state.inserts}`,
        ...row,
        workspace_id: String(row.workspace_id),
        client_request_id: (row.client_request_id as string | null) ?? null,
      }
      state.claims.push(inserted)
      return { data: inserted, error: null }
    },
  }
  return builder
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => selectChain(table),
      insert: (row: Record<string, unknown>) => insertChain(table, row),
    }),
  },
}))

const ctx = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner' as const,
}

const claimInput = {
  warrantyId: '77777777-7777-4777-8777-777777777777',
  claimDate: '2026-03-15',
  issueDescription: 'Switch loose within warranty period',
  disposition: 'repair' as const,
}

describe('WP-02 — a warranty claim key is the claim', () => {
  let QualityService: typeof import('../services/quality/quality.service').QualityService

  beforeAll(async () => {
    ;({ QualityService } = await import('../services/quality/quality.service'))
  })

  it('records a claim once and stores the key beside it', async () => {
    state.claims = []
    state.inserts = 0
    const svc = new QualityService()

    const claim = await svc.submitWarrantyClaim(ctx, claimInput, 'key-1')

    expect(state.inserts).toBe(1)
    expect((claim as ClaimRow).client_request_id).toBe('key-1')
    expect(state.claims).toHaveLength(1)
  })

  it('answers a replay with the SAME claim and inserts nothing', async () => {
    state.claims = []
    state.inserts = 0
    const svc = new QualityService()

    const first = await svc.submitWarrantyClaim(ctx, claimInput, 'key-1')
    const second = await svc.submitWarrantyClaim(ctx, claimInput, 'key-1')

    expect(state.inserts).toBe(1)
    expect(state.claims).toHaveLength(1)
    expect((second as ClaimRow).id).toBe((first as ClaimRow).id)
  })

  it('returns the winner when two requests with one key race', async () => {
    state.claims = []
    state.inserts = 0
    state.nextInsertConflicts = true
    const svc = new QualityService()

    const claim = await svc.submitWarrantyClaim(ctx, claimInput, 'key-race')

    // The read found nothing, the insert was refused by the index, and the row
    // the other request wrote is the answer.
    expect((claim as ClaimRow).id).toBe('twin-claim')
    expect(state.claims).toHaveLength(1)
  })

  it('keeps one key per workspace — a different workspace may reuse it', async () => {
    state.claims = []
    state.inserts = 0
    const svc = new QualityService()

    await svc.submitWarrantyClaim(ctx, claimInput, 'shared-key')
    await svc.submitWarrantyClaim(
      { ...ctx, workspaceId: '99999999-9999-4999-8999-999999999999' },
      claimInput,
      'shared-key',
    )

    expect(state.inserts).toBe(2)
  })

  it('still records a claim sent without a key (the key is optional)', async () => {
    state.claims = []
    state.inserts = 0
    const svc = new QualityService()

    await svc.submitWarrantyClaim(ctx, claimInput)

    expect(state.inserts).toBe(1)
    expect(state.claims[0]?.client_request_id).toBeNull()
  })
})
