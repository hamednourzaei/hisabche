// ============================================
// Role → capability rules. Pure functions, no platform dependency.
// Mirrors the ranking already used by the workspace slice on web.
// ============================================

import type { Session, WorkspaceRole } from './types'

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

export type Capability =
  | 'record.read'
  | 'record.create'
  | 'record.update'
  | 'record.delete'
  | 'member.invite'
  | 'workspace.manage'

const MIN_ROLE: Record<Capability, WorkspaceRole> = {
  'record.read': 'viewer',
  'record.create': 'member',
  'record.update': 'member',
  'record.delete': 'owner',
  'member.invite': 'admin',
  'workspace.manage': 'owner',
}

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

export function can(role: WorkspaceRole, capability: Capability): boolean {
  return roleAtLeast(role, MIN_ROLE[capability])
}

/** Capability check for a whole session. Absent workspace falls back to `member`. */
export function sessionCan(session: Session | null, capability: Capability): boolean {
  if (!session) return false
  return can(session.workspace?.role ?? 'member', capability)
}
