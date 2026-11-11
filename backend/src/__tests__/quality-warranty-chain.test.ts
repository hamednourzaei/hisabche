import { describe, it, expect, vi, beforeAll } from 'vitest'

const transferStockSpy = vi.fn().mockResolvedValue({ moved: true })

const state = {
  qualityEventsInserted: [] as Array<Record<string, unknown>>,
  claimsInserted: [] as Array<Record<string, unknown>>,
  warrantyRow: {
    id: 'w1111111-1111-4111-8111-111111111111',
    invoice_id: 'i1111111-1111-4111-8111-111111111111',
    product_id: 'p1111111-1111-4111-8111-111111111111',
    serial_number: 'SN-001',
    start_date: '2026-01-01',
    end_date: '2026-06-30',
    warranty_months: 6,
    customer_id: 'c1111111-1111-4111-8111-111111111111',
  },
}

vi.mock('../services/warehouse.service', () => ({
  WarehouseService: class MockWarehouseService {
    transferStock = transferStockSpy
  },
}))

vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (table === 'quality_events') state.qualityEventsInserted.push(row)
            if (table === 'warranty_claims') state.claimsInserted.push(row)
            return { data: { id: 'generated-id', ...row }, error: null }
          },
        }),
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === 'warranties' ? state.warrantyRow : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}))

describe('V60 Slice 11 — Quality events quarantine & warranty claim expiration guard', () => {
  let QualityService: typeof import('../services/quality/quality.service').QualityService
  const ctx = {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'owner' as const,
  }

  beforeAll(async () => {
    ;({ QualityService } = await import('../services/quality/quality.service'))
  })

  it('moves failed receipt stock to quarantine via WarehouseService.transferStock', async () => {
    const svc = new QualityService()
    const res = await svc.recordQualityEvent(ctx, {
      sourceType: 'receipt',
      sourceId: '33333333-3333-4333-8333-333333333333',
      eventKind: 'fail',
      productId: '44444444-4444-4444-8444-444444444444',
      fromWarehouseId: '55555555-5555-4555-8555-555555555555',
      quarantineWarehouseId: '66666666-6666-4666-8666-666666666666',
      quantity: 4,
      notes: 'Cracked seal',
    })

    expect(state.qualityEventsInserted).toHaveLength(1)
    expect(transferStockSpy).toHaveBeenCalledTimes(1)
    expect(res.quarantineTransfer).toEqual({ moved: true })
  })

  it('refuses an expired warranty claim with WARRANTY_EXPIRED', async () => {
    const svc = new QualityService()
    await expect(
      svc.submitWarrantyClaim(ctx, {
        warrantyId: '77777777-7777-4777-8777-777777777777',
        claimDate: '2026-08-01',
        issueDescription: 'Motor dead after expiry',
        disposition: 'repair',
      }),
    ).rejects.toThrow(/WARRANTY_EXPIRED/)
  })

  it('accepts an active warranty claim and writes the workspace-scoped record', async () => {
    const svc = new QualityService()
    const claim = await svc.submitWarrantyClaim(ctx, {
      warrantyId: '77777777-7777-4777-8777-777777777777',
      claimDate: '2026-03-15',
      issueDescription: 'Switch loose within warranty period',
      disposition: 'replace',
    })

    expect(claim.disposition).toBe('replace')
    expect(state.claimsInserted).toHaveLength(1)
    expect(state.claimsInserted[0]?.workspace_id).toBe(ctx.workspaceId)
  })
})
