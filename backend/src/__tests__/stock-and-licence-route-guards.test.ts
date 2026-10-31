// ============================================
// BUG-NEW-015: ordering, receiving and counting stock, and the licence seats,
// need a capability — not just membership.
//
// `POST /api/purchase-orders/:id/receive` moves stock and writes its cost layer;
// completing a cycle count writes the ADJUSTMENT movements; activating a seat
// spends the licence. All of them answered any member. The default is now the
// owner and the admin (`manager`), and the owner moves any of them in the
// permissions matrix (governance?tab=permissions) because each is a cell of a
// module there.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CAPABILITIES,
  customRoleAccess,
  effectiveCapabilities,
  holds,
  PERMISSION_MODULES,
  can,
} from '../services/authorization/authorization.domain'

const NEW_CAPABILITIES = [
  'purchase.write',
  'purchase.receive',
  'stocktake.write',
  'stocktake.complete',
  'license.manage',
  'workflow.manage',
] as const

describe('the new capabilities default to the owner and the admin', () => {
  it.each(NEW_CAPABILITIES)('%s: owner and manager hold it, a seller does not', (capability) => {
    expect(CAPABILITIES).toContain(capability)
    expect(can('owner', capability)).toBe(true)
    expect(can('manager', capability)).toBe(true)
    expect(can('seller', capability)).toBe(false)
  })

  it.each(NEW_CAPABILITIES)('%s is a cell of exactly one module in the matrix', (capability) => {
    const holders = PERMISSION_MODULES.filter((m) =>
      [...m.read, ...m.write, ...m.full].includes(capability),
    )
    expect(holders.map((m) => m.key)).toHaveLength(1)
  })
})

const read = (file: string) =>
  readFileSync(join(__dirname, '../routes', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** The options object of one route: from its path to its handler. */
function optionsOf(source: string, method: string, path: string): string {
  const at = source.search(new RegExp(`\\.${method}\\(\\s*'${path.replace(/[/:]/g, '\\$&')}'`))
  expect(at, `${method} ${path} exists`).toBeGreaterThan(-1)
  return source.slice(at, at + 900).split('async (request')[0] ?? ''
}

const GUARDED: ReadonlyArray<{
  file: string
  method: string
  path: string
  capability: (typeof NEW_CAPABILITIES)[number] | 'payment.record'
}> = [
  {
    file: 'purchasing.routes.ts',
    method: 'post',
    path: '/api/purchase-orders',
    capability: 'purchase.write',
  },
  {
    file: 'purchasing.routes.ts',
    method: 'patch',
    path: '/api/purchase-orders/:id',
    capability: 'purchase.write',
  },
  {
    file: 'purchasing.routes.ts',
    method: 'post',
    path: '/api/purchase-orders/:id/receive',
    capability: 'purchase.receive',
  },
  {
    file: 'cycle-count.routes.ts',
    method: 'post',
    path: '/api/cycle-counts',
    capability: 'stocktake.write',
  },
  {
    file: 'cycle-count.routes.ts',
    method: 'post',
    path: '/api/cycle-counts/:id/lines',
    capability: 'stocktake.write',
  },
  {
    file: 'cycle-count.routes.ts',
    method: 'post',
    path: '/api/cycle-counts/:id/complete',
    capability: 'stocktake.complete',
  },
  {
    file: 'cycle-count.routes.ts',
    method: 'post',
    path: '/api/cycle-counts/:id/cancel',
    capability: 'stocktake.write',
  },
  {
    file: 'inventory-insights.routes.ts',
    method: 'post',
    path: '/api/inventory/reorder-suggestions/draft-po',
    capability: 'purchase.write',
  },
  {
    file: 'transaction.routes.ts',
    method: 'post',
    path: '/api/transactions',
    capability: 'payment.record',
  },
  {
    file: 'workflow.routes.ts',
    method: 'post',
    path: '/api/v1/workflows',
    capability: 'workflow.manage',
  },
  {
    file: 'workflow.routes.ts',
    method: 'patch',
    path: '/api/v1/workflows/:id',
    capability: 'workflow.manage',
  },
  {
    file: 'workflow.routes.ts',
    method: 'delete',
    path: '/api/v1/workflows/:id',
    capability: 'workflow.manage',
  },
  {
    file: 'billing.routes.ts',
    method: 'post',
    path: '/api/billing/upgrade',
    capability: 'license.manage',
  },
  {
    file: 'billing.routes.ts',
    method: 'post',
    path: '/api/billing/upgrade-requests/:id/cancel',
    capability: 'license.manage',
  },
  {
    file: 'billing.routes.ts',
    method: 'post',
    path: '/api/billing/offline-license/activate-seat',
    capability: 'license.manage',
  },
  {
    file: 'billing.routes.ts',
    method: 'post',
    path: '/api/billing/offline-license/connect',
    capability: 'license.manage',
  },
  {
    file: 'billing.routes.ts',
    method: 'post',
    path: '/api/billing/offline-license/tier1-report',
    capability: 'license.manage',
  },
  {
    file: 'billing.routes.ts',
    method: 'post',
    path: '/api/billing/offline-license/tier2-report',
    capability: 'license.manage',
  },
]

describe('each write route names the capability that governs it', () => {
  for (const { file, method, path, capability } of GUARDED) {
    it(`${method.toUpperCase()} ${path} → ${capability}`, () => {
      expect(optionsOf(read(file), method, path)).toContain(`requireCapability('${capability}')`)
    })
  }
})

describe('each workspace decides for itself, and nobody else does', () => {
  it('the owner can grant a seller a capability in THIS workspace only', () => {
    const inA = effectiveCapabilities('seller', [
      { role: 'seller', capability: 'purchase.receive', granted: true },
    ])
    const inB = effectiveCapabilities('seller', [])
    expect(holds({ role: 'seller', capabilities: inA }, 'purchase.receive')).toBe(true)
    expect(holds({ role: 'seller', capabilities: inB }, 'purchase.receive')).toBe(false)
  })

  it('the owner can take a capability away from the manager', () => {
    const revoked = effectiveCapabilities('manager', [
      { role: 'manager', capability: 'stocktake.complete', granted: false },
    ])
    expect(holds({ role: 'manager', capabilities: revoked }, 'stocktake.complete')).toBe(false)
    expect(holds({ role: 'manager', capabilities: revoked }, 'stocktake.write')).toBe(true)
  })

  it('a custom role holds exactly what it was given', () => {
    const counter = customRoleAccess(['stocktake.write', 'stocktake.complete'])
    const as = { role: 'seller' as const, capabilities: counter.capabilities }
    expect(holds(as, 'stocktake.complete')).toBe(true)
    expect(holds(as, 'purchase.receive')).toBe(false)
    expect(holds(as, 'license.manage')).toBe(false)
  })

  it('a new workspace starts from the defaults', () => {
    const fresh = effectiveCapabilities('manager', [])
    for (const capability of NEW_CAPABILITIES) expect(fresh.has(capability)).toBe(true)
    expect(effectiveCapabilities('seller', []).has('purchase.write')).toBe(false)
  })
})
