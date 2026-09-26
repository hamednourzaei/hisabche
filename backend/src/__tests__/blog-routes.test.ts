// ============================================
// Blog routes on a real Fastify instance.
//
// 1. The hand-written response schemas are what fast-json-stringify sends: a
//    real response goes through them and must equal JSON.stringify — a null
//    turned into "" (the serialiser's silent substitution) or a dropped field
//    fails here, not on a crawled page.
// 2. Who may call what: public reads need no session, interaction needs one,
//    authoring needs a platform admin.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const sampleSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  locale: 'fa',
  slug: 'what-is-a-sales-invoice',
  title: 'فاکتور فروش چیست',
  excerpt: 'تعریف کوتاه',
  coverUrl: null,
  coverAlt: null,
  publishedAt: '2026-09-20T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
  readingMinutes: 4,
  category: null,
  tags: [{ slug: 'invoice', name: 'فاکتور' }],
}
const samplePost = {
  ...sampleSummary,
  contentHtml: '<h2 id="x">x</h2><p>متن</p>',
  toc: [{ id: 'x', text: 'x', level: 2 }],
  faq: [{ q: 'فاکتور رسمی چیست؟', a: 'پاسخ' }],
  metaTitle: null,
  metaDescription: null,
  focusKeyword: 'فاکتور فروش',
  keywords: [],
  canonicalUrl: null,
  ogImageUrl: null,
  noindex: false,
  author: null,
  translations: [{ locale: 'en', slug: 'what-is-a-sales-invoice' }],
  related: [sampleSummary],
  stats: { likes: 0, dislikes: 0, ratingCount: 0, ratingAvg: null, comments: 0 },
}

const service = vi.hoisted(() => ({
  listPublic: vi.fn(),
  getPublic: vi.fn(),
  addComment: vi.fn(),
}))

vi.mock('../services/blog', async () => {
  const actual = await vi.importActual<typeof import('../services/blog')>('../services/blog')
  return {
    ...actual,
    // A class, because the routes call `new BlogService()`.
    BlogService: class {
      listPublic = service.listPublic
      getPublic = service.getPublic
      addComment = service.addComment
    },
  }
})

const { blogRoutes, isPublicBlogRequest } = await import('../routes/blog.routes')

const app = Fastify()

beforeAll(async () => {
  await app.register(blogRoutes)
  await app.ready()
})
afterAll(() => app.close())

describe('responses go through the schema unchanged', () => {
  it('⚠️ an article with null fields is sent exactly as the service returned it', async () => {
    service.getPublic.mockResolvedValueOnce(samplePost)
    const res = await app.inject({
      method: 'GET',
      url: '/api/blog/posts/fa/what-is-a-sales-invoice',
    })
    expect(res.statusCode).toBe(200)
    // Not "" — a null metaTitle must stay null so the page falls back to the title.
    expect(res.json()).toEqual(samplePost)
    expect(service.getPublic).toHaveBeenCalledWith('fa', 'what-is-a-sales-invoice')
  })

  it('a list with no category/tag filter keeps them null', async () => {
    const list = {
      posts: [sampleSummary],
      total: 1,
      page: 1,
      pageSize: 12,
      category: null,
      tag: null,
    }
    service.listPublic.mockResolvedValueOnce(list)
    const res = await app.inject({ method: 'GET', url: '/api/blog/posts?locale=fa' })
    expect(res.json()).toEqual(list)
  })

  it('an unknown locale is a 400, not a query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/blog/posts?locale=de' })
    expect(res.statusCode).toBe(400)
    expect(service.listPublic).not.toHaveBeenCalledWith(expect.objectContaining({ locale: 'de' }))
  })
})

describe('who may call what', () => {
  it('interaction without a session is 401 before any work', async () => {
    const id = sampleSummary.id
    for (const [method, url] of [
      ['POST', `/api/blog/posts/${id}/comments`],
      ['PUT', `/api/blog/posts/${id}/reaction`],
      ['PUT', `/api/blog/posts/${id}/rating`],
      ['GET', `/api/blog/posts/${id}/me`],
    ] as const) {
      const res = await app.inject(
        method === 'GET' ? { method, url } : { method, url, payload: {} },
      )
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
    expect(service.addComment).not.toHaveBeenCalled()
  })

  it('authoring without a session is 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/blog/posts', payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it('the global auth hook opens exactly the public reads and the view beacon', () => {
    expect(isPublicBlogRequest('GET', '/api/blog/posts')).toBe(true)
    expect(isPublicBlogRequest('GET', '/api/blog/posts/fa/x')).toBe(true)
    expect(isPublicBlogRequest('GET', '/api/blog/sitemap')).toBe(true)
    expect(isPublicBlogRequest('POST', `/api/blog/posts/${sampleSummary.id}/view`)).toBe(true)
    // Not public:
    expect(isPublicBlogRequest('GET', `/api/blog/posts/${sampleSummary.id}/me`)).toBe(false)
    expect(isPublicBlogRequest('POST', `/api/blog/posts/${sampleSummary.id}/comments`)).toBe(false)
    expect(isPublicBlogRequest('PUT', `/api/blog/posts/${sampleSummary.id}/reaction`)).toBe(false)
    expect(isPublicBlogRequest('GET', '/api/admin/blog/posts')).toBe(false)
    expect(isPublicBlogRequest('GET', '/api/blogger')).toBe(false)
  })
})

describe('source guards', () => {
  const src = readFileSync(join(__dirname, '..', 'routes', 'blog.routes.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('every admin route carries authenticate + platformAdminGuard', () => {
    const adminRoutes = [...src.matchAll(/fastify\.\w+\(\s*'\/api\/admin\/blog[^']*',\s*(\w+)/g)]
    expect(adminRoutes.length).toBeGreaterThanOrEqual(10)
    for (const m of adminRoutes) expect(m[1], m[0]).toBe('admin')
    expect(src).toContain('const admin = { preHandler: [authenticate, platformAdminGuard] }')
  })

  it('the acting user comes from the token, never from the body', () => {
    expect(src).toContain('(request.user as { id: string }).id')
    expect(src).not.toMatch(/body\.\s*userId|body\.\s*user_id|body\.\s*authorId/)
  })

  it('the global hook in index.ts consults isPublicBlogRequest', () => {
    const index = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(index).toContain('isPublicBlogRequest(request.method, path)')
    expect(index).toContain('await server.register(blogRoutes)')
  })
})
