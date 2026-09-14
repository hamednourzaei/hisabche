// ============================================
// backend/src/routes/permission.routes.ts
// ============================================

import { sendFailure } from '../errors/http-failure'
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
import { permissionMatrix } from '../services/authorization/permission-matrix.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// ─── G3 — Permission Matrix ─────────────────────────────────────────────────

const setCellSchema = z.object({
  roleId: z.string().uuid(),
  moduleKey: z.string().min(1).max(40),
  level: z.enum(['none', 'read', 'write', 'full']),
})

const assignProfileSchema = z.object({
  /**
   * A USER id, not an employee id. Grants live in `user_roles`, which is about
   * someone who signs in — see the header of permission-matrix.service.ts.
   */
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  /** Clear the person's other profile roles first. Their base role is kept. */
  replaceExisting: z.boolean().optional(),
})

export async function permissionRoutes(fastify: FastifyInstance) {
  const permissionService = new PermissionService()

  /**
   * Domain refusals carry a CODE the client translates — PERMISSION_MATRIX_
   * FORBIDDEN, PERMISSION_CATALOGUE_INCOMPLETE. Passing them through as a 500
   * would turn "the migration has not run" into "something went wrong".
   */
  const failMatrix = (reply: FastifyReply, err: unknown, fallback: string) =>
    sendFailure(reply, fastify.log, err, fallback)

  // ═══════════════════════════════════════════════════════════
  // PERMISSIONS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/permissions ─────────────────────────────────
  fastify.get(
    '/api/permissions',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 300, keyPrefix: 'permissions' }),
      ],
      schema: {
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const permissions = await permissionService.listPermissions()
        return reply.send(permissions)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch permissions' })
      }
    },
  )

  // ─── POST /api/permissions/seed ───────────────────────────
  fastify.post(
    '/api/permissions/seed',
    {
      preHandler: [authenticate],
      schema: {
        response: { 200: toJsonSchema(z.object({ success: z.boolean() })) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await permissionService.seedDefaultPermissions()
        await clearCache('permissions:*')
        return reply.send({ success: true })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to seed permissions' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // ROLES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/roles ───────────────────────────────────────
  fastify.get(
    '/api/roles',
    {
      preHandler: [authenticate, cacheMiddleware({ scope: 'user', ttl: 120, keyPrefix: 'roles' })],
      schema: {
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const roles = await permissionService.listRoles()
        return reply.send(roles)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch roles' })
      }
    },
  )

  // ─── POST /api/roles ──────────────────────────────────────
  fastify.post(
    '/api/roles',
    {
      preHandler: [authenticate],
      schema: {
        body: toJsonSchema(createRoleSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createRoleSchema.parse(request.body)
        const role = await permissionService.createRole(data)
        await clearCache('roles:*')
        return reply.code(201).send(role)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create role' })
      }
    },
  )

  // ─── GET /api/roles/:id ───────────────────────────────────
  fastify.get(
    '/api/roles/:id',
    {
      preHandler: [authenticate, cacheMiddleware({ scope: 'user', ttl: 120, keyPrefix: 'role' })],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const role = await permissionService.getRole(id)
        return reply.send(role)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch role' })
      }
    },
  )

  // ─── PATCH /api/roles/:id ─────────────────────────────────
  fastify.patch(
    '/api/roles/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateRoleSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateRoleSchema.parse(request.body)
        const role = await permissionService.updateRole(id, data)
        await clearCache(`role:${id}`)
        await clearCache('roles:*')
        return reply.send(role)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update role' })
      }
    },
  )

  // ─── DELETE /api/roles/:id ────────────────────────────────
  fastify.delete(
    '/api/roles/:id',
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const result = await permissionService.deleteRole(id)
        await clearCache(`role:${id}`)
        await clearCache('roles:*')
        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to delete role' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // USER ROLES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/users/:userId/roles ─────────────────────────
  fastify.get(
    '/api/users/:userId/roles',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'user-roles' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ userId: z.string().uuid() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string }
        const roles = await permissionService.getUserRoles(userId)
        return reply.send(roles)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch user roles' })
      }
    },
  )

  // ─── POST /api/users/:userId/roles ────────────────────────
  fastify.post(
    '/api/users/:userId/roles',
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ userId: z.string().uuid() })),
        body: toJsonSchema(assignRoleSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = assignRoleSchema.parse(request.body)
        const result = await permissionService.assignRole(data)
        await clearCache(`user-roles:${data.userId}:*`)
        await clearCache(`user-permissions:${data.userId}:*`)
        return reply.code(201).send(result)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to assign role' })
      }
    },
  )

  // ─── DELETE /api/users/:userId/roles/:roleId ──────────────
  fastify.delete(
    '/api/users/:userId/roles/:roleId',
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ userId: z.string().uuid(), roleId: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId, roleId } = request.params as { userId: string; roleId: string }
        const result = await permissionService.removeRole({ userId, roleId })
        await clearCache(`user-roles:${userId}:*`)
        await clearCache(`user-permissions:${userId}:*`)
        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to remove role' })
      }
    },
  )

  // ─── GET /api/users/:userId/permissions ───────────────────
  fastify.get(
    '/api/users/:userId/permissions',
    {
      // ⚠️ PHASE E — requireWorkspaceContext added. A permission set is
      // meaningless without naming the workspace it applies in, and the
      // service now refuses to answer without one.
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'user-permissions' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ userId: z.string().uuid() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string }
        const permissions = await permissionService.getUserPermissions(
          request.tenancy.workspaceId,
          userId,
        )
        return reply.send(permissions)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch user permissions' })
      }
    },
  )

  // ─── POST /api/permissions/check ──────────────────────────
  fastify.post(
    '/api/permissions/check',
    {
      // ⚠️ PHASE E — see below. The workspace is taken from the verified
      // context, never from the body.
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 30, keyPrefix: 'permission-check' }),
      ],
      schema: {
        body: toJsonSchema(
          z.object({
            userId: z.string().uuid(),
            permissionCode: z.string().min(1),
          }),
        ),
        response: { 200: toJsonSchema(z.object({ hasPermission: z.boolean() })) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId, permissionCode } = request.body as {
          userId: string
          permissionCode: string
        }
        // The answer is scoped to the workspace this request established, not
        // to whatever the caller's other memberships happen to grant.
        const hasPermission = await permissionService.hasPermission(
          request.tenancy.workspaceId,
          userId,
          permissionCode,
        )
        return reply.send({ hasPermission })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to check permission' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════════════════
  // G3 — the Permission Matrix
  //
  // Workspace-scoped, unlike the older /api/roles routes above, which predate
  // roles having a workspace at all. These three are the ones the matrix
  // screen uses; the older ones are left alone rather than rewritten.
  // ═══════════════════════════════════════════════════════════════════════

  // ─── GET /api/permissions/matrix ────────────────────────
  fastify.get(
    '/api/permissions/matrix',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        // Reading who can do what is reading the org chart. Changing it needs
        // member.manage, which the mutations below require.
        requireCapability('member.manage'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await permissionMatrix.matrix(request.tenancy))
      } catch (err) {
        return failMatrix(reply, err, 'Failed to build the permission matrix')
      }
    },
  )

  // ─── PUT /api/permissions/matrix/cell ───────────────────
  fastify.put(
    '/api/permissions/matrix/cell',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('member.manage')],
      schema: {
        body: toJsonSchema(setCellSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = setCellSchema.parse(request.body)
        return reply.send(await permissionMatrix.setCell(request.tenancy, body))
      } catch (err) {
        return failMatrix(reply, err, 'Failed to change the permission')
      }
    },
  )

  // ─── POST /api/permissions/profiles/assign ──────────────
  fastify.post(
    '/api/permissions/profiles/assign',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('member.manage')],
      schema: {
        body: toJsonSchema(assignProfileSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = assignProfileSchema.parse(request.body)
        return reply.send(await permissionMatrix.assignProfile(request.tenancy, body))
      } catch (err) {
        return failMatrix(reply, err, 'Failed to assign the profile')
      }
    },
  )

  // ─── GET /api/permissions/roles/:roleId/members ─────────
  // H5 will link a matrix column to the people who hold it.
  fastify.get(
    '/api/permissions/roles/:roleId/members',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('member.manage')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { roleId } = request.params as { roleId: string }
        return reply.send({
          members: await permissionMatrix.membersOfRole(request.tenancy, roleId),
        })
      } catch (err) {
        return failMatrix(reply, err, 'Failed to fetch role members')
      }
    },
  )
}
