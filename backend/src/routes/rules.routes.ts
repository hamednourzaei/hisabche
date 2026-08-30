// ============================================
// backend/src/routes/rules.routes.ts
//
// Registered with prefix '/api/rules' in index.ts.
//
// Writing a rule changes what happens to everyone's documents, so it needs the
// same authority as changing the chart of accounts.
//
// `POST /dry-run` exists because the alternative is finding out what a rule
// does by watching it block this week's invoices.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { RulesService } from '../services/rules'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const entitySchema = z.enum([
  'invoice',
  'payment',
  'purchase_order',
  'journal_entry',
  'customer',
  'product',
])

const conditionSchema = z.object({
  field: z.string().min(1).max(120),
  operator: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'not_in',
    'contains',
    'between',
    'is_empty',
    'is_not_empty',
  ]),
  value: z.unknown().optional(),
})

const conditionGroupSchema = z.object({
  match: z.enum(['all', 'any']),
  conditions: z.array(conditionSchema).min(1).max(20),
})

const actionSchema = z.object({
  kind: z.enum(['require_approval', 'block', 'warn', 'suggest_discount', 'notify', 'tag']),
  workflowId: z.string().uuid().optional(),
  percent: z.number().positive().max(100).optional(),
  /** A message KEY, never a sentence — the client translates it. */
  messageKey: z.string().max(120).optional(),
  value: z.string().max(120).optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(160),
  entity: entitySchema,
  conditions: conditionGroupSchema,
  actions: z.array(actionSchema).min(1).max(10),
  priority: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
  stopOnMatch: z.boolean().optional(),
})

const updateSchema = createSchema.partial().omit({ entity: true })

const dryRunSchema = z.object({
  rule: createSchema,
  facts: z.array(z.record(z.unknown())).min(1).max(200),
})

export async function rulesRoutes(fastify: FastifyInstance) {
  const rulesService = new RulesService()

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
        const { entity } = request.query as { entity?: string }
        return reply.send(
          await rulesService.list(request.tenancy, entity ? entitySchema.parse(entity) : undefined),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch business rules')
      }
    },
  )

  fastify.get(
    '/:id',
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
        const { id } = request.params as { id: string }
        return reply.send(await rulesService.get(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch business rule')
      }
    },
  )

  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('account.manage')],
      schema: { body: toJsonSchema(createSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createSchema.parse(request.body)
        return reply.code(201).send(await rulesService.create(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to create business rule')
      }
    },
  )

  fastify.patch(
    '/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('account.manage')],
      schema: { body: toJsonSchema(updateSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = updateSchema.parse(request.body)
        return reply.send(await rulesService.update(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to update business rule')
      }
    },
  )

  // ─── POST /dry-run ─────────────────────────────────────
  // What this rule WOULD have decided, against facts the caller supplies.
  // Changes nothing and stores nothing.
  fastify.post(
    '/dry-run',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('account.manage')],
      schema: { body: toJsonSchema(dryRunSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { rule, facts } = dryRunSchema.parse(request.body)
        return reply.send(await rulesService.dryRun(request.tenancy, rule, facts))
      } catch (err) {
        return fail(reply, err, 'Failed to dry-run the rule')
      }
    },
  )

  // ─── POST /evaluate ────────────────────────────────────
  // What the SAVED rules say about these facts. Still decides nothing — the
  // caller acts, or does not.
  fastify.post(
    '/evaluate',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: {
        body: toJsonSchema(z.object({ entity: entitySchema, facts: z.record(z.unknown()) })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { entity, facts } = z
          .object({ entity: entitySchema, facts: z.record(z.unknown()) })
          .parse(request.body)

        return reply.send(await rulesService.evaluate(request.tenancy, entity, facts))
      } catch (err) {
        return fail(reply, err, 'Failed to evaluate the rules')
      }
    },
  )
}
