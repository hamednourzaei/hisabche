// ============================================
// backend/src/services/admin/admin-rbac.domain.ts
//
// Admin Control Plane RBAC Domain Model.
// Pure functions, zero database queries.
// The 7 roles are FIXED IN CODE as specified by Contract §4.2.
// ============================================

export const ADMIN_ROLES = [
  'SUPER',
  'BILLING',
  'SUPPORT',
  'CONTENT',
  'MARKET',
  'OPS',
  'SECURITY',
] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_PERMISSIONS = [
  // Billing
  'billing.plans.read',
  'billing.plans.write',
  'billing.prices.read',
  'billing.prices.write',
  'billing.subscriptions.read',
  'billing.subscriptions.plan',
  'billing.subscriptions.status',
  'billing.subscriptions.extend',
  'billing.subscriptions.override_limits',
  'billing.ledger.read',
  'billing.ledger.write',
  'billing.wallet.read',
  'billing.wallet.adjust',
  'billing.upgrade_requests.read',
  'billing.upgrade_requests.decide',
  // Offline
  'offline.licences.read',
  'offline.licences.issue',
  'offline.licences.revoke',
  'offline.licences.reissue',
  'offline.licences.transfer',
  'offline.devices.read',
  'offline.devices.release',
  'offline.migration.read',
  'offline.migration.run',
  'offline.reconciliation.read',
  // Customers
  'customers.workspaces.read',
  'customers.workspaces.suspend',
  'customers.users.read',
  'customers.users.suspend',
  'customers.users.revoke_sessions',
  'customers.users.reset_mfa',
  'customers.users.force_signout',
  'customers.support_sessions.read',
  'customers.support_sessions.open',
  'customers.data_requests.read',
  'customers.data_requests.decide',
  // Product
  'product.features.read',
  'product.features.write',
  'product.flags.read',
  'product.flags.write',
  'product.ai.read',
  'product.ai.quota',
  'product.oauth.read',
  'product.oauth.write',
  'product.market.read',
  'product.market.write',
  // Operations
  'operations.health.read',
  'operations.servers.read',
  'operations.jobs.read',
  'operations.jobs.run',
  // Content
  'content.blog.read',
  'content.blog.write',
  'content.cms.read',
  'content.cms.write',
  // Security
  'security.audit.read',
  'security.roles.read',
  'security.roles.write',
  'security.sessions.read',
  'security.sessions.revoke',
  'security.events.read',
  // Admin General
  'admin.announcements.read',
  'admin.announcements.write',
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

const ROLE_PERMISSIONS_MAP: Record<AdminRole, readonly AdminPermission[]> = {
  SUPER: ADMIN_PERMISSIONS,

  BILLING: [
    'billing.plans.read',
    'billing.plans.write',
    'billing.prices.read',
    'billing.prices.write',
    'billing.subscriptions.read',
    'billing.subscriptions.plan',
    'billing.subscriptions.status',
    'billing.subscriptions.extend',
    'billing.subscriptions.override_limits',
    'billing.ledger.read',
    'billing.ledger.write',
    'billing.wallet.read',
    'billing.wallet.adjust',
    'billing.upgrade_requests.read',
    'billing.upgrade_requests.decide',
    'security.audit.read',
  ],

  SUPPORT: [
    'customers.workspaces.read',
    'customers.users.read',
    'customers.support_sessions.read',
    'customers.support_sessions.open',
    'customers.data_requests.read',
    'customers.data_requests.decide',
    'security.audit.read',
  ],

  CONTENT: [
    'content.blog.read',
    'content.blog.write',
    'content.cms.read',
    'content.cms.write',
    'security.audit.read',
  ],

  MARKET: [
    'product.market.read',
    'product.market.write',
    'product.oauth.read',
    'product.oauth.write',
    'security.audit.read',
  ],

  OPS: [
    'operations.health.read',
    'operations.servers.read',
    'operations.jobs.read',
    'operations.jobs.run',
    'product.ai.read',
    'product.ai.quota',
    'offline.devices.read',
    'security.audit.read',
  ],

  SECURITY: [
    'security.audit.read',
    'security.roles.read',
    'security.roles.write',
    'security.sessions.read',
    'security.sessions.revoke',
    'security.events.read',
    'customers.users.revoke_sessions',
    'customers.users.reset_mfa',
  ],
}

/**
 * Returns whether the specified admin role has the requested permission.
 * SUPER has all permissions.
 */
export function hasAdminPermission(
  role: AdminRole | string | undefined | null,
  permission: AdminPermission,
): boolean {
  if (!role) return false
  if (role === 'SUPER') return true
  const list = ROLE_PERMISSIONS_MAP[role as AdminRole]
  if (!list) return false
  return list.includes(permission)
}

/**
 * Returns all permissions granted to a given role.
 */
export function permissionsForRole(role: AdminRole): readonly AdminPermission[] {
  return ROLE_PERMISSIONS_MAP[role] ?? []
}
