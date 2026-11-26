// ============================================
// packages/local-engine/src/routes/me.ts
//
// Capabilities and identity handlers for offline mode.
// In offline mode, the user always has role 'owner' with all capabilities.
// ============================================

import { invoiceDraftSaveSchema, updateProfileSchema } from '@hisabche/validation'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import { newId, nowIso } from './people-common'
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
  'stock.adjust',
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

const CLIENT_ROLE: Record<string, string> = {
  owner: 'owner',
  manager: 'admin',
  seller: 'member',
  viewer: 'viewer',
}

function clientRoleOf(role: string | undefined): string {
  return (role && CLIENT_ROLE[role]) || 'viewer'
}

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
      email: string | null
      full_name: string | null
      role: string
      created_at: string
    }>('SELECT * FROM local_user WHERE id = ?', [ctx.userId])

    const ws = db.get<{
      name: string
      business_types: string | null
      business_types_updated_at: string | null
    }>('SELECT name, business_types, business_types_updated_at FROM local_workspace LIMIT 1')

    const email = user?.email || 'local@hisabche.local'
    const fullName = user?.full_name?.trim() || ws?.name || ''
    const businessName = ws?.name || null

    return {
      user: {
        id: user?.id || ctx.userId,
        email,
        fullName,
        full_name: fullName,
        businessName,
        business_name: businessName,
        businessTypes: splitBusinessTypes(ws?.business_types),
        business_types: splitBusinessTypes(ws?.business_types),
        businessTypesUpdatedAt: ws?.business_types_updated_at ?? null,
        // The caller's own role in the vocabulary the client uses, not a constant.
        role: clientRoleOf(user?.role),
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
    const { db, ctx, body } = c
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

    if (input.businessName !== undefined && input.businessName.trim()) {
      db.run('UPDATE local_workspace SET name = ?, updated_at = ? WHERE id = ?', [
        input.businessName.trim(),
        now,
        ws.id,
      ])
    }

    const user = db.get<{
      id: string
      email: string | null
      full_name: string | null
      created_at: string
    }>('SELECT id, email, full_name, created_at FROM local_user WHERE id = ?', [ctx.userId])

    if (input.fullName !== undefined && input.fullName.trim() && user?.id) {
      db.run('UPDATE local_user SET full_name = ?, updated_at = ? WHERE id = ?', [
        input.fullName.trim(),
        now,
        user.id,
      ])
    }

    const fresh = db.get<{
      name: string
      business_types: string | null
      business_types_updated_at: string | null
    }>('SELECT name, business_types, business_types_updated_at FROM local_workspace LIMIT 1')
    const freshUser = db.get<{
      id: string
      email: string | null
      full_name: string | null
      created_at: string
    }>('SELECT id, email, full_name, created_at FROM local_user WHERE id = ?', [ctx.userId])

    const cleanEmail =
      freshUser?.email && !freshUser.email.endsWith('.local') ? freshUser.email : ''
    const effectiveFullName =
      input.fullName?.trim() || freshUser?.full_name?.trim() || fresh?.name || ''
    const effectiveBusinessName = input.businessName?.trim() || fresh?.name || null

    return {
      user: {
        id: freshUser?.id || user?.id || 'local',
        email: cleanEmail,
        fullName: effectiveFullName,
        businessName: effectiveBusinessName,
        avatarUrl: input.avatarUrl ?? null,
        businessTypes: splitBusinessTypes(fresh?.business_types),
        businessTypesUpdatedAt: fresh?.business_types_updated_at ?? null,
        onboardingCompleted: input.onboardingCompleted ?? undefined,
        storeSize: input.storeSize ?? null,
        businessNote: input.businessNote ?? null,
        role: 'owner',
        createdAt: freshUser?.created_at || user?.created_at || now,
      },
    }
  }

  router.get('/auth/me', authMeHandler)
  router.get('/me', authMeHandler)
  router.patch('/auth/profile', patchProfileHandler)

  // Personal invoice drafts on device (CORE 01 offline+online parity)
  router.get('/me/invoice-drafts', (c: RouteHandlerContext) => {
    const rows = c.db.all<{
      id: string
      kind: string
      title: string
      payload_json: string
      created_at: string
      updated_at: string
    }>(
      `SELECT id, kind, title, payload_json, created_at, updated_at
       FROM local_invoice_drafts
       WHERE workspace_id = ? AND user_id = ?
       ORDER BY updated_at DESC`,
      [c.ctx.workspaceId, c.ctx.userId],
    )
    const drafts = rows.map((r) => {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(r.payload_json) as Record<string, unknown>
      } catch {
        payload = {}
      }
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        payload,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    })
    return { configured: true, drafts }
  })

  router.put('/me/invoice-drafts', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const parsed = invoiceDraftSaveSchema.safeParse(c.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '))
    }
    const input = parsed.data
    const now = nowIso()
    const payloadJson = JSON.stringify(input.payload ?? {})
    const existing = input.id
      ? c.db.get<{ id: string; created_at: string }>(
          'SELECT id, created_at FROM local_invoice_drafts WHERE id = ? AND workspace_id = ? AND user_id = ?',
          [input.id, c.ctx.workspaceId, c.ctx.userId],
        )
      : undefined
    const id = existing?.id ?? input.id ?? newId()
    const createdAt = existing?.created_at ?? now
    if (existing) {
      c.db.run(
        `UPDATE local_invoice_drafts
         SET kind = ?, title = ?, payload_json = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND user_id = ?`,
        [input.kind, input.title, payloadJson, now, id, c.ctx.workspaceId, c.ctx.userId],
      )
    } else {
      c.db.run(
        `INSERT INTO local_invoice_drafts
         (id, workspace_id, user_id, kind, title, payload_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, c.ctx.workspaceId, c.ctx.userId, input.kind, input.title, payloadJson, createdAt, now],
      )
    }
    return {
      id,
      kind: input.kind,
      title: input.title,
      payload: input.payload,
      createdAt,
      updatedAt: now,
    }
  })

  router.delete('/me/invoice-drafts/:id', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    c.db.run('DELETE FROM local_invoice_drafts WHERE id = ? AND workspace_id = ? AND user_id = ?', [
      c.params.id,
      c.ctx.workspaceId,
      c.ctx.userId,
    ])
    return { deleted: true }
  })
}
