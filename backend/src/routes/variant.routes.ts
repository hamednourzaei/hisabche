// ============================================
// backend/src/routes/variant.routes.ts
//
// Fastify Routes for Product Variants (Stock -> Products)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { VariantService } from '../services/product/variant.service'

export async function variantRoutes(fastify: FastifyInstance) {
  const service = new VariantService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('product.read')]
  const productWrite = [authenticate, requireWorkspaceContext, requireCapability('product.write')]

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
}
