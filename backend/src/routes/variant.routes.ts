// ============================================
// backend/src/routes/variant.routes.ts
//
// Fastify Routes for Product Variants (Stock -> Products)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { variantMatrixSchema, variantStockMoveSchema } from '@hisabche/validation'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireProfileCapability } from '../middleware/profile-capability.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { VariantService } from '../services/product/variant.service'
import { sendFailure } from '../errors/http-failure'
import { invalidateMoneyCaches } from '../utils/money-cache'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function variantRoutes(fastify: FastifyInstance) {
  const service = new VariantService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('product.read')]
  // Permission AND capability: the role may write products, and the business must have
  // variants switched on (a workspace with no declared profile is never restricted).
  const productWrite = [
    authenticate,
    requireWorkspaceContext,
    requireCapability('product.write'),
    requireProfileCapability('variants'),
  ]

  fastify.get(
    '/api/products/:id/variants',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const workspaceId = request.tenancy.workspaceId
      const variants = await service.getVariants(workspaceId, id)
      return reply.send({ data: variants })
    },
  )

  fastify.post(
    '/api/products/:id/variants',
    { preHandler: productWrite },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        sku: string
        barcode?: string | undefined
        attributes: Array<{ name: string; value: string }>
        priceOverrideMinor?: number | undefined
        costOverrideMinor?: number | undefined
      }
      const workspaceId = request.tenancy.workspaceId
      const variant = await service.createVariant(workspaceId, {
        templateProductId: id,
        sku: body.sku,
        barcode: body.barcode,
        attributes: body.attributes,
        priceOverrideMinor: body.priceOverrideMinor,
        costOverrideMinor: body.costOverrideMinor,
      })
      return reply.status(201).send({ data: variant })
    },
  )

  // ─── variant-stock-01 (clothing, 10 Nov 2026) ──────────────────────────
  // Every variant with its stock, per warehouse, and what it sold.
  fastify.get(
    '/api/products/:id/variants/stock',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        if (!UUID.test(id)) return reply.code(400).send({ error: 'Invalid product id' })
        const data = await service.stock(request.tenancy.workspaceId, id)
        return reply.send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to read the variant stock')
      }
    },
  )

  // «S M L XL × black, white»: every missing cell of the grid, in one insert.
  fastify.post(
    '/api/products/:id/variants/matrix',
    { preHandler: productWrite },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        if (!UUID.test(id)) return reply.code(400).send({ error: 'Invalid product id' })
        const body = variantMatrixSchema.parse(request.body)
        const data = await service.createMatrix(request.tenancy.workspaceId, id, body)
        return reply.status(201).send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create the variants')
      }
    },
  )

  // Put stock on a variant, or take it off. Same permission as any stock edit.
  fastify.post(
    '/api/products/:id/variants/:variantId/stock',
    { preHandler: productWrite },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, variantId } = request.params as { id: string; variantId: string }
        if (!UUID.test(id) || !UUID.test(variantId)) {
          return reply.code(400).send({ error: 'Invalid id' })
        }
        const body = variantStockMoveSchema.parse(request.body)
        const data = await service.moveStock(request.tenancy, id, variantId, body)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to move the variant stock')
      }
    },
  )
}
