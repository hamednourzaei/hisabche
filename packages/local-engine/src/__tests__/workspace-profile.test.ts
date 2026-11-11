import { describe, expect, it } from 'vitest'
import { ARCHETYPE_PRESETS } from '@hisabche/validation'
import { createTestDb, createTestEngine } from './test-db'

describe('Offline Workspace Operational Profile & Onboarding Sync Persistence (W2/W6)', () => {
  it('saves versioned Operational DNA offline and enforces expectedVersion conflict protection', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)

    // 1. Fresh workspace starts at version 0 with null DNA
    const initial = await engine.request<{
      configurable: boolean
      dna: unknown
      version: number
    }>({ method: 'GET', path: '/workspace/operational-profile' })
    expect(initial.status).toBe(200)
    expect(initial.data.configurable).toBe(true)
    expect(initial.data.version).toBe(0)
    expect(initial.data.dna).toBeNull()

    // 2. First save with expectedVersion 0 advances to version 1
    const first = await engine.request<{ version: number; replayed: boolean }>({
      method: 'PUT',
      path: '/workspace/operational-profile',
      body: { dna: ARCHETYPE_PRESETS.SALON_MULTI_STAFF, expectedVersion: 0 },
    })
    expect(first.status).toBe(200)
    expect(first.data).toEqual({ version: 1, replayed: false })

    // 3. Idempotent replay of the exact same DNA does not bump version
    const replay = await engine.request<{ version: number; replayed: boolean }>({
      method: 'PUT',
      path: '/workspace/operational-profile',
      body: { dna: ARCHETYPE_PRESETS.SALON_MULTI_STAFF, expectedVersion: 1 },
    })
    expect(replay.status).toBe(200)
    expect(replay.data).toEqual({ version: 1, replayed: true })

    // 4. Stale version with a different DNA is refused with 409 conflict
    const conflict = await engine.request<{ code: string }>({
      method: 'PUT',
      path: '/workspace/operational-profile',
      body: { dna: ARCHETYPE_PRESETS.RETAIL_STORE, expectedVersion: 0 },
    })
    expect(conflict.status).toBe(409)
    expect(conflict.data.code).toContain('OPERATIONAL_PROFILE_CHANGED')
  })

  it('persists onboarding progress and enforces workspace.manage capability', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)

    const progress = {
      state: 'IN_PROGRESS',
      step: 2,
      answers: {
        businessType: 'beautySalon',
        storeSize: 'medium',
        defaultCurrency: 'USD',
        operating: { hasStaff: 'yes', staffArrangement: 'commission' },
      },
    }

    const saved = await engine.request({
      method: 'PUT',
      path: '/workspace/onboarding-progress',
      body: progress,
    })
    expect(saved.status).toBe(200)

    const fetched = await engine.request<{ onboarding: typeof progress | null }>({
      method: 'GET',
      path: '/workspace/operational-profile',
    })
    expect(fetched.data.onboarding).toEqual(progress)

    // Seller role cannot mutate operational profile offline (header can only lower privilege)
    const forbidden = await engine.request({
      method: 'PUT',
      path: '/workspace/operational-profile',
      headers: { 'x-user-role': 'seller' },
      body: { dna: ARCHETYPE_PRESETS.RETAIL_STORE, expectedVersion: 0 },
    })
    expect(forbidden.status).toBe(403)
  })

  it('accepts and round-trips V60 15-axis DNA extensions and extended operating answers', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)

    const extendedDna = {
      ...ARCHETYPE_PRESETS.SERVICE_REPAIR,
      pricingBasis: ['TIME', 'UNIT'] as const,
      assetCustody: 'CUSTOMER_ASSET_IN_CUSTODY' as const,
      executionSite: 'CUSTOMER_SITE' as const,
      recurrence: 'RECURRING_SERVICE' as const,
      approvalDepth: 'SINGLE' as const,
      regulatedDomain: 'NONE' as const,
    }

    const saved = await engine.request<{ version: number; replayed: boolean }>({
      method: 'PUT',
      path: '/workspace/operational-profile',
      body: { dna: extendedDna, expectedVersion: 0 },
    })
    expect(saved.status).toBe(200)
    expect(saved.data.version).toBe(1)

    const progress = {
      state: 'IN_PROGRESS',
      step: 3,
      answers: {
        businessType: 'repairs',
        storeSize: 'small',
        defaultCurrency: 'USD',
        operating: {
          takesJobTicketsOrRepairs: 'yes',
          holdsCustomerAssets: 'yes',
          worksAtCustomerSite: 'yes',
          billsRecurring: 'yes',
          needsApprovals: 'yes',
          rentsOutAssets: 'no',
        },
      },
    }
    const savedProgress = await engine.request({
      method: 'PUT',
      path: '/workspace/onboarding-progress',
      body: progress,
    })
    expect(savedProgress.status).toBe(200)

    const fetched = await engine.request<{
      dna: typeof extendedDna | null
      version: number
      onboarding: typeof progress | null
    }>({ method: 'GET', path: '/workspace/operational-profile' })

    expect(fetched.status).toBe(200)
    expect(fetched.data.version).toBe(1)
    expect(fetched.data.dna?.pricingBasis).toEqual(['TIME', 'UNIT'])
    expect(fetched.data.dna?.assetCustody).toBe('CUSTOMER_ASSET_IN_CUSTODY')
    expect(fetched.data.dna?.executionSite).toBe('CUSTOMER_SITE')
    expect(fetched.data.dna?.recurrence).toBe('RECURRING_SERVICE')
    expect(fetched.data.dna?.approvalDepth).toBe('SINGLE')
    expect(fetched.data.dna?.regulatedDomain).toBe('NONE')
    expect(fetched.data.onboarding).toEqual(progress)
  })
})
