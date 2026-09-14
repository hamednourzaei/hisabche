// ============================================
// backend/src/routes/branch.routes.ts
//
// Registered with prefix '/api/branches' in index.ts.
//
// Creating and renaming branches, and pinning members to them. Which branch a
// REQUEST acts in is not set here — it travels on the `x-branch-id` header and
// is verified per request, the same way the workspace is.
// ============================================

import { sendFailure } from '../errors/http-failure'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { BranchService } from '../services/branch'
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
  /** G2 — the employee who runs it. Optional: a branch starts with nobody named. */
  managerEmployeeId: z.string().uuid().nullable().optional(),
})

const updateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(120).optional(),
  parentBranchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  /** G2. null clears the manager; omitting it leaves the current one. */
  managerEmployeeId: z.string().uuid().nullable().optional(),
})

const assignSchema = z.object({
  userId: z.string().uuid(),
  /** Empty means UNRESTRICTED — the member sees every branch. */
  branchIds: z.array(z.string().uuid()),
})

export async function branchRoutes(fastify: FastifyInstance) {
  const branchService = new BranchService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) =>
    sendFailure(reply, fastify.log, err, fallback)

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

  // ─── GET /tree ─────────────────────────────────────────
  //
  // G2 — the branch tree with its people, for the «شعب» tab.
  //
  // ⚠️ Registered BEFORE any `/:id` route in this file, or Fastify would be
  // free to read "tree" as a branch id — the same ordering trap the ledger
  // route documents in transaction.routes.ts.
  //
  // Same capability as GET /: reading the org chart is reading the org chart.
  // Editing it needs `workspace.manage`, which the POST below requires.
  fastify.get(
    '/tree',
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
        return reply.send({ tree: await branchService.tree(request.tenancy) })
      } catch (err) {
        return fail(reply, err, 'Failed to build the branch tree')
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
