// ============================================
// backend/src/routes/sandbox.routes.ts
//
// Anyone in a workspace         GET  /api/developer/sandbox   (which side of the line am I on?)
// Owner/manager (workspace.manage) POST /api/developer/sandbox (my sandbox of this business)
//
// ⚠️ Not open to an API key (API_ROUTE_SCOPES): a key belongs to one
// workspace and cannot mint another.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { NotConfiguredError } from '../services/developer/developer.repository'
import {
  SandboxError,
  sandboxService,
  type SandboxService,
} from '../services/developer/sandbox.service'

export function buildSandboxRoutes(sandbox: SandboxService) {
  return async function sandboxRoutes(fastify: FastifyInstance) {
    const member = [authenticate, requireWorkspaceContext]
    const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]

    const handle =
      (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request, reply)
        } catch (err) {
          if (err instanceof SandboxError)
            return reply.code(err.statusCode).send({ error: err.code, code: err.code })
          if (err instanceof NotConfiguredError) {
            return reply
              .code(503)
              .send({ error: 'SANDBOX_NOT_CONFIGURED', code: 'SANDBOX_NOT_CONFIGURED' })
          }
          fastify.log.error(err)
          return reply.code(500).send({ error: 'Internal Server Error' })
        }
      }

    fastify.get(
      '/api/developer/sandbox',
      { preHandler: member },
      handle(async (request, reply) => reply.send(await sandbox.status(request.tenancy))),
    )

    fastify.post(
      '/api/developer/sandbox',
      { preHandler: manage },
      handle(async (request, reply) => {
        const out = await sandbox.create(request.tenancy)
        return reply.code(out.created ? 201 : 200).send(out)
      }),
    )
  }
}

export const sandboxRoutes = buildSandboxRoutes(sandboxService)
