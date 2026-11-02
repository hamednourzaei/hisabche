// ============================================
// packages/local-engine/src/auth.ts
//
// Role and capability-based authorization for the local offline engine.
// Mirrors the backend permission matrix to enforce separation of duties offline.
// ============================================

import { ForbiddenError } from './errors'
import type { LocalContext, WorkspaceRole } from './types'

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  manager: 2,
  cashier: 1,
  seller: 1,
  member: 1,
  viewer: 0,
}

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  const currentRank = ROLE_RANK[role] ?? 0
  const minRank = ROLE_RANK[minimum] ?? 0
  return currentRank >= minRank
}

export function requireRole(ctx: LocalContext, ...allowedRoles: WorkspaceRole[]): void {
  if (ctx.role === 'owner') return
  if (!allowedRoles.some((r) => roleAtLeast(ctx.role, r))) {
    throw new ForbiddenError(`Role ${ctx.role} is not authorized for this operation`, 'FORBIDDEN', {
      currentRole: ctx.role,
      requiredRoles: allowedRoles,
    })
  }
}

// The lowest role is the server's (`minRoleFor` in backend/src/services/authorization); the parity test
// `viewer-cannot-write.test.ts` reads both tables and fails when they differ.
const SELLER_CAPABILITIES = new Set([
  'invoice.create',
  'invoice.update',
  'payment.record',
  'customer.write',
])

const OWNER_CAPABILITIES = new Set([
  'ledger.reverse',
  'ledger.lock_period',
  'inventory.configure',
  'invoice.delete',
  'workspace.manage',
  'backup.manage',
  'member.manage',
])

const MANAGER_CAPABILITIES = new Set([
  'ledger.read',
  'ledger.post',
  'account.manage',
  'payment.cancel',
  'inventory.cost.read',
  'product.write',
  'pricing.write',
  'report.financial.read',
  'stock.adjust',
  'warehouse.manage',
  'payroll.write',
  'employee.write',
  'leave.write',
  'budget.manage',
  'data.import',
])

export function requireCapability(ctx: LocalContext, capability: string): void {
  // ⚠️ AN UNKNOWN NAME IS REFUSED, NOT WAVED THROUGH. A typo in a route used to
  // pass for every role, which is the same as having no guard at all — and
  // nothing noticed, because the route kept working.
  if (
    !OWNER_CAPABILITIES.has(capability) &&
    !MANAGER_CAPABILITIES.has(capability) &&
    !SELLER_CAPABILITIES.has(capability)
  ) {
    throw new ForbiddenError(`Unknown capability ${capability}`, 'CAPABILITY_UNKNOWN', {
      capability,
      role: ctx.role,
    })
  }

  if (ctx.role === 'owner') return

  if (OWNER_CAPABILITIES.has(capability)) {
    throw new ForbiddenError(
      `Capability ${capability} requires owner role`,
      'CAPABILITY_REQUIRED',
      { capability, requiredRole: 'owner', role: ctx.role },
    )
  }

  if (MANAGER_CAPABILITIES.has(capability) && !roleAtLeast(ctx.role, 'manager')) {
    throw new ForbiddenError(
      `Capability ${capability} requires manager role`,
      'CAPABILITY_REQUIRED',
      { capability, requiredRole: 'manager', role: ctx.role },
    )
  }

  if (SELLER_CAPABILITIES.has(capability) && !roleAtLeast(ctx.role, 'seller')) {
    throw new ForbiddenError(
      `Capability ${capability} requires seller role`,
      'CAPABILITY_REQUIRED',
      { capability, requiredRole: 'seller', role: ctx.role },
    )
  }
}
