// ============================================
// backend/src/routes/product-images.routes.ts
//
// A product's gallery (docs/product-images-migration.sql):
//
//   GET    /api/products/:id/images              the images, in order
//   POST   /api/products/:id/images              { base64, altText? }
//   PATCH  /api/products/:id/images/:imageId     { altText }
//   DELETE /api/products/:id/images/:imageId
//   PUT    /api/products/:id/images/order        { ids } — the new order
//
// Reads: any member of the workspace. Writes: product.write on that product
// (the service asks `scopes.assertMay`, like every other product edit).
// The cover (`products.image_url`) changes with the gallery, so every write
// invalidates the workspace's cached product lists.
// ============================================

import { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { sendFailure } from '../errors/http-failure'
import { invalidateMoneyCaches } from '../utils/money-cache'
import { productImagesService } from '../services/product-images/product-images.service'

const guard = [authenticate, requireWorkspaceContext]

const altText = z.string().trim().max(200)
const addBody = z.object({ base64: z.string().min(1), altText: altText.optional() })
const altBody = z.object({ altText })
const orderBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(8) })

type Params = { id: string; imageId?: string }

export async function productImagesRoutes(fastify: FastifyInstance) {
  const fail = (reply: FastifyReply, err: unknown, fallback: string) =>
    sendFailure(reply, fastify.log, err, fallback)

  fastify.get('/api/products/:id/images', { preHandler: guard }, async (request, reply) => {
    try {
      const { id } = request.params as Params
      return reply.send({ images: await productImagesService.list(request.tenancy, id) })
    } catch (err) {
      return fail(reply, err, 'Failed to read product images')
    }
  })

  fastify.post('/api/products/:id/images', { preHandler: guard }, async (request, reply) => {
    try {
      const { id } = request.params as Params
      const body = addBody.parse(request.body)
      const image = await productImagesService.add(request.tenancy, id, body)
      await invalidateMoneyCaches(request.tenancy.workspaceId)
      return reply.code(201).send(image)
    } catch (err) {
      return fail(reply, err, 'Failed to add the product image')
    }
  })

  // Declared before /:imageId so the static segment wins.
  fastify.put('/api/products/:id/images/order', { preHandler: guard }, async (request, reply) => {
    try {
      const { id } = request.params as Params
      const { ids } = orderBody.parse(request.body)
      await productImagesService.reorder(request.tenancy, id, ids)
      await invalidateMoneyCaches(request.tenancy.workspaceId)
      return reply.send({ images: await productImagesService.list(request.tenancy, id) })
    } catch (err) {
      return fail(reply, err, 'Failed to reorder the product images')
    }
  })

  fastify.patch(
    '/api/products/:id/images/:imageId',
    { preHandler: guard },
    async (request, reply) => {
      try {
        const { id, imageId } = request.params as Params
        const body = altBody.parse(request.body)
        return reply.send(
          await productImagesService.setAltText(request.tenancy, id, imageId!, body.altText),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to save the alt text')
      }
    },
  )

  fastify.delete(
    '/api/products/:id/images/:imageId',
    { preHandler: guard },
    async (request, reply) => {
      try {
        const { id, imageId } = request.params as Params
        await productImagesService.remove(request.tenancy, id, imageId!)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.code(204).send()
      } catch (err) {
        return fail(reply, err, 'Failed to remove the product image')
      }
    },
  )
}
