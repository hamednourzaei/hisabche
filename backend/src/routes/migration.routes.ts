// ============================================
// backend/src/routes/migration.routes.ts
//
// Registered with prefix '/api/migrations' in index.ts.
//
// ---------------------------------------------------------------------------
// THE GUARD ORDER IS LOAD-BEARING
//
//   authenticate → requireWorkspaceContext → requireCapability('data.import')
//
// `requireWorkspaceContext` is what builds `request.tenancy`. Every handler
// reads the workspace from there and never from `request.userId` /
// `request.userRole`, which are empty for a user who belongs to more than one
// workspace — the bug that once made invoice approval do nothing at all.
//
// ---------------------------------------------------------------------------
// WHY THE FILE ARRIVES AS TEXT IN A JSON BODY
//
// No multipart, no temporary file, no storage bucket. The client decodes the
// file to UTF-8 text and posts it; the server parses it inside the request and
// throws the text away. There is nothing on disk to quarantine, expire, or
// serve back by accident, and the size ceiling is enforced on the decoded
// string rather than on a Content-Length header the sender chose.
//
// The cost is honest and stated in the UI: only text formats, and only files
// that fit in memory. A dump restore or an xlsx would need real isolation, and
// offering it before that exists is the fake-import the directive forbids.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import {
  MigrationService,
  INTAKE_LIMITS,
  MIGRATION_ENTITIES,
  MIGRATION_SOURCE_TYPES,
} from '../services/migration'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// `maxBytes` is a byte count and this is a character count, so the character
// cap is deliberately the looser of the two — the exact byte check runs in the
// domain, on the decoded text, where multi-byte Persian text is measured
// correctly. This bound exists to stop a 400 MB body being buffered at all.
const contentSchema = z.string().min(1).max(INTAKE_LIMITS.maxBytes)

const createSchema = z.object({
  entity: z.enum(MIGRATION_ENTITIES),
  sourceType: z.enum(MIGRATION_SOURCE_TYPES),
  filename: z.string().min(1).max(260),
  content: contentSchema,
})

const mappingSchema = z.object({
  mapping: z.record(z.string(), z.number().int().min(0)),
})

const profileNameSchema = z.object({ name: z.string().min(1).max(120) })
const profileIdSchema = z.object({ profileId: z.string().uuid() })
const entitySchema = z.enum(MIGRATION_ENTITIES)

const contentBodySchema = z.object({ content: contentSchema })

export async function migrationRoutes(fastify: FastifyInstance) {
  const service = new MigrationService()

  // One capability for the whole surface. Reading a migration report means
  // reading which customers and what balances were imported, so it is not a
  // softer permission than performing the import.
  const guarded = [authenticate, requireWorkspaceContext, requireCapability('data.import')]

  const fail = (reply: FastifyReply, error: unknown, fallback: string) => {
    if (error instanceof BaseError) {
      return reply.code(error.statusCode).send({ error: error.message })
    }
    fastify.log.error(error)
    return reply.code(500).send({ error: fallback })
  }

  fastify.get(
    '/',
    { preHandler: guarded, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await service.list(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch migrations')
      }
    },
  )

  fastify.get(
    '/:id',
    { preHandler: guarded, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await service.get(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the migration')
      }
    },
  )

  // Upload and scan. Returns everything the wizard needs to show step 3.
  fastify.post(
    '/',
    {
      preHandler: guarded,
      schema: { body: toJsonSchema(createSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createSchema.parse(request.body)
        return reply.code(201).send(await service.create(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to scan the file')
      }
    },
  )

  fastify.put(
    '/:id/mapping',
    {
      preHandler: guarded,
      schema: { body: toJsonSchema(mappingSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = mappingSchema.parse(request.body)
        return reply.send(await service.setMapping(request.tenancy, id, body.mapping))
      } catch (err) {
        return fail(reply, err, 'Failed to save the mapping')
      }
    },
  )

  // Validate + dry run. Mutates nothing in the business tables; the response
  // says so explicitly, because the user is about to be asked to trust it.
  fastify.post(
    '/:id/dry-run',
    {
      preHandler: guarded,
      schema: { body: toJsonSchema(contentBodySchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = contentBodySchema.parse(request.body)
        return reply.send(await service.validate(request.tenancy, id, body.content))
      } catch (err) {
        return fail(reply, err, 'Failed to simulate the import')
      }
    },
  )

  fastify.post(
    '/:id/commit',
    {
      preHandler: guarded,
      schema: { body: toJsonSchema(contentBodySchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = contentBodySchema.parse(request.body)
        return reply.send(await service.commit(request.tenancy, id, body.content))
      } catch (err) {
        return fail(reply, err, 'Failed to import the data')
      }
    },
  )

  fastify.post(
    '/:id/cancel',
    { preHandler: guarded, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await service.cancel(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to cancel the migration')
      }
    },
  )

  /* ─── §39 Rollback ──────────────────────────────────────────────────────── */

  // GET, not POST: asking what a rollback WOULD do must be free of side
  // effects, so a nervous user can look as many times as they like.
  fastify.get(
    '/:id/rollback-plan',
    { preHandler: guarded, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await service.planRollback(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to plan the rollback')
      }
    },
  )

  fastify.post(
    '/:id/rollback',
    { preHandler: guarded, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await service.rollback(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to roll back the migration')
      }
    },
  )

  /* ─── §40 Import profiles ───────────────────────────────────────────────── */

  fastify.get(
    '/profiles',
    { preHandler: guarded, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entity } = request.query as { entity?: string }
        const parsed = entitySchema.parse(entity ?? 'customer')
        return reply.send(await service.listProfiles(request.tenancy, parsed))
      } catch (err) {
        return fail(reply, err, 'Failed to read import profiles')
      }
    },
  )

  fastify.post(
    '/:id/profile',
    {
      preHandler: guarded,
      schema: { body: toJsonSchema(profileNameSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = profileNameSchema.parse(request.body)
        return reply.code(201).send(await service.saveProfile(request.tenancy, id, body.name))
      } catch (err) {
        return fail(reply, err, 'Failed to save the import profile')
      }
    },
  )

  fastify.post(
    '/:id/apply-profile',
    {
      preHandler: guarded,
      schema: { body: toJsonSchema(profileIdSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = profileIdSchema.parse(request.body)
        return reply.send(await service.useProfile(request.tenancy, id, body.profileId))
      } catch (err) {
        return fail(reply, err, 'Failed to apply the import profile')
      }
    },
  )

  /* ─── §41 Export symmetry ───────────────────────────────────────────────── */

  // text/csv rather than JSON: the point of this endpoint is a file the user
  // can keep and hand back to the importer unchanged.
  fastify.get(
    '/export',
    { preHandler: guarded },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entity } = request.query as { entity?: string }
        const parsed = entitySchema.parse(entity ?? 'customer')
        const csv = await service.exportCsv(request.tenancy, parsed)

        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', `attachment; filename="hisabche-${parsed}.csv"`)
          .send(csv)
      } catch (err) {
        return fail(reply, err, 'Failed to export')
      }
    },
  )
}
