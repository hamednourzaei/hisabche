// ============================================
// backend/src/middleware/platform-admin.middleware.ts
// Platform admin authorization guard for backend API.
// Reuses ADMIN_ALLOWED_EMAILS from environment.
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'

const ADMIN_ALLOWED_EMAILS = (() => {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
})()

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
  const isAdmin = ADMIN_ALLOWED_EMAILS.includes(userEmail)

  if (!isAdmin) {
    return reply.code(403).send({
      error: 'Forbidden',
      code: 'ADMIN_UNAUTHORIZED',
    })
  }
}
