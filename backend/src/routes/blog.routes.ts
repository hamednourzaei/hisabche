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
import { createBrief, getBrief, PLATFORM_SCOPE } from '../services/blog/brief.service'
import { getContentJob, getDraft, listDrafts } from '../services/blog/draft.service'
import {
  DEFAULT_WRITER_PROMPT,
  WRITER_PROMPT_MAX,
  getWriterPrompt,
  resetWriterPrompt,
  saveWriterPrompt,
} from '../services/blog/writer-prompt'
import { decideInternalLink, listSuggestions } from '../services/blog/internal-links.service'
import { JobService } from '../services/job.service'
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

// ⚠️ A topic that becomes a Tavily query and a brief. Bounded so a pasted
// document is rejected at the door, not searched for.
const briefInputSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  locale: blogLocaleSchema,
})

export async function blogRoutes(fastify: FastifyInstance) {
  const service = new BlogService()
  const jobService = new JobService()

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

  // ─── content intelligence (admin only) ─────────────────────────────────────
  //
  // ⚠️ These are the CALLER the research pipeline was missing. Until these two
  // routes existed, `CONTENT_RESEARCH` was a handler nobody could reach —
  // correct code with no door (§7.1). The POST creates one brief + one job; a
  // double-click returns the FIRST brief, because the database's partial unique
  // index on active topics — not a pre-read — is what makes that race-safe.
  // The GET is the progress read: brief, every attempt, the real sources.

  fastify.post(
    '/api/admin/blog/intelligence/briefs',
    {
      preHandler: admin.preHandler,
      // Each POST costs a Tavily run (×3 locales) plus a provider call. A human
      // planning articles does not need more than a few a minute; a runaway
      // script must not be able to bill either.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const input = briefInputSchema.parse(request.body)
        const created = await createBrief({ ...input, actorId: userOf(request) })
        return reply.code(created.existing ? 200 : 201).send(created)
      } catch (err) {
        return fail(reply, err, 'Failed to start research')
      }
    },
  )

  fastify.get('/api/admin/blog/intelligence/briefs/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send(await getBrief(id))
    } catch (err) {
      return fail(reply, err, 'Failed to read the brief')
    }
  })

  // ⚠️ A JOB, NOT A SYNC CALL — and the first version of this route was
  // synchronous, which was wrong twice: it duplicated the CONTENT_DRAFT handler
  // (two paths into the same generation, G2), and a draft takes up to 180 s of
  // provider time, which Render's proxy cuts off long before. The click
  // enqueues; the admin polls GET …/drafts, exactly like the research pass.
  // The rate limit is the held-down-button guard; the version unique index is
  // the double-click guard.
  fastify.post(
    '/api/admin/blog/intelligence/briefs/:id/draft',
    {
      preHandler: admin.preHandler,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        // The brief must exist and be researched before a draft job is worth
        // enqueueing — a job that fails 10 ms later on a missing brief is a
        // round-trip through the queue for an error this route can answer now.
        await getBrief(id)
        const job = await jobService.create({
          job_type: 'CONTENT_DRAFT',
          payload: { briefId: id, userId: userOf(request), workspaceId: PLATFORM_SCOPE },
          max_retries: 1,
        })
        return reply.code(202).send({ jobId: job.id, briefId: id })
      } catch (err) {
        return fail(reply, err, 'Failed to start draft generation')
      }
    },
  )

  fastify.get('/api/admin/blog/intelligence/briefs/:id/drafts', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send({ drafts: await listDrafts(id) })
    } catch (err) {
      return fail(reply, err, 'Failed to list drafts')
    }
  })

  fastify.get('/api/admin/blog/intelligence/drafts/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send(await getDraft(id))
    } catch (err) {
      return fail(reply, err, 'Failed to read the draft')
    }
  })

  // The state of ONE content job, so the editor's button can say «failed, and
  // why» instead of spinning forever. Only content jobs are readable here — a
  // job id of another kind answers 404, never its payload.
  fastify.get('/api/admin/blog/intelligence/jobs/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      const job = await getContentJob(id)
      if (!job) return reply.code(404).send({ error: 'JOB_NOT_FOUND', code: 'JOB_NOT_FOUND' })
      return reply.send(job)
    } catch (err) {
      return fail(reply, err, 'Failed to read the job')
    }
  })

  // ─── the editable writer prompt ────────────────────────────────────────────
  //
  // The EDITORIAL prompt of the one-click article (voice, structure, audience).
  // The output contract is code and is not here — see writer-prompt.ts. The
  // default is sent along so the editor can show «reset» without a second call.

  fastify.get('/api/admin/blog/intelligence/prompt', admin, async (_request, reply) => {
    try {
      return reply.send({
        ...(await getWriterPrompt()),
        defaultPrompt: DEFAULT_WRITER_PROMPT,
        maxLength: WRITER_PROMPT_MAX,
      })
    } catch (err) {
      return fail(reply, err, 'Failed to read the writer prompt')
    }
  })

  const promptSchema = z.object({ prompt: z.string().trim().min(50).max(WRITER_PROMPT_MAX) })

  fastify.put('/api/admin/blog/intelligence/prompt', admin, async (request, reply) => {
    try {
      const { prompt } = promptSchema.parse(request.body)
      return reply.send(await saveWriterPrompt(prompt, userOf(request)))
    } catch (err) {
      return fail(reply, err, 'Failed to save the writer prompt')
    }
  })

  fastify.delete('/api/admin/blog/intelligence/prompt', admin, async (_request, reply) => {
    try {
      return reply.send(await resetWriterPrompt())
    } catch (err) {
      return fail(reply, err, 'Failed to reset the writer prompt')
    }
  })

  // ⚠️ NO SYNC POST FOR LINKS. Suggesting costs one provider call of up to
  // 120 s — the same proxy-timeout flaw the sync draft route had. The
  // CONTENT_DRAFT job already runs suggestions after a passed gate; this is
  // the read side and the human decision.

  fastify.get('/api/admin/blog/intelligence/drafts/:id/links', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      return reply.send({ suggestions: await listSuggestions(id) })
    } catch (err) {
      return fail(reply, err, 'Failed to list link suggestions')
    }
  })

  const linkDecisionSchema = z.object({ decision: z.enum(['accepted', 'rejected']) })

  fastify.patch('/api/admin/blog/intelligence/links/:id', admin, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params)
      const { decision } = linkDecisionSchema.parse(request.body)
      return reply.send(await decideInternalLink(id, decision, userOf(request)))
    } catch (err) {
      return fail(reply, err, 'Failed to record the decision')
    }
  })
}
