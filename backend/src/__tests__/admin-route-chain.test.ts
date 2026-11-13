// ============================================
// backend/src/__tests__/admin-route-chain.test.ts
//
// V63 · S-7 — the guard that stops the NEXT admin route from shipping with
// only the email allow-list.
//
// It reads every route file in `backend/src/routes`, resolves each guard
// expression (arrays, `adminRoute(...)`, `adminRouteByMethod(...)` and the
// `{ preHandler: … }` constant shape), and asserts:
//
//   1. every admin route carries an admin permission check,
//   2. every admin route keeps `platformAdminGuard`,
//   3. every non-GET route on the sensitive list carries a fresh step-up,
//   4. exactly one route is exempt from (1) — `POST /api/admin/security/step-up`.
//
// ⚠️ INJECTION-TESTED: the last block feeds the analyzer a synthetic source
// with the permission removed and proves it reports a violation. Without that,
// a parser that silently stopped matching would leave this guard green forever.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ADMIN_CHAIN_EXEMPT_PERMISSION,
  analyzeAdminRoutes,
  auditAdminRouteChain,
  type AdminRouteRecord,
} from '../utils/admin-route-audit'

const ROUTES = join(__dirname, '..', 'routes')

function allAdminRecords(): AdminRouteRecord[] {
  const records: AdminRouteRecord[] = []
  for (const file of readdirSync(ROUTES).filter((name) => name.endsWith('.routes.ts'))) {
    const source = readFileSync(join(ROUTES, file), 'utf8')
    records.push(...analyzeAdminRoutes(file, source))
  }
  return records.filter((record) => record.isAdminRoute)
}

describe('every admin route carries the full chain', () => {
  it('finds the admin surface at all (a parser that matches nothing proves nothing)', () => {
    const records = allAdminRecords()
    // The console has well over fifty admin routes; a floor catches a broken
    // reader without pinning an exact number that ordinary growth changes.
    expect(records.length).toBeGreaterThan(50)
    expect(records.some((record) => record.path === '/api/ai/config')).toBe(true)
    expect(records.some((record) => record.path === '/api/admin/instances/scale')).toBe(true)
  })

  it('has no route missing its permission, platform guard or required step-up', () => {
    const violations = auditAdminRouteChain(allAdminRecords())
    const readable = violations.map((v) => `${v.file} ${v.method} ${v.path} → ${v.reason}`)
    expect(readable).toEqual([])
  })

  it('the step-up exemption list holds exactly one route, and it is the step-up mint', () => {
    expect([...ADMIN_CHAIN_EXEMPT_PERMISSION]).toEqual(['/api/admin/security/step-up'])
  })

  it('the AI key and server-scaling routes are RBAC-gated (the V63 finding)', () => {
    const records = allAdminRecords()
    const byPath = (path: string) => records.filter((record) => record.path === path)

    for (const path of ['/api/ai/config', '/api/ai/config/test', '/api/ai/quota/:workspaceId']) {
      const found = byPath(path)
      expect(found.length, path).toBeGreaterThan(0)
      for (const record of found) {
        expect(record.hasPermission, `${path} needs a permission`).toBe(true)
        // Reading the configuration (GET) is a read; the key itself is never in
        // that response. Every WRITE to these paths must re-prove the second
        // factor, because each one can change what the owner is billed.
        if (record.method !== 'GET') {
          expect(record.hasStepUp, `${path} needs a step-up`).toBe(true)
        }
      }
    }

    for (const path of ['/api/admin/instances', '/api/admin/instances/scale']) {
      for (const record of byPath(path)) {
        expect(record.hasPermission, `${path} needs a permission`).toBe(true)
      }
    }
    const scaleWrite = byPath('/api/admin/instances/scale').find((r) => r.method === 'PUT')
    expect(scaleWrite?.hasStepUp).toBe(true)
  })

  it('the blog, market and oauth admin surfaces left the allow-list-only state', () => {
    const records = allAdminRecords()
    for (const prefix of ['/api/admin/blog', '/api/admin/market', '/api/admin/oauth']) {
      const found = records.filter((record) => record.path.startsWith(prefix))
      expect(found.length, prefix).toBeGreaterThan(0)
      for (const record of found) {
        expect(record.hasPermission, `${record.method} ${record.path}`).toBe(true)
      }
    }
  })
})

describe('the analyzer itself (injection test)', () => {
  it('reports a route whose permission guard was removed', () => {
    const source = `
      const adminOnly = [authenticate, platformAdminGuard]
      fastify.get('/api/admin/danger', { preHandler: adminOnly }, async () => ({}))
    `
    const records = analyzeAdminRoutes('synthetic.routes.ts', source)
    const violations = auditAdminRouteChain(records)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toBe('no_permission')
  })

  it('accepts the same route once the permission is present', () => {
    const source = `
      const read = [authenticate, platformAdminGuard, requireAdminPermission('operations.health.read')]
      fastify.get('/api/admin/danger', { preHandler: read }, async () => ({}))
    `
    expect(auditAdminRouteChain(analyzeAdminRoutes('synthetic.routes.ts', source))).toEqual([])
  })

  it('demands a step-up on a sensitive write', () => {
    const source = `
      const write = [authenticate, platformAdminGuard, requireAdminPermission('product.ai.write')]
      fastify.put('/api/ai/config', { preHandler: write }, async () => ({}))
    `
    const violations = auditAdminRouteChain(analyzeAdminRoutes('synthetic.routes.ts', source))
    expect(violations.map((v) => v.reason)).toEqual(['no_step_up'])
  })

  it('understands adminRoute(…, { stepUp: true }) as permission + step-up', () => {
    const source = `
      fastify.put('/api/ai/config', { preHandler: adminRoute('product.ai.write', { stepUp: true }) }, async () => ({}))
    `
    expect(auditAdminRouteChain(analyzeAdminRoutes('synthetic.routes.ts', source))).toEqual([])
  })

  it('does not read the next registration when a public route has no preHandler', () => {
    const source = `
      fastify.get('/api/public/key', async () => ({}))
      const read = [authenticate, platformAdminGuard, requireAdminPermission('offline.licences.read')]
      fastify.get('/api/admin/offline/licences', { preHandler: read }, async () => ({}))
    `
    const records = analyzeAdminRoutes('synthetic.routes.ts', source)
    const publicRoute = records.find((r) => r.path === '/api/public/key')
    expect(publicRoute?.isAdminRoute).toBe(false)
    expect(publicRoute?.guardText).toBe('')
  })
})
