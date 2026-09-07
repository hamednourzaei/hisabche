// ============================================
// backend/src/routes/product-units.routes.ts
//
// T11 / L1 — the routes `product_units` never had.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ProductUnitsService } from '../services/inventory/product-units.service'

// route files: naming this `ZodTypeAny` makes the compiler unfold the schema
// type recursively and hit its instantiation depth limit.
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>
  delete result.$schema
  return result
}

const unitSchema = z.object({
  unitId: z.string().uuid(),
  conversionFactorToBase: z.number().positive(),
  isBaseUnit: z.boolean(),
  isPurchaseDefault: z.boolean(),
  isSaleDefault: z.boolean(),
})

const replaceSchema = z.object({
  /**
   * The WHOLE set.
   *
   * ⚠️ An empty array is valid and means «this product is single-unit again».
   * Refusing it would make the first experiment with multi-unit permanent.
   */
  units: z.array(unitSchema).max(20),
})

const paramsSchema = z.object({ productId: z.string().uuid() })

export async function productUnitsRoutes(fastify: FastifyInstance) {
  const service = new ProductUnitsService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      // The domain refuses with named codes — UNIT_SET_NO_BASE,
      // UNIT_SET_MULTIPLE_BASES — that the client translates.
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  fastify.get(
    '/api/products/:productId/units',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('product.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId } = paramsSchema.parse(request.params)
        return reply.send(await service.list(request.tenancy, productId))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch product units')
      }
    },
  )

  fastify.put(
    '/api/products/:productId/units',
    {
      // ⚠️ `inventory.configure` (owner-only), NOT `product.write`.
      //
      // Defining a product's units changes how every future quantity for it is
      // interpreted, all the way into `stock_movements`. Someone who may edit
      // a product name must not thereby be able to redefine what «a carton»
      // means — the same reasoning that puts costing configuration behind this
      // capability rather than behind product editing.
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.configure')],
      schema: { body: toJsonSchema(replaceSchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId } = paramsSchema.parse(request.params)
        const { units } = replaceSchema.parse(request.body)
        return reply.send(await service.replace(request.tenancy, productId, units))
      } catch (err) {
        return fail(reply, err, 'Failed to save product units')
      }
    },
  )
}
