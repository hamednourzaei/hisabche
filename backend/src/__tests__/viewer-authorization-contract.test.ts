// ============================================
// backend/src/__tests__/viewer-authorization-contract.test.ts
//
// Proves:
// 1. Canonical role/capability contract parity between @hisabche/validation,
//    Backend authorization.domain.ts, and Local Engine auth.ts.
// 2. Viewer cannot execute write capabilities over HTTP (403 CAPABILITY_REQUIRED).
// 3. Viewer retains explicitly authorized read capabilities over HTTP (200).
// 4. Unknown and missing roles fail closed (ForbiddenError).
// ============================================

import fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_ROLE_RANK,
  CANONICAL_WORKSPACE_ROLES,
  CAPABILITY_CONTRACTS,
  resolveCanonicalRole,
} from '@hisabche/validation'
import {
  CAPABILITIES,
  ROLE_RANK as BACKEND_ROLE_RANK,
  can,
  minRoleFor,
} from '../services/authorization'
import {
  WORKSPACE_ROLES as BACKEND_WORKSPACE_ROLES,
  resolveWorkspaceRole,
  requireRole,
  type TenancyContext,
} from '../services/tenancy.service'
import { requireCapability } from '../middleware/authorize.middleware'
import {
  requireCapability as localRequireCapability,
  ROLE_RANK as LOCAL_ROLE_RANK,
} from '../../../packages/local-engine/src/auth'

const WS_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

describe('Canonical Authorization Contract Parity', () => {
  it('Backend and canonical contract share identical workspace roles and ranks', () => {
    expect(BACKEND_WORKSPACE_ROLES).toEqual(CANONICAL_WORKSPACE_ROLES)
    expect(BACKEND_ROLE_RANK).toEqual(CANONICAL_ROLE_RANK)
    expect(LOCAL_ROLE_RANK.viewer).toBe(CANONICAL_ROLE_RANK.viewer)
    expect(LOCAL_ROLE_RANK.seller).toBe(CANONICAL_ROLE_RANK.seller)
    expect(LOCAL_ROLE_RANK.manager).toBe(CANONICAL_ROLE_RANK.manager)
    expect(LOCAL_ROLE_RANK.owner).toBe(CANONICAL_ROLE_RANK.owner)
  })

  it('Every Backend capability matches the canonical contract and Local Engine enforcement', () => {
    for (const cap of CAPABILITIES) {
      const contract = CAPABILITY_CONTRACTS[cap]
      expect(contract, `Missing contract for ${cap}`).toBeDefined()
      expect(minRoleFor(cap)).toBe(contract.minRole)
      expect(contract.tenantScoped).toBe(true)
      expect(contract.serverEnforced).toBe(true)

      for (const role of CANONICAL_WORKSPACE_ROLES) {
        const expected = CANONICAL_ROLE_RANK[role] >= CANONICAL_ROLE_RANK[contract.minRole]
        expect(can(role, cap), `Backend can(${role}, ${cap})`).toBe(expected)

        let localAllowed = false
        try {
          localRequireCapability(
            {
              workspaceId: WS_ID,
              userId: USER_ID,
              role,
              baseCurrency: 'AFN',
              timeZone: 'Asia/Kabul',
            },
            cap,
          )
          localAllowed = true
        } catch {
          localAllowed = false
        }
        expect(localAllowed, `Local Engine requireCapability(${role}, ${cap})`).toBe(expected)
      }
    }
  })

  it('Unknown and missing roles fail closed on both canonical resolver and tenancy service', () => {
    for (const invalid of [null, undefined, '', 'guest', 'superuser', 'root', 123, {}]) {
      expect(resolveCanonicalRole(invalid)).toBeNull()
      expect(() => resolveWorkspaceRole(invalid)).toThrow()
    }
  })
})

describe('Viewer HTTP Enforcement', () => {
  const WRITE_CAPABILITIES = [
    'invoice.create',
    'invoice.update',
    'invoice.delete',
    'payment.record',
    'payment.cancel',
    'customer.write',
    'product.write',
    'stock.adjust',
    'workspace.manage',
    'member.manage',
    'ledger.post',
    'ledger.reverse',
    'inventory.configure',
  ] as const

  const READ_CAPABILITIES = [
    'invoice.read',
    'payment.read',
    'customer.read',
    'product.read',
    'inventory.read',
    'report.operational.read',
    'leave.read',
  ] as const

  it('Refuses every write capability for an authenticated viewer with 403', async () => {
    const app = fastify()
    const viewerCtx: TenancyContext = {
      workspaceId: WS_ID,
      userId: USER_ID,
      role: resolveWorkspaceRole('viewer'),
    }

    app.addHook('preHandler', async (request) => {
      request.tenancy = viewerCtx
    })

    for (const cap of WRITE_CAPABILITIES) {
      app.post(`/test/${cap}`, { preHandler: requireCapability(cap) }, async () => ({ ok: true }))
    }
    for (const cap of READ_CAPABILITIES) {
      app.get(`/test/${cap}`, { preHandler: requireCapability(cap) }, async () => ({ ok: true }))
    }

    await app.ready()

    for (const cap of WRITE_CAPABILITIES) {
      const res = await app.inject({ method: 'POST', url: `/test/${cap}`, payload: {} })
      expect(res.statusCode, `POST /test/${cap} must return 403 for viewer`).toBe(403)
      const body = res.json() as { code: string; role: string; capability: string }
      expect(body.code).toBe('CAPABILITY_REQUIRED')
      expect(body.role).toBe('viewer')
      expect(body.capability).toBe(cap)
    }

    for (const cap of READ_CAPABILITIES) {
      const res = await app.inject({ method: 'GET', url: `/test/${cap}` })
      expect(res.statusCode, `GET /test/${cap} must return 200 for viewer`).toBe(200)
    }

    expect(() => requireRole(viewerCtx, 'seller')).toThrow()
    await app.close()
  })
})
