// ============================================
// backend/src/routes/manufacturing.routes.ts
//
// One manufacturing domain, several entry points. The manufacturing page, the
// product page and the reports all call the SAME service methods below — there
// is no second place a production cost is computed.
//
//   reads    inventory.read   (seller and up)
//   writes   product.write    (manager and up) — saving a definition, planning
//                             an order, recording a run, overriding a total
//
// ⚠️ Bodies are parsed in the handler (`schema.parse`), not declared as a route
// schema: `zodToJsonSchema` over the grid's column/row types sinks tsc in
// TS2589, and a JSON schema would also strip the columns' pass-through fields.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createWorkOrderSchema,
  produceSchema,
  saveProductionDefinitionSchema,
  updateWorkOrderSchema,
} from '@hisabche/validation'
import { ManufacturingService } from '../services/manufacturing.service'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { clearCache } from '../middleware/cache.middleware'

const READ = [authenticate, requireWorkspaceContext, requireCapability('inventory.read')]
const WRITE = [authenticate, requireWorkspaceContext, requireCapability('product.write')]

const uuid = z.string().uuid()
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** A planned order: the product and how many. The definition is optional. */
const planWorkOrderSchema = createWorkOrderSchema.extend({ bomId: uuid.optional() })

/**
 * One answer shape for every refusal: the status says what kind, `message`
 * carries the code the screen translates, and a schema rejection names the
 * field (`details[].path`) so the form can point at it.
 */
function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && err.statusCode < 500) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  if (err instanceof BaseError && err.statusCode === 503) {
    return reply.code(503).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function manufacturingRoutes(fastify: FastifyInstance) {
  const manufacturingService = new ManufacturingService()

  // ─── Definitions ─────────────────────────────────────────────

  // Every definition (the list on the manufacturing page).
  fastify.get('/api/boms', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      const { productId } = z.object({ productId: uuid.optional() }).parse(request.query)
      return reply.send(await manufacturingService.listBoms(request.tenancy, productId))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to fetch BOMs')
    }
  })

  // One product's active definition, shaped for the editor. 200 with
  // `definition: null` when the product has none — «not defined yet» is an
  // answer, not an error.
  fastify.get(
    '/api/manufacturing/definitions/:productId',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { productId } = z.object({ productId: uuid }).parse(request.params)
        const definition = await manufacturingService.getDefinition(request.tenancy, productId)
        return reply.send({ definition })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to fetch the production definition')
      }
    },
  )

  fastify.put(
    '/api/manufacturing/definitions',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const input = saveProductionDefinitionSchema.parse(request.body)
        const saved = await manufacturingService.saveDefinition(request.tenancy, input)
        await clearCache('boms:*')
        return reply.send(saved)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the production definition')
      }
    },
  )

  // ─── Production ──────────────────────────────────────────────

  // Record a run. Idempotent on `idempotencyKey`.
  fastify.post(
    '/api/manufacturing/produce',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const input = produceSchema.parse(request.body)
        const result = await manufacturingService.produce(request.tenancy, input)
        await clearCache('boms:*')
        await clearCache('work-orders:*')
        return reply.code(result.status === 'completed' ? 201 : 200).send(result)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to record the production run')
      }
    },
  )

  // History: completed runs, a page at a time.
  fastify.get(
    '/api/manufacturing/runs',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const query = z
          .object({
            productId: uuid.optional(),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
          })
          .parse(request.query)
        return reply.send(await manufacturingService.listRuns(request.tenancy, query))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to fetch production history')
      }
    },
  )

  fastify.get(
    '/api/manufacturing/runs/:id',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = z.object({ id: uuid }).parse(request.params)
        return reply.send(await manufacturingService.getRun(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to fetch the production run')
      }
    },
  )

  // ─── Reporting ───────────────────────────────────────────────

  fastify.get(
    '/api/manufacturing/report',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const query = z
          .object({ from: isoDay, to: isoDay, productId: uuid.optional() })
          .refine((value) => value.from <= value.to, { message: 'manufacturing.errors.range' })
          .parse(request.query)
        return reply.send(await manufacturingService.report(request.tenancy, query))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to build the manufacturing report')
      }
    },
  )

  // ─── Planned orders ──────────────────────────────────────────

  fastify.get('/api/work-orders', { preHandler: READ }, async (request: FastifyRequest, reply) => {
    try {
      const { status } = z
        .object({ status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional() })
        .parse(request.query)
      return reply.send(await manufacturingService.listWorkOrders(request.tenancy, status))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to fetch work orders')
    }
  })

  fastify.post(
    '/api/work-orders',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const data = planWorkOrderSchema.parse(request.body)
        const workOrder = await manufacturingService.createWorkOrder(request.tenancy, data)
        await clearCache('work-orders:*')
        return reply.code(201).send(workOrder)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to create work order')
      }
    },
  )

  // Reschedule or cancel a planned order. It cannot COMPLETE one — that is
  // POST /api/manufacturing/produce with `workOrderId`.
  fastify.patch(
    '/api/work-orders/:id',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = z.object({ id: uuid }).parse(request.params)
        const data = updateWorkOrderSchema.omit({ id: true }).parse(request.body)
        const workOrder = await manufacturingService.updateWorkOrder(request.tenancy, id, data)
        await clearCache('work-orders:*')
        return reply.send(workOrder)
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update work order')
      }
    },
  )
}
