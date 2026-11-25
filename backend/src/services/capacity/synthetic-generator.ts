// ============================================
// backend/src/services/capacity/synthetic-generator.ts
//
// V76 Phase 5 — Reproducible, deterministic synthetic multi-tenant generator.
// Never reads or copies production customer data.
// ============================================

export interface SyntheticTenantProfile {
  readonly tenantId: string
  readonly label: string
  readonly currency: 'AFN' | 'USD'
  readonly invoiceCount: number
}

export interface SyntheticInvoiceFixture {
  readonly id: string
  readonly workspaceId: string
  readonly invoiceNumber: string
  readonly totalMinor: number
  readonly currency: 'AFN' | 'USD'
}

/** Simple deterministic Mulberry32 PRNG for reproducible benchmark datasets. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function syntheticTenantId(index: number): string {
  const hex = index.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

export function buildMultiTenantProfiles(seed: number, scaleFactor = 1): SyntheticTenantProfile[] {
  const rng = createSeededRng(seed)
  const jitter = () => Math.floor(rng() * 10)
  return [
    {
      tenantId: syntheticTenantId(1),
      label: 'Large-Noisy-Tenant-A',
      currency: 'AFN',
      invoiceCount: Math.max(100, Math.floor(100_000 * scaleFactor) + jitter()),
    },
    {
      tenantId: syntheticTenantId(2),
      label: 'Medium-Tenant-B',
      currency: 'AFN',
      invoiceCount: Math.max(25, Math.floor(10_000 * scaleFactor) + jitter()),
    },
    {
      tenantId: syntheticTenantId(3),
      label: 'Small-Tenant-C',
      currency: 'AFN',
      invoiceCount: Math.max(10, Math.floor(1_000 * scaleFactor) + jitter()),
    },
    {
      tenantId: syntheticTenantId(4),
      label: 'Regular-POS-Tenant-D',
      currency: 'USD',
      invoiceCount: Math.max(5, Math.floor(250 * scaleFactor) + jitter()),
    },
  ]
}

export function generateSyntheticInvoices(
  tenantId: string,
  count: number,
  seed: number,
  currency: 'AFN' | 'USD' = 'AFN',
): SyntheticInvoiceFixture[] {
  const rng = createSeededRng(seed)
  const out: SyntheticInvoiceFixture[] = []
  for (let i = 0; i < count; i++) {
    const base =
      currency === 'AFN' ? 500 + Math.floor(rng() * 50_000) : 1000 + Math.floor(rng() * 50_000)
    out.push({
      id: `syn-inv-${seed}-${i}`,
      workspaceId: tenantId,
      invoiceNumber: `SYN-${seed}-${String(i + 1).padStart(6, '0')}`,
      totalMinor: base,
      currency,
    })
  }
  return out
}
