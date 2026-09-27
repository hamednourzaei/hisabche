// ============================================
// backend/src/routes/blog.routes.ts
//
// The blog: public reading, signed-in interaction, platform-admin authoring.
// Every handler goes through the Blog Core (services/blog).
//
//   PUBLIC     GET  /api/blog/posts                      list (locale, category, tag, page)
//              GET  /api/blog/posts/:locale/:slug        one article
//              GET  /api/blog/posts/:id/comments         approved comments
//              GET  /api/blog/sitemap                    what the sitemap lists
//              POST /api/blog/posts/:id/view             one view (rate-limited)
//   SIGNED IN  GET  /api/blog/posts/:id/me               my like, stars, pending comments
//              POST /api/blog/posts/:id/comments         comment (rate limit + honeypot)
//              PUT  /api/blog/posts/:id/reaction         like / dislike / withdraw (upsert)
//              PUT  /api/blog/posts/:id/rating           1..5 stars (upsert)
//   ADMIN      /api/admin/blog/…                         authenticate + platformAdminGuard
//
// ⚠️ PERSON-SCOPED. `request.user.id` is the only user id used; no body field
// can name another person.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  BLOG_COMMENT_STATUSES,
  BLOG_POST_STATUSES,
  blogCommentInputSchema,
  blogCommentModerationSchema,
  blogImageUploadSchema,
  blogLocaleSchema,
  blogPostInputSchema,
  blogRatingSchema,
  blogReactionSchema,
  blogSlugSchema,
  blogTaxonomyInputSchema,
} from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { sendFailure } from '../errors/http-failure'
import { BlogError, BlogService } from '../services/blog'
import { PUBLIC_EDGE_CACHE } from '../utils/edge-cache'

/**
 * Which blog requests need no session. Read by the global auth hook in
 * index.ts: every GET under /api/blog/ (the `/me` route authenticates itself)
 * and the view beacon.
 */
export function isPublicBlogRequest(method: string, path: string): boolean {
  if (!path.startsWith('/api/blog/')) return false
  if (method === 'GET') return !/^\/api\/blog\/posts\/[^/]+\/me$/.test(path)
  return method === 'POST' && /^\/api\/blog\/posts\/[^/]+\/view$/.test(path)
}

// ─── response schemas (public, crawled by the web) ───────────────────────────
//
// ⚠️ THESE ARE THE RESPONSE, NOT A DESCRIPTION OF IT. fast-json-stringify sends
// only what they name, and turns a null on a plain `string` into "" — so every
// nullable field is written ['string','null'] (راهنمای سشن، سریالایز). Keep them
// identical to BlogPostSummary / BlogPostPublic in services/blog/blog.service.ts.
// Guard: blog-routes.test.ts serialises a real response through them and
// compares it with JSON.stringify.

const str = { type: 'string' } as const
const num = { type: 'number' } as const
const nullableStr = { type: ['string', 'null'] } as const
const taxonomyRef = {
  type: 'object',
  required: ['slug', 'name'],
  properties: { slug: str, name: str },
} as const
const summaryProperties = {
  id: str,
  locale: str,
  slug: str,
  title: str,
  excerpt: str,
  coverUrl: nullableStr,
  coverAlt: nullableStr,
  publishedAt: nullableStr,
  updatedAt: str,
  readingMinutes: num,
  category: { anyOf: [taxonomyRef, { type: 'null' }] },
  tags: { type: 'array', items: taxonomyRef },
} as const
const summarySchema = {
  type: 'object',
  required: Object.keys(summaryProperties),
  properties: summaryProperties,
} as const

export const blogListJsonSchema = {
  type: 'object',
  required: ['posts', 'total', 'page', 'pageSize', 'category', 'tag'],
  properties: {
    posts: { type: 'array', items: summarySchema },
    total: num,
    page: num,
    pageSize: num,
    category: {
      anyOf: [
        {
          type: 'object',
          required: ['slug', 'name', 'description'],
          properties: { slug: str, name: str, description: nullableStr },
        },
        { type: 'null' },
      ],
    },
    tag: { anyOf: [taxonomyRef, { type: 'null' }] },
  },
} as const

const postProperties = {
  ...summaryProperties,
  contentHtml: str,
  toc: {
    type: 'array',
    items: {
      type: 'object',
      required: ['id', 'text', 'level'],
      properties: { id: str, text: str, level: num },
    },
  },
  faq: {
    type: 'array',
    items: { type: 'object', required: ['q', 'a'], properties: { q: str, a: str } },
  },
  metaTitle: nullableStr,
  metaDescription: nullableStr,
  focusKeyword: nullableStr,
  keywords: { type: 'array', items: str },
  canonicalUrl: nullableStr,
  ogImageUrl: nullableStr,
  noindex: { type: 'boolean' },
  author: {
    anyOf: [{ type: 'object', required: ['name'], properties: { name: str } }, { type: 'null' }],
  },
  translations: {
    type: 'array',
    items: { type: 'object', required: ['locale', 'slug'], properties: { locale: str, slug: str } },
  },
  related: { type: 'array', items: summarySchema },
  stats: {
    type: 'object',
    required: ['likes', 'dislikes', 'ratingCount', 'ratingAvg', 'comments'],
    properties: {
      likes: num,
      dislikes: num,
      ratingCount: num,
      ratingAvg: { type: ['number', 'null'] },
      comments: num,
    },
  },
} as const

export const blogPostJsonSchema = {
  type: 'object',
  required: Object.keys(postProperties),
  properties: postProperties,
} as const

// ─── params / queries ────────────────────────────────────────────────────────

const idParams = z.object({ id: z.string().uuid() })
const slugParams = z.object({ locale: blogLocaleSchema, slug: z.string().min(1).max(200) })
const page = z.coerce.number().int().min(1).max(1000).default(1)
const listQuery = z.object({
  locale: blogLocaleSchema,
  category: blogSlugSchema.optional(),
  tag: blogSlugSchema.optional(),
  page,
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
})
const adminListQuery = z.object({
  locale: blogLocaleSchema.optional(),
  status: z.enum(BLOG_POST_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page,
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
const taxonomyQuery = z.object({ locale: blogLocaleSchema.optional() })
const moderationQuery = z.object({
  status: z.enum(BLOG_COMMENT_STATUSES).default('pending'),
  page,
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
})
const kindParams = z.object({ kind: z.enum(['categories', 'tags']) })
const kindIdParams = kindParams.extend({ id: z.string().uuid() })

export async function blogRoutes(fastify: FastifyInstance) {
  const service = new BlogService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof BlogError) {
      return reply.code(err.statusCode).send({
        error: err.code,
        code: err.code,
        // Same shape as a zod issue, so the client's apiErrorFields() puts
        // each reason under its own field.
        details: err.details.map((d) => ({ path: [d.path], message: d.message })),
      })
    }
    return sendFailure(reply, fastify.log, err, fallback)
  }

  const userOf = (request: FastifyRequest) => (request.user as { id: string }).id
  const admin = { preHandler: [authenticate, platformAdminGuard] }

  // ─── public ────────────────────────────────────────────────────────────────

  fastify.get(
    '/api/blog/posts',
    { schema: { response: { 200: blogListJsonSchema } } },
    async (request, reply) => {
      try {
        const q = listQuery.parse(request.query)
        const list = await service.listPublic(q)
        return reply.header('Cache-Control', PUBLIC_EDGE_CACHE).send(list)
      } catch (err) {
        return fail(reply, err, 'Failed to list blog posts')
      }
    },
  )

  fastify.get(
    '/api/blog/posts/:locale/:slug',
    { schema: { response: { 200: blogPostJsonSchema } } },
    async (request, reply) => {
      try {
        const { locale, slug } = slugParams.parse(request.params)
        const post = await service.getPublic(locale, decodeURIComponent(slug))
        return reply.header('Cache-Control', PUBLIC_EDGE_CACHE).send(post)
      } catch (err) {
        return fail(reply, err, 'Failed to fetch blog post')
      }
    },
  )

  fastify.get('/api/blog/posts/:id/comments', async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send({ comments: await service.comments(id) })
    } catch (err) {
      return fail(reply, err, 'Failed to fetch comments')
    }
  })

  fastify.get('/api/blog/sitemap', async (_request, reply) => {
    try {
      const sitemap = await service.sitemap()
      return reply.header('Cache-Control', PUBLIC_EDGE_CACHE).send(sitemap)
    } catch (err) {
      return fail(reply, err, 'Failed to build the blog sitemap')
    }
  })

  fastify.post(
    '/api/blog/posts/:id/view',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        await service.view(id)
        return reply.code(204).send()
      } catch (err) {
        return fail(reply, err, 'Failed to record view')
      }
    },
  )

  // ─── signed in ─────────────────────────────────────────────────────────────

  fastify.get('/api/blog/posts/:id/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send(await service.me(id, userOf(request)))
    } catch (err) {
      return fail(reply, err, 'Failed to fetch your activity')
    }
  })

  fastify.post(
    '/api/blog/posts/:id/comments',
    {
      preHandler: [authenticate],
      // Shared across instances (SharedRateLimitStore); a person commenting
      // more than this in a minute is not writing comments.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const body = blogCommentInputSchema.parse(request.body)
        return reply.code(201).send(await service.addComment(id, userOf(request), body))
      } catch (err) {
        return fail(reply, err, 'Failed to save comment')
      }
    },
  )

  fastify.put(
    '/api/blog/posts/:id/reaction',
    { preHandler: [authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const { value } = blogReactionSchema.parse(request.body)
        return reply.send(await service.react(id, userOf(request), value))
      } catch (err) {
        return fail(reply, err, 'Failed to save reaction')
      }
    },
  )

  fastify.put(
    '/api/blog/posts/:id/rating',
    { preHandler: [authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const { stars } = blogRatingSchema.parse(request.body)
        return reply.send(await service.rate(id, userOf(request), stars))
      } catch (err) {
        return fail(reply, err, 'Failed to save rating')
      }
    },
  )

  // ─── admin ─────────────────────────────────────────────────────────────────

  fastify.get('/api/admin/blog/posts', admin, async (request, reply) => {
    try {
      return reply.send(await service.adminList(adminListQuery.parse(request.query)))
    } catch (err) {
      return fail(reply, err, 'Failed to list blog posts')
    }
  })

  fastify.get('/api/admin/blog/posts/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send(await service.adminGet(id))
    } catch (err) {
      return fail(reply, err, 'Failed to fetch blog post')
    }
  })

  fastify.post('/api/admin/blog/posts', admin, async (request, reply) => {
    try {
      const input = blogPostInputSchema.parse(request.body)
      return reply.code(201).send(await service.save(null, input, userOf(request), request.log))
    } catch (err) {
      return fail(reply, err, 'Failed to create blog post')
    }
  })

  fastify.put('/api/admin/blog/posts/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      const input = blogPostInputSchema.parse(request.body)
      return reply.send(await service.save(id, input, userOf(request), request.log))
    } catch (err) {
      return fail(reply, err, 'Failed to update blog post')
    }
  })

  fastify.delete('/api/admin/blog/posts/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send(await service.remove(id, request.log))
    } catch (err) {
      return fail(reply, err, 'Failed to delete blog post')
    }
  })

  const kindOf = (kind: 'categories' | 'tags') => (kind === 'categories' ? 'category' : 'tag')

  fastify.get('/api/admin/blog/:kind', admin, async (request, reply) => {
    try {
      const { kind } = kindParams.parse(request.params)
      const { locale } = taxonomyQuery.parse(request.query)
      return reply.send({ items: await service.listTaxonomy(kindOf(kind), locale) })
    } catch (err) {
      return fail(reply, err, 'Failed to list taxonomy')
    }
  })

  fastify.post('/api/admin/blog/:kind', admin, async (request, reply) => {
    try {
      const { kind } = kindParams.parse(request.params)
      const input = blogTaxonomyInputSchema.parse(request.body)
      return reply
        .code(201)
        .send(await service.saveTaxonomy(kindOf(kind), null, input, request.log))
    } catch (err) {
      return fail(reply, err, 'Failed to create taxonomy')
    }
  })

  fastify.put('/api/admin/blog/:kind/:id', admin, async (request, reply) => {
    try {
      const { kind, id } = kindIdParams.parse(request.params)
      const input = blogTaxonomyInputSchema.parse(request.body)
      return reply.send(await service.saveTaxonomy(kindOf(kind), id, input, request.log))
    } catch (err) {
      return fail(reply, err, 'Failed to update taxonomy')
    }
  })

  fastify.delete('/api/admin/blog/:kind/:id', admin, async (request, reply) => {
    try {
      const { kind, id } = kindIdParams.parse(request.params)
      return reply.send(await service.removeTaxonomy(kindOf(kind), id, request.log))
    } catch (err) {
      return fail(reply, err, 'Failed to delete taxonomy')
    }
  })

  fastify.get('/api/admin/blog/comments', admin, async (request, reply) => {
    try {
      return reply.send(await service.moderationQueue(moderationQuery.parse(request.query)))
    } catch (err) {
      return fail(reply, err, 'Failed to list comments')
    }
  })

  fastify.patch('/api/admin/blog/comments/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      const { status } = blogCommentModerationSchema.parse(request.body)
      return reply.send({ comment: await service.moderate(id, status, userOf(request)) })
    } catch (err) {
      return fail(reply, err, 'Failed to moderate comment')
    }
  })

  fastify.post('/api/admin/blog/images', admin, async (request, reply) => {
    try {
      const input = blogImageUploadSchema.parse(request.body)
      return reply.code(201).send(await service.uploadImage(input))
    } catch (err) {
      return fail(reply, err, 'Failed to upload image')
    }
  })
}
