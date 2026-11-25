// ============================================
// packages/local-engine/src/auth.ts
//
// Role and capability-based authorization for the local offline engine.
// Mirrors the backend permission matrix to enforce separation of duties offline.
// ============================================

import {
  CANONICAL_ROLE_RANK,
  canonicalRoleAtLeast,
  getCapabilityContract,
  resolveCanonicalRole,
} from '@hisabche/validation'

import { ForbiddenError } from './errors'
import type { LocalContext, WorkspaceRole } from './types'

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: CANONICAL_ROLE_RANK.owner,
  admin: CANONICAL_ROLE_RANK.manager,
  manager: CANONICAL_ROLE_RANK.manager,
  cashier: CANONICAL_ROLE_RANK.seller,
  seller: CANONICAL_ROLE_RANK.seller,
  member: CANONICAL_ROLE_RANK.seller,
  viewer: CANONICAL_ROLE_RANK.viewer,
}

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  const resolvedRole = resolveCanonicalRole(role)
  const resolvedMin = resolveCanonicalRole(minimum)
  if (!resolvedRole || !resolvedMin) return false
  return canonicalRoleAtLeast(resolvedRole, resolvedMin)
}

export function requireRole(ctx: LocalContext, ...allowedRoles: WorkspaceRole[]): void {
  const resolved = resolveCanonicalRole(ctx.role)
  if (!resolved) {
    throw new ForbiddenError(
      `Role ${String(ctx.role)} is not authorized for this operation`,
      'FORBIDDEN',
      {
        currentRole: ctx.role,
        requiredRoles: allowedRoles,
      },
    )
  }
  if (resolved === 'owner') return
  if (!allowedRoles.some((r) => roleAtLeast(ctx.role, r))) {
    throw new ForbiddenError(`Role ${ctx.role} is not authorized for this operation`, 'FORBIDDEN', {
      currentRole: ctx.role,
      requiredRoles: allowedRoles,
    })
  }
}

export function requireCapability(ctx: LocalContext, capability: string): void {
  const contract = getCapabilityContract(capability)
  if (!contract) {
    throw new ForbiddenError(`Unknown capability ${capability}`, 'CAPABILITY_UNKNOWN', {
      capability,
      role: ctx.role,
    })
  }

  const resolved = resolveCanonicalRole(ctx.role)
  if (!resolved) {
    throw new ForbiddenError(
      `Role ${String(ctx.role)} is not authorized for ${capability}`,
      'FORBIDDEN',
      {
        capability,
        role: ctx.role,
      },
    )
  }

  if (!canonicalRoleAtLeast(resolved, contract.minRole)) {
    throw new ForbiddenError(
      `Capability ${capability} requires ${contract.minRole} role`,
      'CAPABILITY_REQUIRED',
      { capability, requiredRole: contract.minRole, role: ctx.role },
    )
  }
}
