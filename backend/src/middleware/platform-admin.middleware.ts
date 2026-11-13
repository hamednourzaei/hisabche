// ============================================
// backend/src/middleware/platform-admin.middleware.ts
// Platform admin authorization guard for backend API.
// Reuses ADMIN_ALLOWED_EMAILS from environment.
//
// V63 · S-5 — the email allow-list is the FIRST gate; the optional IP
// allow-list is the second. Both live here because every admin-only route
// already passes through this guard, including `/security/step-up`, which
// carries no permission. Putting the IP check anywhere else would leave a
// hole on exactly the routes that do not use `adminRoute`.
//
// An empty IP list means the feature is OFF (see admin-ip-allowlist.service.ts):
// a fresh deployment behaves exactly as before, and the owner opts in by
// adding one entry.
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'

import { adminIpAllowlistService } from '../services/admin/admin-ip-allowlist.service'

const ADMIN_ALLOWED_EMAILS = (() => {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
})()

/** True when the email is on the platform-admin allowlist — the ONE reader of it. */
export function isAllowlistedAdminEmail(email: string): boolean {
  return ADMIN_ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}

/**
 * Who may always reach `/api/admin/security/*` to repair the IP allow-list.
 * Defaults to the first listed admin email, so a deployment that never sets the
 * variable still has a working way back in. Read here, beside the allow-list
 * itself: the constitution guard asserts the variable has exactly one reader.
 */
export function breakGlassEmail(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.ADMIN_BREAK_GLASS_EMAIL?.trim()
  if (explicit) return explicit.toLowerCase()
  const first = (env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)[0]
  return first ? first.toLowerCase() : null
}

/** The route without its query string — the allow-list matches a path. */
function pathOf(request: FastifyRequest): string {
  const url = request.url ?? ''
  const query = url.indexOf('?')
  return query === -1 ? url : url.slice(0, query)
}

/**
 * Fastify preHandler hook that checks if the authenticated user
 * is a platform admin (email in allowlist).
 * Must be placed AFTER `authenticate` so `request.user` exists.
 */
export async function platformAdminGuard(request: FastifyRequest, reply: FastifyReply) {
  // `authenticate` middleware attaches `request.user` and `request.userId`
  const user = request.user

  if (!user || !user.email) {
    return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }

  const userEmail = user.email.toLowerCase()
  const isAdmin = isAllowlistedAdminEmail(userEmail)

  if (!isAdmin) {
    return reply.code(403).send({
      error: 'Forbidden',
      code: 'ADMIN_UNAUTHORIZED',
    })
  }

  // ⚠️ V63 · S-5 — an admin email on an unexpected network is still a stolen
  // session. The refusal names the policy, never the configured list, so a
  // probe cannot learn which ranges are allowed.
  const ipRefusal = await adminIpAllowlistService.enforce({
    path: pathOf(request),
    email: userEmail,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    breakGlassEmail: breakGlassEmail(),
  })

  if (ipRefusal) {
    return reply.code(403).send(ipRefusal)
  }
}
