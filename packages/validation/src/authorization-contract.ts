// ============================================
// packages/validation/src/authorization-contract.ts
//
// Canonical role and capability contract shared by Backend and Local Engine.
// Eliminates vocabulary drift and prevents Viewer privilege escalation.
// ============================================

export const CANONICAL_WORKSPACE_ROLES = ['owner', 'manager', 'seller', 'viewer'] as const
export type CanonicalWorkspaceRole = (typeof CANONICAL_WORKSPACE_ROLES)[number]

export const CANONICAL_ROLE_RANK: Readonly<Record<CanonicalWorkspaceRole, number>> = {
  owner: 3,
  manager: 2,
  seller: 1,
  viewer: 0,
}

export const CLIENT_ROLE_ALIASES: Readonly<Record<string, CanonicalWorkspaceRole>> = {
  owner: 'owner',
  admin: 'manager',
  manager: 'manager',
  member: 'seller',
  seller: 'seller',
  cashier: 'seller',
  viewer: 'viewer',
}

export function isCanonicalWorkspaceRole(value: unknown): value is CanonicalWorkspaceRole {
  return (
    typeof value === 'string' && (CANONICAL_WORKSPACE_ROLES as readonly string[]).includes(value)
  )
}

/**
 * Resolves a stored workspace role (server or client vocabulary) to a canonical
 * role, or returns null when unknown/missing so callers can fail closed.
 */
export function resolveCanonicalRole(stored: unknown): CanonicalWorkspaceRole | null {
  if (isCanonicalWorkspaceRole(stored)) return stored
  if (
    typeof stored === 'string' &&
    Object.prototype.hasOwnProperty.call(CLIENT_ROLE_ALIASES, stored)
  ) {
    return CLIENT_ROLE_ALIASES[stored] ?? null
  }
  return null
}

export function canonicalRoleAtLeast(
  role: CanonicalWorkspaceRole,
  minimum: CanonicalWorkspaceRole,
): boolean {
  const rank = CANONICAL_ROLE_RANK[role]
  const minRank = CANONICAL_ROLE_RANK[minimum]
  if (rank === undefined || minRank === undefined) return false
  return rank >= minRank
}

export type CapabilityMode = 'read' | 'write'
export type OfflineAuthorizationPolicy = 'allow_when_role_holds' | 'read_only' | 'online_only'

export interface CapabilityContractEntry {
  readonly id: string
  readonly minRole: CanonicalWorkspaceRole
  readonly mode: CapabilityMode
  readonly tenantScoped: true
  readonly sensitive: boolean
  readonly offlinePolicy: OfflineAuthorizationPolicy
  readonly serverEnforced: true
}

export const CAPABILITY_CONTRACTS = {
  // The books
  'ledger.read': {
    id: 'ledger.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'ledger.post': {
    id: 'ledger.post',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'ledger.reverse': {
    id: 'ledger.reverse',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'ledger.lock_period': {
    id: 'ledger.lock_period',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'account.manage': {
    id: 'account.manage',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Money
  'payment.read': {
    id: 'payment.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'payment.record': {
    id: 'payment.record',
    minRole: 'seller',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'payment.cancel': {
    id: 'payment.cancel',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Stock and its cost
  'inventory.read': {
    id: 'inventory.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'inventory.cost.read': {
    id: 'inventory.cost.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'inventory.configure': {
    id: 'inventory.configure',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'stock.adjust': {
    id: 'stock.adjust',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Documents
  'invoice.read': {
    id: 'invoice.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'invoice.create': {
    id: 'invoice.create',
    minRole: 'seller',
    mode: 'write',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'invoice.update': {
    id: 'invoice.update',
    minRole: 'seller',
    mode: 'write',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'invoice.delete': {
    id: 'invoice.delete',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'credit.override': {
    id: 'credit.override',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Parties and catalogue
  'customer.read': {
    id: 'customer.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'customer.write': {
    id: 'customer.write',
    minRole: 'seller',
    mode: 'write',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'product.read': {
    id: 'product.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'product.write': {
    id: 'product.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Reporting
  'report.operational.read': {
    id: 'report.operational.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'report.financial.read': {
    id: 'report.financial.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Planning and control
  'budget.read': {
    id: 'budget.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'budget.manage': {
    id: 'budget.manage',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'budget.approve': {
    id: 'budget.approve',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },

  // Data import & presence
  'data.import': {
    id: 'data.import',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'people.presence.read': {
    id: 'people.presence.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },

  // Workspace administration
  'member.manage': {
    id: 'member.manage',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'workspace.manage': {
    id: 'workspace.manage',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },

  // Human Resources & Payroll
  'payroll.read': {
    id: 'payroll.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'payroll.write': {
    id: 'payroll.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'payroll.post': {
    id: 'payroll.post',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'employee.read': {
    id: 'employee.read',
    minRole: 'manager',
    mode: 'read',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'employee.write': {
    id: 'employee.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'leave.read': {
    id: 'leave.read',
    minRole: 'viewer',
    mode: 'read',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'read_only',
    serverEnforced: true,
  },
  'leave.write': {
    id: 'leave.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },

  // Buying and counting stock
  'purchase.write': {
    id: 'purchase.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'purchase.receive': {
    id: 'purchase.receive',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'stocktake.write': {
    id: 'stocktake.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: false,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'stocktake.complete': {
    id: 'stocktake.complete',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'license.manage': {
    id: 'license.manage',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },
  'workflow.manage': {
    id: 'workflow.manage',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'online_only',
    serverEnforced: true,
  },

  // Local-engine / extended capabilities
  'pricing.write': {
    id: 'pricing.write',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'warehouse.manage': {
    id: 'warehouse.manage',
    minRole: 'manager',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
  'backup.manage': {
    id: 'backup.manage',
    minRole: 'owner',
    mode: 'write',
    tenantScoped: true,
    sensitive: true,
    offlinePolicy: 'allow_when_role_holds',
    serverEnforced: true,
  },
} as const satisfies Record<string, CapabilityContractEntry>

export type CanonicalCapabilityId = keyof typeof CAPABILITY_CONTRACTS

export function getCapabilityContract(capability: string): CapabilityContractEntry | null {
  if (!Object.prototype.hasOwnProperty.call(CAPABILITY_CONTRACTS, capability)) {
    return null
  }
  return CAPABILITY_CONTRACTS[capability as CanonicalCapabilityId]
}

export function roleHoldsCanonicalCapability(
  role: CanonicalWorkspaceRole,
  capability: string,
): boolean {
  const contract = getCapabilityContract(capability)
  if (!contract) return false
  return canonicalRoleAtLeast(role, contract.minRole)
}
