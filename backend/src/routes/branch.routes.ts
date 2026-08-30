// ============================================
// backend/src/routes/branch.routes.ts
//
// Registered with prefix '/api/branches' in index.ts.
//
// Creating and renaming branches, and pinning members to them. Which branch a
// REQUEST acts in is not set here — it travels on the `x-branch-id` header and
// is verified per request, the same way the workspace is.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { BranchService } from '../services/branch'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  parentBranchId: z.string().uuid().optional(),
})

const updateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(120).optional(),
  parentBranchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

const assignSchema = z.object({
  userId: z.string().uuid(),
  /** Empty means UNRESTRICTED — the member sees every branch. */
  branchIds: z.array(z.string().uuid()),
})

export async function branchRoutes(fastify: FastifyInstance) {
  const branchService = new BranchService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── GET / ─────────────────────────────────────────────
  fastify.get(
    '/',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [all, scope] = await Promise.all([
          branchService.list(request.tenancy),
          branchService.scopeFor(request.tenancy),
        ])

        // A member pinned to one shop is shown that shop, not the whole chain.
        const visible =
          scope.kind === 'limited' ? all.filter((b) => scope.branchIds.includes(b.id)) : all

        return reply.send({ branches: visible, scope })
      } catch (err) {
        return fail(reply, err, 'Failed to fetch branches')
      }
    },
  )

  // ─── POST / ────────────────────────────────────────────
  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
      schema: {
        body: toJsonSchema(createSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createSchema.parse(request.body)
        return reply.code(201).send(await branchService.create(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to create branch')
      }
    },
  )

  // ─── PATCH /:id ────────────────────────────────────────
  fastify.patch(
    '/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
      schema: {
        body: toJsonSchema(updateSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = updateSchema.parse(request.body)
        return reply.send(await branchService.update(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to update branch')
      }
    },
  )

  // ─── PUT /assignments ──────────────────────────────────
  fastify.put(
    '/assignments',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('member.manage')],
      schema: {
        body: toJsonSchema(assignSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId, branchIds } = assignSchema.parse(request.body)
        return reply.send(await branchService.assignMember(request.tenancy, userId, branchIds))
      } catch (err) {
        return fail(reply, err, 'Failed to assign branches')
      }
    },
  )
}
