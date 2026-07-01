// ============================================
// backend/src/routes/permission.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
  removeRoleSchema,
} from '@hisabche/validation'
import { PermissionService } from '../services/permission.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function permissionRoutes(fastify: FastifyInstance) {
  const permissionService = new PermissionService()

  // ═══════════════════════════════════════════════════════════
  // PERMISSIONS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/permissions ─────────────────────────────────
  fastify.get('/api/permissions', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const permissions = await permissionService.listPermissions()
      return reply.send(permissions)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch permissions' })
    }
  })

  // ─── POST /api/permissions/seed ───────────────────────────
  fastify.post('/api/permissions/seed', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.object({ success: z.boolean() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await permissionService.seedDefaultPermissions()
      return reply.send({ success: true })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to seed permissions' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/roles ───────────────────────────────────────
  fastify.get('/api/roles', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roles = await permissionService.listRoles()
      return reply.send(roles)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch roles' })
    }
  })

  // ─── POST /api/roles ──────────────────────────────────────
  fastify.post('/api/roles', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createRoleSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createRoleSchema.parse(request.body)
      const role = await permissionService.createRole(data)
      return reply.code(201).send(role)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create role' })
    }
  })

  // ─── GET /api/roles/:id ───────────────────────────────────
  fastify.get('/api/roles/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const role = await permissionService.getRole(id)
      return reply.send(role)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch role' })
    }
  })

  // ─── PATCH /api/roles/:id ─────────────────────────────────
  fastify.patch('/api/roles/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateRoleSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateRoleSchema.parse(request.body)
      const role = await permissionService.updateRole(id, data)
      return reply.send(role)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update role' })
    }
  })

  // ─── DELETE /api/roles/:id ────────────────────────────────
  fastify.delete('/api/roles/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await permissionService.deleteRole(id)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete role' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // USER ROLES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/users/:userId/roles ─────────────────────────
  fastify.get('/api/users/:userId/roles', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ userId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.params as { userId: string }
      const roles = await permissionService.getUserRoles(userId)
      return reply.send(roles)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch user roles' })
    }
  })

  // ─── POST /api/users/:userId/roles ────────────────────────
  fastify.post('/api/users/:userId/roles', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ userId: z.string().uuid() })),
      body: toJsonSchema(assignRoleSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = assignRoleSchema.parse(request.body)
      const result = await permissionService.assignRole(data)
      return reply.code(201).send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to assign role' })
    }
  })

  // ─── DELETE /api/users/:userId/roles/:roleId ──────────────
  fastify.delete('/api/users/:userId/roles/:roleId', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ userId: z.string().uuid(), roleId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, roleId } = request.params as { userId: string; roleId: string }
      const result = await permissionService.removeRole({ userId, roleId })
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to remove role' })
    }
  })

  // ─── GET /api/users/:userId/permissions ───────────────────
  fastify.get('/api/users/:userId/permissions', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ userId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.params as { userId: string }
      const permissions = await permissionService.getUserPermissions(userId)
      return reply.send(permissions)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch user permissions' })
    }
  })

  // ─── POST /api/permissions/check ──────────────────────────
  fastify.post('/api/permissions/check', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(z.object({
        userId: z.string().uuid(),
        permissionCode: z.string().min(1),
      })),
      response: { 200: toJsonSchema(z.object({ hasPermission: z.boolean() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId, permissionCode } = request.body as { userId: string; permissionCode: string }
      const hasPermission = await permissionService.hasPermission(userId, permissionCode)
      return reply.send({ hasPermission })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to check permission' })
    }
  })
}