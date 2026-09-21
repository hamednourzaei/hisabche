// ============================================
// @hisabche/auth-core — platform-agnostic identity model
// ============================================

export type {
  AuthUser,
  WorkspaceRole,
  WorkspaceContext,
  Session,
  LoginCredentials,
  SignUpPayload,
} from './types'

export { ROLE_RANK, roleAtLeast, can, sessionCan, type Capability } from './permissions'

export {
  createSessionStore,
  parseSession,
  serializeSession,
  isSession,
  isSessionExpired,
  sessionExpiresAt,
  type SessionStore,
} from './session'
