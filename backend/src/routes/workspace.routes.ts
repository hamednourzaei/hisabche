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
} from '@hisabche/validation'
import { WorkspaceService } from '../services/workspace.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function workspaceRoutes(fastify: FastifyInstance) {
  const workspaceService = new WorkspaceService()

  // WORKSPACES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/workspaces ──────────────────────────
  fastify.get('/api/workspaces', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const workspaces = await workspaceService.getMyWorkspaces(request.userId)
      return reply.send(workspaces)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch workspaces' })
    }
  })

  // ─── POST /api/workspaces ─────────────────────────────────
  fastify.post('/api/workspaces', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createWorkspaceSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createWorkspaceSchema.parse(request.body)
      const workspace = await workspaceService.createWorkspace(request.userId, data)
      return reply.code(201).send(workspace)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create workspace' })
    }
  })

  // ─── GET /api/workspaces/:id ──────────────────────────────
  fastify.get('/api/workspaces/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const workspace = await workspaceService.getWorkspace(request.userId, id)
      return reply.send(workspace)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch workspace' })
    }
  })

  // ─── PATCH /api/workspaces/:id ────────────────────────────
  fastify.patch('/api/workspaces/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateWorkspaceSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateWorkspaceSchema.parse(request.body)
      const workspace = await workspaceService.updateWorkspace(request.userId, id, data)
      return reply.send(workspace)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update workspace' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // MEMBERS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/workspaces/:id/members ──────────────────────
  fastify.get('/api/workspaces/:id/members', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const members = await workspaceService.listMembers(request.userId, id)
      return reply.send(members)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch members' })
    }
  })

  // ─── PATCH /api/workspaces/:id/members/role ───────────────
  fastify.patch('/api/workspaces/:id/members/role', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateMemberRoleSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateMemberRoleSchema.parse(request.body)
      const result = await workspaceService.updateMemberRole(request.userId, id, data)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update member role' })
    }
  })

  // ─── DELETE /api/workspaces/:id/members/:memberId ─────────
  fastify.delete('/api/workspaces/:id/members/:memberId', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid(), memberId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, memberId } = request.params as { id: string; memberId: string }
      const result = await workspaceService.removeMember(request.userId, id, memberId)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to remove member' })
    }
  })

  // ─── POST /api/workspaces/:id/leave ───────────────────────
  fastify.post('/api/workspaces/:id/leave', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await workspaceService.leaveWorkspace(request.userId, id)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to leave workspace' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // INVITES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/workspaces/:id/invites ──────────────────────
  fastify.get('/api/workspaces/:id/invites', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const invites = await workspaceService.listInvites(request.userId, id)
      return reply.send(invites)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch invites' })
    }
  })

 // ─── POST /api/workspaces/:id/invites ─────────────────────
fastify.post('/api/workspaces/:id/invites', {
  preHandler: [authenticate],
  schema: {
    params: toJsonSchema(z.object({ id: z.string().uuid() })),
    body: toJsonSchema(createInviteSchema.omit({ workspaceId: true })),
    response: { 201: toJsonSchema(z.any()) },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const data = createInviteSchema.omit({ workspaceId: true }).parse(request.body);
    const invite = await workspaceService.createInvite(request.userId, {
      ...data,
      workspaceId: id,
    });
    return reply.code(201).send(invite);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Failed to create invite' })
  }
})

  // ─── POST /api/workspaces/accept-invite ───────────────────
  fastify.post('/api/workspaces/accept-invite', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(acceptInviteSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = acceptInviteSchema.parse(request.body)
      const result = await workspaceService.acceptInvite(request.userId, data)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to accept invite' })
    }
  })

  // ─── DELETE /api/workspaces/:id/invites/:inviteId ─────────
  fastify.delete('/api/workspaces/:id/invites/:inviteId', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid(), inviteId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, inviteId } = request.params as { id: string; inviteId: string }
      const result = await workspaceService.cancelInvite(request.userId, id, inviteId)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to cancel invite' })
    }
  })
}