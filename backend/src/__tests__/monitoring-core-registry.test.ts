// ============================================
// backend/src/__tests__/monitoring-core-registry.test.ts
//
// The core registry is a map of the REAL architecture:
//  1. every core id is unique, every group valid, every owner non-empty;
//  2. attribution is deterministic — longest prefix wins, one core per route;
//  3. EVERY route template declared in backend/src/routes is claimed by a
//     core prefix (a new route without a registry entry goes red here);
//  4. operation groups stay inside the closed enum — no dynamic labels.
// ============================================

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CORES,
  CORE_GROUPS,
  OPERATION_GROUPS,
  coreById,
  coreForRoute,
  operationGroupFor,
} from '../services/monitoring/core-registry'

const SRC = join(__dirname, '..')

describe('registry shape', () => {
  it('has unique ids, valid groups and real owners', () => {
    const ids = CORES.map((core) => core.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const core of CORES) {
      expect(CORE_GROUPS).toContain(core.group)
      expect(core.owner.length).toBeGreaterThan(0)
      expect(core.prefixes.length).toBeGreaterThan(0)
      expect(core.slo.p95TargetMs).toBeGreaterThan(0)
      expect(core.slo.errorBudgetPercent).toBeGreaterThan(0)
    }
    // The cores the mission names must all exist under their real ids.
    for (const id of [
      'auth',
      'tenancy',
      'permissions',
      'sales',
      'payments',
      'accounting',
      'costing',
      'inventory',
      'pos',
      'crm',
      'purchasing',
      'hr',
      'manufacturing',
      'service-delivery',
      'sync',
      'offline',
      'reporting',
      'ai',
      'notifications',
      'jobs',
      'platform',
    ]) {
      expect(coreById(id), id).not.toBeNull()
    }
  })

  it('attributes by longest prefix — one core, never two', () => {
    expect(coreForRoute('/api/invoices/:id').id).toBe('sales')
    expect(coreForRoute('/api/inventory/layers').id).toBe('costing')
    expect(coreForRoute('/api/inventory/stock').id).toBe('inventory')
    expect(coreForRoute('/api/inventory').id).toBe('inventory')
    expect(coreForRoute('/api/operations/budgets').id).toBe('accounting')
    expect(coreForRoute('/api/operations/timesheets').id).toBe('hr')
    expect(coreForRoute('/api/operations/serials').id).toBe('inventory')
    expect(coreForRoute('/api/admin/monitor/overview').id).toBe('platform')
    expect(coreForRoute('/api/sync/push').id).toBe('sync')
    expect(coreForRoute('/api/public/invoices/:token').id).toBe('sales')
    expect(coreForRoute('/api/public/attendance/:token').id).toBe('hr')
    expect(coreForRoute('/mcp').id).toBe('ai')
    // Unclaimed templates land in platform — the API surface itself.
    expect(coreForRoute('/totally/unknown/path').id).toBe('platform')
  })

  it('keeps operation groups inside the closed enum', () => {
    const cases: Array<[string, string]> = [
      ['GET', 'read'],
      ['HEAD', 'read'],
      ['DELETE', 'delete'],
      ['PUT', 'update'],
      ['PATCH', 'update'],
      ['POST', 'create'],
    ]
    for (const [method, group] of cases) {
      expect(operationGroupFor(method, '/api/invoices')).toBe(group)
    }
    expect(operationGroupFor('POST', '/api/invoices/:id/return')).toBe('action')
    expect(operationGroupFor('POST', '/api/payments/:id/confirm')).toBe('action')
    expect(operationGroupFor('POST', '/api/invoices')).toBe('create')
    expect(operationGroupFor('TRACE', '/api/anything')).toBe('other')
    for (const group of OPERATION_GROUPS) {
      expect(OPERATION_GROUPS).toContain(group)
    }
  })
})

describe('every declared route is claimed', () => {
  // The same extraction the registry was built from: registration prefixes
  // applied, dynamic storefront templates excluded (they are /api/storefront/*).
  function declaredTemplates(): string[] {
    const index = readFileSync(join(SRC, 'index.ts'), 'utf8')
    const prefixOf: Record<string, string> = {}
    for (const m of index.matchAll(/register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*'([^']+)'/g)) {
      prefixOf[m[1]!] = m[2]!
    }
    const fileOf: Record<string, string> = {}
    for (const m of index.matchAll(
      /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+'\.\/routes\/([^']+)'/g,
    )) {
      const file = m[3]!.endsWith('.ts') ? m[3]! : m[3]! + '.ts'
      if (m[2]) fileOf[m[2]] = file
      if (m[1]) {
        for (const part of m[1].split(',')) {
          const name = part
            .trim()
            .split(/\s+as\s+/)
            .pop()!
            .trim()
          if (name) fileOf[name] = file
        }
      }
    }
    const templates = new Set<string>()
    for (const [name, file] of Object.entries(fileOf)) {
      const full = join(SRC, 'routes', file)
      if (!existsSync(full)) continue
      const source = readFileSync(full, 'utf8')
      const prefix = prefixOf[name] ?? ''
      for (const m of source.matchAll(
        /(?:fastify|server|app)\.(?:get|post|put|patch|delete)\(\s*[`']([^`']+)[`']/g,
      )) {
        const path = m[1]!
        if (path.includes('${')) continue
        templates.add(prefix + path)
      }
    }
    return [...templates].sort()
  }

  it('finds the real route surface (never a silent empty scan)', () => {
    const templates = declaredTemplates()
    expect(templates.length).toBeGreaterThan(500)
  })

  it('no declared template falls through to platform without a claimed prefix', () => {
    const templates = declaredTemplates()
    const platformPrefixes = coreById('platform')!.prefixes
    const unclaimed = templates.filter((template) => {
      const core = coreForRoute(template)
      if (core.id !== 'platform') return false
      // Platform is fine when a platform prefix actually claims the template.
      return !platformPrefixes.some(
        (prefix) => template === prefix || template.startsWith(prefix + '/'),
      )
    })
    expect(unclaimed).toEqual([])
  })

  it('every core owns at least one declared template (no wish-list cores)', () => {
    const templates = declaredTemplates()
    const owned = new Set(templates.map((template) => coreForRoute(template).id))
    const idle = CORES.filter((core) => !owned.has(core.id)).map((core) => core.id)
    // `offline` owns /api/public/offline + /api/cloud-migration; all cores must
    // map to something real. A core with zero routes is a registry lie.
    expect(idle).toEqual([])
  })
})
