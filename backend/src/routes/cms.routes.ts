import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { supabase } from '../db'
import { CmsRepository } from '../services/cms/cms.repository'
import { CmsService } from '../services/cms/cms.service'
import { pageInputSchema } from '../services/cms/cms.domain'

export default async function cmsRoutes(fastify: FastifyInstance) {
  // We attach it to the fastify instance. In a real app we'd use DI, but here we construct it.
  const cmsService = new CmsService(new CmsRepository(supabase))

  const ADMIN = [authenticate, requireWorkspaceContext]

  const idParams = z.object({ id: z.string().uuid() })

  const publicUrlParams = z.object({
    locale: z.enum(['fa', 'af', 'en']),
    slug: z.string().min(1),
  })

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC ROUTES (Used by Next.js SSG/ISR)
  // ═══════════════════════════════════════════════════════════════

  fastify.get(
    '/api/public/cms/pages/:locale/:slug',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { locale, slug } = publicUrlParams.parse(request.params)
      // No auth required, this is the public website
      const page = await cmsService.getPublishedPageByUrl(locale, slug)

      // Cache heavily for ISR
      reply.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
      return reply.send(page)
    },
  )

  // ═══════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════

  fastify.get(
    '/api/cms/pages',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = z
        .object({ locale: z.string().optional(), status: z.string().optional() })
        .parse(request.query)
      const pages = await cmsService.listPages(request.tenancy, query.locale, query.status)
      return reply.send(pages)
    },
  )

  fastify.post(
    '/api/cms/pages',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const input = pageInputSchema.parse(request.body)
      const page = await cmsService.createPage(request.tenancy, input)
      return reply.code(201).send(page)
    },
  )

  fastify.get(
    '/api/cms/pages/:id',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = idParams.parse(request.params)
      const page = await cmsService.getPage(request.tenancy, id)
      return reply.send(page)
    },
  )

  fastify.put(
    '/api/cms/pages/:id',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = idParams.parse(request.params)
      const input = pageInputSchema.parse(request.body)
      const page = await cmsService.updatePage(request.tenancy, id, input)
      return reply.send(page)
    },
  )

  fastify.post(
    '/api/cms/pages/:id/publish',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = idParams.parse(request.params)
      const page = await cmsService.publishPage(request.tenancy, id)
      return reply.send(page)
    },
  )

  fastify.post(
    '/api/cms/pages/:id/archive',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = idParams.parse(request.params)
      const page = await cmsService.archivePage(request.tenancy, id)
      return reply.send(page)
    },
  )

  // ═══════════════════════════════════════════════════════════════
  // GLOBALS / REMOTE CONTENT ROUTES
  // ═══════════════════════════════════════════════════════════════

  fastify.get(
    '/api/public/cms/globals/:locale',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { locale } = z.object({ locale: z.enum(['fa', 'af', 'en']) }).parse(request.params)
      // No auth required, used by Native Apps to sync their strings
      const globals = await cmsService.getPublishedGlobals(locale)

      // Map to key-value object for easy consumer usage
      const kv = globals.reduce(
        (acc, row) => {
          acc[row.key] = row.content
          return acc
        },
        {} as Record<string, unknown>,
      )

      const payloadString = JSON.stringify(kv)
      const etag = `"${require('crypto').createHash('md5').update(payloadString).digest('hex')}"`

      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send()
      }

      reply.header('ETag', etag)
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
      return reply.send(kv)
    },
  )

  fastify.put(
    '/api/cms/globals/:locale/:key',
    { preHandler: ADMIN },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { locale, key } = z
        .object({
          locale: z.enum(['fa', 'af', 'en']),
          key: z.string().min(1),
        })
        .parse(request.params)

      const content = z.record(z.unknown()).parse(request.body)
      const row = await cmsService.upsertGlobal(request.tenancy, locale, key, content)
      return reply.send(row)
    },
  )
}
