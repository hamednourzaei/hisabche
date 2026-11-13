// ============================================
// backend/src/routes/admin-secrets.routes.ts
//
// V63 · S-3 — the console's ONLY view of platform secrets.
//
//   GET  /api/admin/secrets          metadata (name, purpose, last4, rotation)
//   POST /api/admin/secrets/:name    stage a rotation (maker-checker, step-up)
//
// ⚠️ THERE IS NO ROUTE THAT RETURNS A VALUE.
//
// Not a masked one, not a prefix, not «show once». A rotation is staged into
// Vault and applied when a DIFFERENT admin approves the request through
// `/api/admin/billing/action-requests/:id/decide`. This keeps one approval
// flow (§2 «one of everything») and means a compromised admin session cannot
// change where customer money or the AI bill goes on its own.
//
// The reader is named `security.secrets.read` but reads METADATA only; the
// permission name is kept explicit so a role audit is honest about it.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { adminRoute } from '../middleware/admin-rbac.middleware'
import { listSecrets, stageSecret } from '../services/secrets/secret-store'

const nameParam = z.object({
  // The same shape `platform_secrets.name` enforces in the database.
  name: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
})

const stageBody = z.object({
  value: z.string().min(8).max(4096),
  purpose: z.string().max(200).optional(),
})

function statusOf(err: unknown): number {
  if (err instanceof BaseError) return err.statusCode
  return 500
}

function payloadOf(err: unknown): { error: string; code: string } {
  if (err instanceof BaseError) return { error: err.message, code: 'ERROR' }
  return { error: 'Failed to handle the secret request', code: 'ERROR' }
}

export default async function adminSecretsRoutes(fastify: FastifyInstance): Promise<void> {
  const read = adminRoute('security.secrets.read')
  const write = adminRoute('security.secrets.write', { stepUp: true })

  fastify.get('/api/admin/secrets', { preHandler: read }, async (_request, reply) => {
    try {
      return reply.send({ secrets: await listSecrets() })
    } catch (err) {
      return reply.code(statusOf(err)).send(payloadOf(err))
    }
  })

  fastify.post(
    '/api/admin/secrets/:name',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { name } = nameParam.parse(request.params)
        const body = stageBody.parse(request.body)

        const staged = await stageSecret({
          name,
          value: body.value,
          purpose: body.purpose ?? '',
          actorId: request.userId,
          actorEmail: request.user?.email ?? 'admin',
        })

        // The response says what is waiting, never what it is.
        return reply.code(202).send({
          ok: true,
          name: staged.name,
          last4: staged.last4,
          requestId: staged.requestId,
          status: 'PENDING_APPROVAL',
        })
      } catch (err) {
        return reply.code(statusOf(err)).send(payloadOf(err))
      }
    },
  )
}
