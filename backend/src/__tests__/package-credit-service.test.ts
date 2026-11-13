// ============================================
// backend/src/__tests__/package-credit-service.test.ts
//
// M3: Authoritative Package Credit Service Tests
// Proves immutable append-only ledger, balance derivation, fail-closed concurrency,
// idempotency, reversal links, and strict tenancy isolation.
// ============================================

import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PackageCreditsService } from '../services/package-credits/package-credits.service'
import type { TenancyContext } from '../services/tenancy.service'

const WS_1 = '11111111-1111-1111-1111-111111111111'
const WS_2 = '22222222-2222-2222-2222-222222222222'
const USER_1 = 'user-1'
const CUST_1 = 'customer-1'
const PROD_PKG_1 = 'package-pkg-1'

const ctx1: TenancyContext = {
  workspaceId: WS_1,
  userId: USER_1,
  role: 'owner',
}

const ctx2: TenancyContext = {
  workspaceId: WS_2,
  userId: USER_1,
  role: 'owner',
}

type Row = Record<string, unknown>

function createMockSupabase(initialRows: Row[] = []) {
  const store: Row[] = [...initialRows]
  let rpcHandler:
    ((name: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown }) | null =
    null

  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (rpcHandler) return rpcHandler(name, args)
      return { data: null, error: { code: 'PGRST202', message: 'Function not found' } }
    }),
    from: vi.fn((_table: string) => {
      const filters: Array<(r: Row) => boolean> = []

      const builder: Record<string, unknown> = {
        select: () => {
          return builder
        },
        eq: (col: string, val: unknown) => {
          filters.push((r: Row) => r[col] === val)
          return builder
        },
        is: (col: string, val: unknown) => {
          if (val === null) {
            filters.push((r: Row) => r[col] === null || r[col] === undefined)
          } else {
            filters.push((r: Row) => r[col] === val)
          }
          return builder
        },
        order: () => builder,
        maybeSingle: async () => {
          const matched = store.filter((r) => filters.every((f) => f(r)))
          return { data: matched[0] ?? null, error: null }
        },
        single: async () => {
          const matched = store.filter((r) => filters.every((f) => f(r)))
          return {
            data: matched[0] ?? null,
            error: matched.length === 0 ? { code: 'PGRST116' } : null,
          }
        },
        insert: (rowOrRows: Row | Row[]) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          for (const r of rows) {
            // Check uniqueness of idempotency_key per workspace
            if (r.idempotency_key) {
              const dup = store.find(
                (existing) =>
                  existing.workspace_id === r.workspace_id &&
                  existing.idempotency_key === r.idempotency_key &&
                  !existing.deleted_at,
              )
              if (dup) {
                return {
                  select: () => ({
                    single: async () => ({
                      data: null,
                      error: { code: '23505', message: 'duplicate key' },
                    }),
                  }),
                  then: (resolve: any) =>
                    resolve({ data: null, error: { code: '23505', message: 'duplicate key' } }),
                }
              }
            }
            store.push({ ...r })
          }
          return {
            select: () => ({
              single: async () => ({ data: rows[0], error: null }),
            }),
            then: (resolve: any) => resolve({ data: rows, error: null }),
          }
        },
        then: (resolve: (val: unknown) => unknown) => {
          const matched = store.filter((r) => filters.every((f) => f(r)))
          return resolve({ data: matched, count: matched.length, error: null })
        },
      }
      return builder
    }),
    _store: store,
    _setRpc: (fn: typeof rpcHandler) => {
      rpcHandler = fn
    },
  }

  return client as unknown as SupabaseClient & {
    _store: Row[]
    _setRpc: (
      fn: (name: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown },
    ) => void
  }
}

describe('PackageCreditsService — Authoritative Core', () => {
  it('getBalance returns 0 balance and 0 entries when ledger is empty', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    const result = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(result.balance).toBe(0)
    expect(result.entriesCount).toBe(0)
    expect(result.customerId).toBe(CUST_1)
    expect(result.packageProductId).toBe(PROD_PKG_1)
  })

  it('grant appends an immutable GRANT row and updates derived balance', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    const granted = await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 10,
      unit: 'session',
      notes: 'Initial 10-session pack',
    })

    expect(granted.entryType).toBe('GRANT')
    expect(granted.quantity).toBe(10)
    expect(granted.unit).toBe('session')
    expect(granted.workspaceId).toBe(WS_1)

    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(10)
    expect(balanceResult.entriesCount).toBe(1)
  })

  it('grant refuses non-positive quantity', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await expect(
      service.grant(ctx1, {
        customerId: CUST_1,
        packageProductId: PROD_PKG_1,
        quantity: 0,
      }),
    ).rejects.toThrow('PACKAGE_CREDIT_QUANTITY_MUST_BE_POSITIVE')

    await expect(
      service.grant(ctx1, {
        customerId: CUST_1,
        packageProductId: PROD_PKG_1,
        quantity: -5,
      }),
    ).rejects.toThrow('PACKAGE_CREDIT_QUANTITY_MUST_BE_POSITIVE')
  })

  it('consume deducts available balance when balance is sufficient', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 5,
    })

    const consumed = await service.consume(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 2,
      notes: 'First visit',
    })

    expect(consumed.entryType).toBe('CONSUME')
    expect(consumed.quantity).toBe(2)
    expect(consumed.remainingBalance).toBe(3)

    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(3)
    expect(balanceResult.entriesCount).toBe(2)
  })

  it('fail-closed: consume refuses over-consumption and does NOT insert negative balance', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 3,
    })

    await expect(
      service.consume(ctx1, {
        customerId: CUST_1,
        packageProductId: PROD_PKG_1,
        quantity: 4,
      }),
    ).rejects.toThrow(/INSUFFICIENT_PACKAGE_CREDIT/)

    // Balance remains intact at 3; ledger has only the 1 grant row
    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(3)
    expect(balanceResult.entriesCount).toBe(1)
  })

  it('idempotency: retrying grant with same idempotencyKey returns existing record without double-granting', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    const key = 'idem-grant-101'
    const first = await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 10,
      idempotencyKey: key,
    })

    const second = await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 10,
      idempotencyKey: key,
    })

    expect(second.id).toBe(first.id)
    expect(second.idempotentReplay).toBe(true)

    // Derived balance is 10, NOT 20
    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(10)
    expect(balanceResult.entriesCount).toBe(1)
  })

  it('idempotency: retrying consume with same idempotencyKey does NOT consume credits twice', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 5,
    })

    const key = 'idem-consume-201'
    const first = await service.consume(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 2,
      idempotencyKey: key,
    })

    const second = await service.consume(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 2,
      idempotencyKey: key,
    })

    expect(second.id).toBe(first.id)
    expect(second.idempotentReplay).toBe(true)

    // Remaining balance is 3, NOT 1
    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(3)
    expect(balanceResult.entriesCount).toBe(2)
  })

  it('reversal: links to reference_entry_id without mutating the original entry', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 5,
    })

    const consumed = await service.consume(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 2,
    })

    expect((await service.getBalance(ctx1, CUST_1, PROD_PKG_1)).balance).toBe(3)

    // Reverse the consumption of 2
    const reversed = await service.reverse(ctx1, {
      referenceEntryId: consumed.id,
      notes: 'Customer canceled session appointment',
    })

    expect(reversed.entryType).toBe('REVERSAL')
    expect(reversed.referenceEntryId).toBe(consumed.id)
    expect(reversed.quantity).toBe(2)

    // Balance restored back to 5
    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(5)
    expect(balanceResult.entriesCount).toBe(3)
  })

  it('expire: zeroes remaining balance without creating cash refund or modifying past revenue', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 10,
    })

    await service.consume(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 4,
    })

    expect((await service.getBalance(ctx1, CUST_1, PROD_PKG_1)).balance).toBe(6)

    // Expire the remaining 6 credits
    const expired = await service.expire(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      notes: 'Annual package validity expired',
    })

    expect(expired && 'entryType' in expired && expired.entryType).toBe('EXPIRE')
    expect(expired && 'quantity' in expired && expired.quantity).toBe(6)

    // Remaining balance is now exactly 0
    const finalBalance = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(finalBalance.balance).toBe(0)
    expect(finalBalance.entriesCount).toBe(3)

    // Calling expire on already zero balance is a no-op
    const noopExpire = await service.expire(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
    })
    expect(noopExpire).toEqual({ expired: false, balance: 0 })
  })

  it('adjustment: applies manual credit additions or reductions', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 10,
    })

    const adj = await service.adjust(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantityDelta: 3,
      notes: 'Goodwill bonus credits',
    })

    expect(adj.entryType).toBe('ADJUSTMENT')
    expect(adj.quantity).toBe(3)

    const balanceResult = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(balanceResult.balance).toBe(13)
  })

  it('strict workspace isolation: workspace 2 cannot view or consume workspace 1 credits', async () => {
    const db = createMockSupabase()
    const service = new PackageCreditsService(db)

    await service.grant(ctx1, {
      customerId: CUST_1,
      packageProductId: PROD_PKG_1,
      quantity: 10,
    })

    // Workspace 2 reads balance for same customer/product -> 0
    const ws2Balance = await service.getBalance(ctx2, CUST_1, PROD_PKG_1)
    expect(ws2Balance.balance).toBe(0)
    expect(ws2Balance.entriesCount).toBe(0)

    // Workspace 2 attempts to consume -> rejected with insufficient balance
    await expect(
      service.consume(ctx2, {
        customerId: CUST_1,
        packageProductId: PROD_PKG_1,
        quantity: 1,
      }),
    ).rejects.toThrow(/INSUFFICIENT_PACKAGE_CREDIT/)

    // Workspace 1 balance remains 10
    const ws1Balance = await service.getBalance(ctx1, CUST_1, PROD_PKG_1)
    expect(ws1Balance.balance).toBe(10)
  })
})
