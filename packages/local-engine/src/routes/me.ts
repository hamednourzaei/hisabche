// ============================================
// packages/local-engine/src/routes/me.ts
//
// Capabilities and identity handlers for offline mode.
// In offline mode, the user always has role 'owner' with all capabilities.
// ============================================

import { updateProfileSchema } from '@hisabche/validation'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { ValidationError } from '../errors'
import { splitBusinessTypes } from './workspace'

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

    const ws = db.get<{
      name: string
      business_types: string | null
      business_types_updated_at: string | null
    }>('SELECT name, business_types, business_types_updated_at FROM local_workspace LIMIT 1')

    return {
      user: {
        id: user?.id || ctx.userId,
        email: user?.email || 'local@hisabche.local',
        fullName: user?.full_name || 'کاربر آفلاین',
        full_name: user?.full_name || 'کاربر آفلاین',
        businessName: ws?.name || 'حسابچه آفلاین',
        business_name: ws?.name || 'حسابچه آفلاین',
        businessTypes: splitBusinessTypes(ws?.business_types),
        business_types: splitBusinessTypes(ws?.business_types),
        businessTypesUpdatedAt: ws?.business_types_updated_at ?? null,
        role: 'owner',
        createdAt: user?.created_at || new Date().toISOString(),
      },
    }
  }

  /**
   * PATCH /auth/profile — the same contract the online store uses.
   *
   * The local edition has exactly one person and that person is the owner, so
   * the owner-only rule is satisfied structurally rather than by a role read.
   * An explicit industry write records its own timestamp, which is what the
   * sync conflict rule compares.
   */
  const patchProfileHandler = (c: RouteHandlerContext) => {
    const { db, body } = c
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '))
    }
    const ws = db.get<{
      id: string
      name: string
      business_types: string | null
      business_types_updated_at: string | null
    }>('SELECT id, name, business_types, business_types_updated_at FROM local_workspace LIMIT 1')
    if (!ws) throw new ValidationError('WORKSPACE_NOT_FOUND')

    const input = parsed.data
    const now = new Date().toISOString()
    if (input.businessTypes !== undefined) {
      const stored = [...new Set(input.businessTypes.map((value) => value.trim()).filter(Boolean))]
      db.run(
        'UPDATE local_workspace SET business_types = ?, business_types_updated_at = ?, updated_at = ? WHERE id = ?',
        [stored.join(','), now, now, ws.id],
      )
    }

    const user = db.get<{
      id: string
      email: string
      full_name: string
      created_at: string
    }>('SELECT id, email, full_name, created_at FROM local_user LIMIT 1')
    const fresh = db.get<{
      name: string
      business_types: string | null
      business_types_updated_at: string | null
    }>('SELECT name, business_types, business_types_updated_at FROM local_workspace LIMIT 1')

    return {
      user: {
        id: user?.id || 'local',
        email: user?.email || 'local@hisabche.local',
        fullName: input.fullName ?? user?.full_name ?? 'Local user',
        businessName: input.businessName ?? fresh?.name ?? null,
        avatarUrl: input.avatarUrl ?? null,
        businessTypes: splitBusinessTypes(fresh?.business_types),
        businessTypesUpdatedAt: fresh?.business_types_updated_at ?? null,
        onboardingCompleted: input.onboardingCompleted ?? undefined,
        storeSize: input.storeSize ?? null,
        businessNote: input.businessNote ?? null,
        role: 'owner',
        createdAt: user?.created_at || now,
      },
    }
  }

  router.get('/auth/me', authMeHandler)
  router.get('/me', authMeHandler)
  router.patch('/auth/profile', patchProfileHandler)
}
