// ============================================
// backend/src/middleware/admin-rbac.middleware.ts
//
// Admin Control Plane middleware — the ONE guard chain.
//
// - `adminRoute(permission, { stepUp })` builds the whole chain:
//     authenticate → platformAdminGuard → requireAdminPermission → [requireAdminStepUp]
// - `adminRouteByMethod(read, write, { stepUpOnWrite })` is the same thing for
//   route files where one shared `const admin` serves both GETs and mutations.
// - `requireAdminPermission` also enforces the admin session's absolute and
//   idle timeouts (V63 · S-5) before it checks the role.
// - `requireAdminStepUp` requires a TOTP check within the last 5 minutes, read
//   from the token `authenticate` has already verified.
//
// ⚠️ V63 · S-2: the MFA bypass is no longer «NODE_ENV === 'test'». It is
// `isTestRuntime()` — Vitest AND an explicitly test-built server — so a
// production process that inherited a test env var still refuses at startup
// (runtime/test-runtime.ts) instead of dropping AAL2.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'

import { AdminPermission } from '../services/admin/admin-rbac.domain'
import { AdminSecurityService, verifiedTokenClaims } from '../services/admin/admin-security.service'
import { cacheService } from '../services/cache.service'
import { authenticate } from './auth.middleware'
import { platformAdminGuard } from './platform-admin.middleware'
import { isTestRuntime } from '../runtime/test-runtime'

interface AuthenticatedAdminUser {
  id?: string | undefined
  email?: string | undefined
}

type AdminFastifyRequest = FastifyRequest & {
  user?: AuthenticatedAdminUser | undefined
}

/** Idle timeout in minutes. `0` disables the idle check (absolute still applies). */
function idleTimeoutMinutes(): number {
  const raw = Number(process.env.ADMIN_IDLE_TIMEOUT_MINUTES ?? '30')
  return Number.isFinite(raw) && raw >= 0 ? raw : 30
}

/** Absolute session lifetime in hours. `0` disables it. */
function absoluteTimeoutHours(): number {
  const raw = Number(process.env.ADMIN_ABSOLUTE_TIMEOUT_HOURS ?? '12')
  return Number.isFinite(raw) && raw > 0 ? raw : 12
}

const ACTIVITY_KEY = (userId: string) => `admin:activity:${userId}`

/**
 * Absolute + idle session timeout. Both are settings, both refuse with the
 * same structured code so the client can sign the admin out and say why.
 *
 * - absolute: measured from the access token's `iat` (never from a header).
 * - idle: measured from the last admin request on this account.
 *
 * The idle clock lives in the shared cache (Redis when configured, memory
 * otherwise). Without Redis it is per instance — documented in the threat
 * model as residual risk, never silently assumed shared.
 */
async function refuseExpiredSession(
  req: FastifyRequest,
): Promise<{ error: string; code: string } | null> {
  const user = (req as AdminFastifyRequest).user
  if (!user?.id) return null

  const claims = verifiedTokenClaims(req.headers.authorization)
  const absoluteHours = absoluteTimeoutHours()
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (absoluteHours > 0 && typeof claims.iat === 'number') {
    const ageSeconds = nowSeconds - claims.iat
    if (ageSeconds > absoluteHours * 3600) {
      return {
        error: 'Admin session has reached its maximum lifetime — sign in again',
        code: 'ADMIN_SESSION_ABSOLUTE_TIMEOUT',
      }
    }
  }

  const idleMinutes = idleTimeoutMinutes()
  if (idleMinutes > 0) {
    const last = await cacheService.get<number>(ACTIVITY_KEY(user.id))
    if (typeof last === 'number' && nowSeconds - last > idleMinutes * 60) {
      return {
        error: 'Admin session expired from inactivity — sign in again',
        code: 'ADMIN_SESSION_IDLE_TIMEOUT',
      }
    }
    void cacheService.set(ACTIVITY_KEY(user.id), nowSeconds, idleMinutes * 60 + 60).catch(() => {})
  }

  return null
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

    // Then the session's age. Cheap: token claims plus one cache read.
    const expiryRefusal = await refuseExpiredSession(req)
    if (expiryRefusal) {
      await AdminSecurityService.logSecurityEvent({
        eventType: expiryRefusal.code,
        adminEmail: user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        details: { path: req.url, method: req.method },
      })
      return reply.status(401).send(expiryRefusal)
    }

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
 * in production.
 *
 * Skipped ONLY in an explicitly built test runtime (see runtime/test-runtime).
 */
function refuseWithoutAal2(req: FastifyRequest): { error: string; code: string } | null {
  if (isTestRuntime()) return null
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

export interface AdminRouteOptions {
  /** Require a TOTP check within the last 5 minutes. Use for every state change. */
  stepUp?: boolean
}

/** One pre-handler in the admin chain. Async; a refusal is sent on the reply. */
export type AdminGuard = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

/**
 * The single builder every admin-only route should use.
 *
 * @example
 *   fastify.put('/api/ai/config', { preHandler: adminRoute('product.ai.write', { stepUp: true }) }, …)
 */
export function adminRoute(
  permission: AdminPermission,
  options: AdminRouteOptions = {},
): AdminGuard[] {
  const chain: AdminGuard[] = [authenticate, platformAdminGuard, requireAdminPermission(permission)]
  if (options.stepUp) chain.push(requireAdminStepUp)
  return chain
}

/**
 * For route files whose reads and writes share one guard constant
 * (`const admin = [authenticate, platformAdminGuard]`).
 *
 * GET/HEAD use `read`; everything else uses `write`, optionally with a
 * step-up. The returned function runs the chain in order and stops at the
 * first refusal.
 */
export function adminRouteByMethod(
  read: AdminPermission,
  write: AdminPermission,
  options: { stepUpOnWrite?: boolean } = {},
): AdminGuard {
  const readChain = adminRoute(read)
  const writeChain = adminRoute(write, { stepUp: options.stepUpOnWrite === true })

  return async function adminGuardByMethod(req: FastifyRequest, reply: FastifyReply) {
    const isRead = req.method === 'GET' || req.method === 'HEAD'
    const chain = isRead ? readChain : writeChain
    for (const guard of chain) {
      await guard(req, reply)
      if (reply.sent) return
    }
  }
}
