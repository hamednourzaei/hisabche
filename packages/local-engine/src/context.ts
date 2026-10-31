// ============================================
// packages/local-engine/src/context.ts
//
// Resolves tenancy and identity for offline local engine requests.
//
// ⚠️ IDENTITY IS NAMED BY THE REQUEST OR IT IS NOT ESTABLISHED.
//
// The engine used to read «the first row of local_user» whenever a request did
// not say who was asking, and to invent a user and a workspace (`22222222-…`,
// `11111111-…`) when the table was empty. On a device with two accounts a seller's
// request that forgot the header ran with the owner's rights; on an empty device
// every request ran as somebody who did not exist. Neither is a guess a
// permission check may stand on.
//
// What the engine accepts now:
//   · the user comes from `x-user-id` (or `x-hisabche-user-id`), which the host
//     bridge stamps from the signed-in session — see app-shell providers.tsx;
//   · that user must exist in `local_user`, and the role is the ROW's. A header
//     can only LOWER it, never raise it;
//   · the one exception is the cloud edition's queue writer (`x-hisabche-queue`):
//     its user is a cloud account the device has no row for, and the server
//     decides what that account may do when the queued change is sent. It is
//     held at the lowest role here;
//   · the workspace is the device's own. A header naming another workspace is
//     refused (the queue writer carries the cloud workspace and has no other);
//   · with neither a named user nor a workspace the request has no identity and
//     is refused — except the two calls that exist to CREATE the first one.
// ============================================

import type { LocalDb } from './db'
import { ForbiddenError, HttpError } from './errors'
import type { LocalContext, WorkspaceRole } from './types'
import { ROLE_RANK } from './auth'

export const DEFAULT_BASE_CURRENCY = 'AFN'
export const DEFAULT_TIME_ZONE = 'Asia/Kabul'

/** The queue writer of the cloud edition sets this; the offline edition never does. */
const QUEUE_HEADER = 'x-hisabche-queue'

export class IdentityRequiredError extends HttpError {
  constructor(code: 'IDENTITY_REQUIRED' | 'UNKNOWN_USER' | 'WORKSPACE_REQUIRED', message: string) {
    super(401, code, message)
    this.name = 'IdentityRequiredError'
  }
}

/**
 * Calls that run BEFORE anyone exists: reading which business this device holds,
 * and creating the first one. Everything else needs a named user.
 */
export function isIdentityFree(method: string, path: string): boolean {
  const clean = path.split('?')[0]?.replace(/\/+$/, '') ?? ''
  return clean === '/workspaces' && (method === 'GET' || method === 'POST')
}

interface UserRow {
  id: string
  role: string
}

export function resolveContext(
  db: LocalDb,
  headers?: Record<string, string | undefined>,
  call?: { method: string; path: string },
): LocalContext {
  const explicitWs = headers?.['x-workspace-id']
  const rawExplicitRole = headers?.['x-user-role'] || headers?.['x-hisabche-role']
  const explicitUserId = headers?.['x-user-id'] || headers?.['x-hisabche-user-id']
  const queued = headers?.[QUEUE_HEADER] === '1'

  const ws = db.get<{
    id: string
    base_currency: string
    time_zone: string
  }>('SELECT id, base_currency, time_zone FROM local_workspace LIMIT 1')

  const identityFree = call ? isIdentityFree(call.method, call.path) : false

  // The workspace: the device's own. A different one is not this device's to open.
  if (explicitWs && ws && explicitWs !== ws.id && !queued) {
    throw new ForbiddenError('This device does not hold that workspace', 'WORKSPACE_MISMATCH', {
      workspaceId: explicitWs,
    })
  }
  const workspaceId = explicitWs || ws?.id || ''
  if (!workspaceId && !identityFree) {
    throw new IdentityRequiredError('WORKSPACE_REQUIRED', 'No workspace is open on this device')
  }

  let user: UserRow | undefined
  if (explicitUserId) {
    user = db.get<UserRow>('SELECT id, role FROM local_user WHERE id = ?', [explicitUserId])
  }

  if (!explicitUserId && !identityFree) {
    throw new IdentityRequiredError('IDENTITY_REQUIRED', 'The request does not name a user')
  }
  if (explicitUserId && !user && !queued && !identityFree) {
    throw new IdentityRequiredError('UNKNOWN_USER', 'That user is not on this device')
  }

  // The row's role is the ceiling. Nobody on file (identity-free call, or the
  // cloud queue writer) holds the lowest role.
  const dbRole: WorkspaceRole =
    user?.role && user.role in ROLE_RANK ? (user.role as WorkspaceRole) : 'viewer'

  let role: WorkspaceRole = dbRole
  if (rawExplicitRole && rawExplicitRole in ROLE_RANK) {
    const requestedRole = rawExplicitRole as WorkspaceRole
    // Prevent privilege escalation: a header can lower the role, never raise it.
    if ((ROLE_RANK[requestedRole] ?? 0) <= (ROLE_RANK[dbRole] ?? 0)) role = requestedRole
  }

  return {
    workspaceId,
    userId: explicitUserId ?? '',
    role,
    baseCurrency: ws?.base_currency || DEFAULT_BASE_CURRENCY,
    timeZone: ws?.time_zone || DEFAULT_TIME_ZONE,
  }
}
