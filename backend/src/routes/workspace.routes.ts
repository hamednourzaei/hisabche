// ============================================
// backend/src/routes/workspace.routes.ts
// ============================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateMemberRoleSchema,
  createInviteSchema,
  acceptInviteSchema,
  createMemberDirectBodySchema,
  setMemberSuspensionSchema,
} from '@hisabche/validation'
import { WorkspaceService } from '../services/workspace.service'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const r = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete r.$schema
  return r
}

export async function workspaceRoutes(fastify: FastifyInstance) {
  const svc = new WorkspaceService()

  fastify.get(
    '/api/workspaces',
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'workspaces' })],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.getMyWorkspaces(req.userId))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(createWorkspaceSchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.createWorkspace(req.userId, createWorkspaceSchema.parse(req.body))
        await clearCache('workspaces:*')
        return reply.code(201).send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.get(
    '/api/workspaces/:id',
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'workspace' })],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.getWorkspace(req.userId, (req.params as any).id))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  // ⚠️ FIX: `updateWorkspaceSchema` is `workspaceSchema.partial().extend({ id })`,
  // so it makes `id` REQUIRED IN THE BODY. But the id lives in the URL — the
  // client correctly sends only the changed fields, and Fastify rejected every
  // request with "body must have required property 'id'". That broke both the
  // profile edit form and the logo/stamp upload.
  //
  // The id is omitted from the body contract here (the same pattern this file
  // already uses for `createInviteSchema.omit({ workspaceId: true })`), and the
  // path param stays the single source of which workspace is being updated —
  // so a body id can never disagree with the URL.
  const updateWorkspaceBodySchema = updateWorkspaceSchema.omit({ id: true })

  fastify.patch(
    '/api/workspaces/:id',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(updateWorkspaceBodySchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.updateWorkspace(
          req.userId,
          (req.params as any).id,
          updateWorkspaceBodySchema.parse(req.body),
        )
        await clearCache(`workspace:${(req.params as any).id}`)
        await clearCache('workspaces:*')
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.get(
    '/api/workspaces/:id/members',
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'workspace-members' })],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.listMembers(req.userId, (req.params as any).id))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.patch(
    '/api/workspaces/:id/members/role',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(updateMemberRoleSchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.updateMemberRole(
          req.userId,
          (req.params as any).id,
          updateMemberRoleSchema.parse(req.body),
        )
        await clearCache(`workspace-members:${(req.params as any).id}:*`)
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.delete(
    '/api/workspaces/:id/members/:memberId',
    {
      preHandler: [authenticate],
    },
    async (req, reply) => {
      try {
        const { id, memberId } = req.params as any
        const result = await svc.removeMember(req.userId, id, memberId)
        await clearCache(`workspace-members:${id}:*`)
        return reply.send(result)
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/:id/leave',
    {
      preHandler: [authenticate],
    },
    async (req, reply) => {
      try {
        const result = await svc.leaveWorkspace(req.userId, (req.params as any).id)
        await clearCache(`workspace-members:${(req.params as any).id}:*`)
        await clearCache('workspaces:*')
        return reply.send(result)
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.get(
    '/api/workspaces/:id/invites',
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'workspace-invites' })],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.listInvites(req.userId, (req.params as any).id))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/:id/invites',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(createInviteSchema.omit({ workspaceId: true })) },
    },
    async (req, reply) => {
      try {
        const { id } = req.params as any
        const data = createInviteSchema.omit({ workspaceId: true }).parse(req.body)
        const invite = await svc.createInvite(req.userId, { ...data, workspaceId: id })
        console.log('[route] createInvite result:', invite)
        await clearCache(`workspace-invites:${id}:*`)
        return reply.code(201).send(invite)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed to create invite' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/accept-invite',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(acceptInviteSchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.acceptInvite(
          req.userId,
          (req.user as any)?.email || '',
          acceptInviteSchema.parse(req.body),
        )
        await clearCache('workspaces:*')
        await clearCache('workspace-members:*')
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        const clientErrors = [
          'Invalid or expired invite',
          'Invite already used or cancelled',
          'Wrong email',
          'Expired',
          'Workspace inactive',
          'Already member',
        ]
        if (e instanceof Error && clientErrors.includes(e.message)) {
          return reply.code(400).send({ error: e.message })
        }
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/:id/members/direct',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(createMemberDirectBodySchema) },
    },
    async (req, reply) => {
      try {
        const { id } = req.params as any
        const data = createMemberDirectBodySchema.parse(req.body)
        const result = await svc.createMemberDirect(req.userId, id, { ...data, workspaceId: id })
        await clearCache(`workspace-members:${id}:*`)
        return reply.code(201).send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        const clientErrors = [
          'Insufficient permissions',
          'Email already registered',
          'Access denied',
        ]
        if (e instanceof Error && clientErrors.includes(e.message)) {
          return reply.code(400).send({ error: e.message })
        }
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed to create member' })
      }
    },
  )

  // Suspending keeps the member row, its payroll history and its attribution
  // on past records; only sign-in stops. Deleting the member is the separate,
  // irreversible action.
  fastify.patch(
    '/api/workspaces/:id/members/suspension',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(setMemberSuspensionSchema) },
    },
    async (req, reply) => {
      try {
        const { id } = req.params as any
        const { memberId, suspended } = setMemberSuspensionSchema.parse(req.body)
        const result = await svc.setMemberSuspension(req.userId, id, memberId, suspended)
        await clearCache(`workspace-members:${id}:*`)
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        const clientErrors = [
          'Insufficient permissions',
          'Access denied',
          'You cannot suspend your own account',
        ]
        if (e instanceof Error && clientErrors.includes(e.message)) {
          return reply.code(400).send({ error: e.message })
        }
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed to update member suspension' })
      }
    },
  )

  fastify.delete(
    '/api/workspaces/:id/invites/:inviteId',
    {
      preHandler: [authenticate],
    },
    async (req, reply) => {
      try {
        const { id, inviteId } = req.params as any
        const result = await svc.cancelInvite(req.userId, id, inviteId)
        await clearCache(`workspace-invites:${id}:*`)
        return reply.send(result)
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )
}
