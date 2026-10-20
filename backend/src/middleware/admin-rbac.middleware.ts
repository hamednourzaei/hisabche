// ============================================
// backend/src/middleware/admin-rbac.middleware.ts
//
// Admin Control Plane Middleware:
// - requireAdminPermission: Inner fence enforcing the 7 roles and granular permissions.
// - requireAdminAal2: Enforces Supabase TOTP MFA (AAL2).
// - requireAdminStepUp: Enforces fresh Step-Up verification (<= 5 minutes).
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { AdminPermission } from '../services/admin/admin-rbac.domain'
import { AdminSecurityService, verifiedTokenClaims } from '../services/admin/admin-security.service'

interface AuthenticatedAdminUser {
  id?: string | undefined
  email?: string | undefined
}

type AdminFastifyRequest = FastifyRequest & {
  user?: AuthenticatedAdminUser | undefined
}

export function requireAdminPermission(permission: AdminPermission) {
  return async function adminPermissionGuard(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as AdminFastifyRequest).user
    if (!user?.id) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      })
    }

    // MFA first: every admin permission needs a TOTP-verified session (AAL2).
    const mfaRefusal = refuseWithoutAal2(req)
    if (mfaRefusal) return reply.status(403).send(mfaRefusal)

    const email = user.email ?? ''
    const allowed = await AdminSecurityService.checkPermission(user.id, email, permission)

    if (!allowed) {
      await AdminSecurityService.logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        adminEmail: email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        details: { requiredPermission: permission, path: req.url, method: req.method },
      })

      return reply.status(403).send({
        error: `Permission denied: ${permission}`,
        code: 'ADMIN_PERMISSION_DENIED',
        required: permission,
      })
    }
  }
}

/**
 * AAL2 = this session passed a TOTP check (Supabase MFA). Read from the
 * verified access token — `request.user` (from `getUser`) carries no `aal`,
 * and `app_metadata` never does, which is why the old check could never pass
 * in production. The test environment has no Supabase MFA, so it is skipped
 * there; the step-up test below drives real claims.
 */
function refuseWithoutAal2(req: FastifyRequest): { error: string; code: string } | null {
  if (process.env.NODE_ENV === 'test') return null
  const claims = verifiedTokenClaims(req.headers.authorization)
  if (claims.aal === 'aal2') return null
  return { error: 'MFA verification required (AAL2)', code: 'ADMIN_MFA_REQUIRED' }
}

/**
 * Fresh step-up: a TOTP check within the last 5 minutes, read from the
 * verified token's `amr`. The client's `X-Admin-Step-Up-Timestamp` must equal
 * that time — it says WHICH check the admin just passed; it never replaces it.
 */
export async function requireAdminStepUp(req: FastifyRequest, reply: FastifyReply) {
  const claims = verifiedTokenClaims(req.headers.authorization)
  const header = req.headers['x-admin-step-up-timestamp'] as string | undefined
  const verifiedAt = AdminSecurityService.lastTotpAt(claims)
  const valid =
    AdminSecurityService.isStepUpFresh(claims) &&
    verifiedAt !== null &&
    header === String(verifiedAt)

  if (!valid) {
    const user = (req as AdminFastifyRequest).user
    await AdminSecurityService.logSecurityEvent({
      eventType: 'STEP_UP_REQUIRED',
      adminEmail: user?.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      details: { path: req.url, method: req.method },
    })

    return reply.status(403).send({
      error: 'Fresh step-up authentication required (within 5 minutes)',
      code: 'ADMIN_STEP_UP_REQUIRED',
    })
  }
}
