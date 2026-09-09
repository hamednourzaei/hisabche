// ============================================
// Canonical identity model — single source of truth for web and mobile.
// Platform packages must import these instead of redeclaring them.
// ============================================

export interface AuthUser {
  id: string
  email: string
  fullName: string
  /**
   * ⚠️ `null` AND `''` MEAN DIFFERENT THINGS, AND THE SERVER NOW SENDS BOTH.
   * `null` is «never set» — the state the owner is prompted to fill in. It used
   * to arrive as `''` because the response schema declared a plain string and
   * fast-json-stringify substitutes `""` for null rather than failing.
   */
  businessName?: string | null
  avatarUrl?: string | null
  createdAt: string
  /**
   * Workspace role, for DISPLAY only — colouring the admin label, deciding
   * whether to offer a settings link.
   *
   * `null` means «not unambiguous» (several memberships) or «not known», NOT
   * «no role», and it never authorizes anything: the server re-resolves the
   * role per request from the workspace that request names.
   */
  role?: string | null
  /**
   * Authoritative onboarding state from the server.
   *
   * Optional because a cached user from before this shipped will not have it;
   * absent is treated as "unknown", not as "not completed".
   */
  onboardingCompleted?: boolean
  businessTypes?: string[]
  storeSize?: string | null
  businessNote?: string | null
}

/** Workspace-level role. Ordering is meaningful — see ROLE_RANK. */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface WorkspaceContext {
  workspaceId: string
  workspaceName: string
  role: WorkspaceRole
}

export interface Session {
  user: AuthUser
  token: string
  workspace?: WorkspaceContext
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignUpPayload extends LoginCredentials {
  fullName: string
  businessName?: string
}
