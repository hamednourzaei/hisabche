// ============================================
// packages/local-engine/src/routes/me.ts
//
// Capabilities and identity handlers for offline mode.
// In offline mode, the user always has role 'owner' with all capabilities.
// ============================================

import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export const ALL_CAPABILITIES = [
  'ledger.read',
  'ledger.post',
  'ledger.reverse',
  'ledger.lock_period',
  'account.manage',
  'payment.read',
  'payment.record',
  'payment.cancel',
  'inventory.read',
  'inventory.cost.read',
  'inventory.configure',
  'invoice.read',
  'invoice.create',
  'invoice.update',
  'invoice.delete',
  'customer.read',
  'customer.write',
  'product.read',
  'product.write',
  'report.operational.read',
  'report.financial.read',
  'budget.read',
  'budget.manage',
  'budget.approve',
  'data.import',
  'people.presence.read',
  'member.manage',
  'workspace.manage',
] as const

export function registerMeRoutes(router: Router): void {
  // ─── GET /governance/my-capabilities & /me/capabilities ───────
  const myCapabilitiesHandler = (_c: RouteHandlerContext) => {
    return {
      role: 'owner',
      blockedModules: [],
      hiddenModules: [],
      capabilities: [...ALL_CAPABILITIES],
    }
  }

  router.get('/governance/my-capabilities', myCapabilitiesHandler)
  router.get('/me/capabilities', myCapabilitiesHandler)

  // ─── GET /auth/me ────────────────────────────────────────────
  const authMeHandler = (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const user = db.get<{
      id: string
      email: string
      full_name: string
      role: string
      created_at: string
    }>('SELECT * FROM local_user LIMIT 1')

    const ws = db.get<{ name: string }>('SELECT name FROM local_workspace LIMIT 1')

    return {
      user: {
        id: user?.id || ctx.userId,
        email: user?.email || 'local@hisabche.local',
        fullName: user?.full_name || 'کاربر آفلاین',
        full_name: user?.full_name || 'کاربر آفلاین',
        businessName: ws?.name || 'حسابچه آفلاین',
        business_name: ws?.name || 'حسابچه آفلاین',
        role: 'owner',
        createdAt: user?.created_at || new Date().toISOString(),
      },
    }
  }

  router.get('/auth/me', authMeHandler)
  router.get('/me', authMeHandler)
}
