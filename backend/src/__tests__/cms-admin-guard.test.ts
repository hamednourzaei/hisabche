// ============================================
// backend/src/__tests__/cms-admin-guard.test.ts
//
// The CMS is PLATFORM content. A customer is not its admin.
//
// ⚠️ WHAT WAS WRONG
//
// `cms.routes.ts` guarded its admin routes with
// `[authenticate, requireWorkspaceContext]`. That guard asks «does this person
// belong to SOME workspace?» — and the answer is yes for every customer on
// earth. The CMS tables carry no `workspace_id` (they are the site's pages,
// the site's globals, the site's media), so there was no workspace to scope
// them by: the check was not a weaker version of the right check, it was the
// wrong check.
//
// The consequence: any shopkeeper with an account could create a page, edit
// the landing page, PUBLISH their own page on the public site, archive a
// page, or rewrite the globals that every app fetches at start-up.
//
// The guard is now the platform-admin one — the email allowlist that
// `admin.routes.ts` uses. The service takes the actor's user id instead of a
// tenancy context, because there is no workspace in this feature.
//
// ⚠️ THE INJECTION
//
// Change `const ADMIN = [authenticate, platformAdminGuard]` back to
// `[authenticate, requireWorkspaceContext]` and the member's 403 becomes a
// 201 — the test below goes red on every write route. That is the proof the
// test measures the guard and not the shape of the response.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

// ⚠️ THE ALLOWLIST IS READ ONCE, AT MODULE LOAD, by the guard — so it must be
// in place BEFORE the backend is imported (the import below is dynamic).
process.env.ADMIN_ALLOWED_EMAILS = 'admin@hisabche.com'

const db = new FakeDatabase()

const MEMBER = {
  id: '11111111-1111-4111-8111-111111111111',
  token: 'token-shopkeeper',
  email: 'shopkeeper@example.com',
}

const ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  token: 'token-platform-admin',
  email: 'admin@hisabche.com',
}

const users = new Map<string, { id: string; email: string }>([
  [MEMBER.token, { id: MEMBER.id, email: MEMBER.email }],
  [ADMIN.token, { id: ADMIN.id, email: ADMIN.email }],
])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

const PAGE_BODY = { locale: 'fa', slug: 'a-test-page', title: 'یک صفحه‌ی آزمایشی' }
const PAGE_ID = '33333333-3333-4333-8333-333333333333'

function as(token: string) {
  return { authorization: `Bearer ${token}` }
}

/** Every write the CMS exposes, and the reads that show unpublished drafts. */
const CMS_ROUTES = [
  { method: 'POST' as const, url: '/api/cms/pages', payload: PAGE_BODY },
  { method: 'PUT' as const, url: `/api/cms/pages/${PAGE_ID}`, payload: PAGE_BODY },
  { method: 'POST' as const, url: `/api/cms/pages/${PAGE_ID}/publish`, payload: {} },
  { method: 'POST' as const, url: `/api/cms/pages/${PAGE_ID}/archive`, payload: {} },
  { method: 'PUT' as const, url: '/api/cms/globals/fa/greeting', payload: { hello: 'hi' } },
]

const CMS_READS = [
  { method: 'GET' as const, url: '/api/cms/pages' },
  { method: 'GET' as const, url: `/api/cms/pages/${PAGE_ID}` },
]

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
})

afterAll(async () => {
  await app.close()
})

describe('a customer is not the admin of the site', () => {
  it.each(CMS_ROUTES)(
    'refuses a workspace member: $method $url',
    async ({ method, url, payload }) => {
      const res = await app.inject({ method, url, headers: as(MEMBER.token), payload })

      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ code: 'ADMIN_UNAUTHORIZED' })
    },
  )

  it.each(CMS_READS)(
    'refuses a workspace member the drafts too: $method $url',
    async ({ method, url }) => {
      const res = await app.inject({ method, url, headers: as(MEMBER.token) })

      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ code: 'ADMIN_UNAUTHORIZED' })
    },
  )

  it('the public read of a published page stays public', async () => {
    // The guard is on the ADMIN routes. The public ones are what makes the
    // site's pages readable at all — closing them would break the product.
    const res = await app.inject({ method: 'GET', url: '/api/public/cms/globals/fa' })

    expect(res.statusCode).not.toBe(403)
  })
})

describe('the platform admin still runs the site', () => {
  it('creates a page', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/pages',
      headers: as(ADMIN.token),
      payload: PAGE_BODY,
    })

    expect(res.statusCode).toBe(201)
  })

  it('lists the pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cms/pages', headers: as(ADMIN.token) })

    expect(res.statusCode).toBe(200)
  })

  it('rewrites a global', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/cms/globals/fa/greeting',
      headers: as(ADMIN.token),
      payload: { hello: 'hi' },
    })

    expect(res.statusCode).toBe(200)
  })

  it.each(CMS_ROUTES)(
    'is not refused on the write: $method $url',
    async ({ method, url, payload }) => {
      const res = await app.inject({ method, url, headers: as(ADMIN.token), payload })

      // Not 403 — the guard let it through. What the write itself answers is the
      // domain's business (a missing page is a 404, not a refusal).
      expect(res.statusCode).not.toBe(403)
      expect(res.json().code).not.toBe('ADMIN_UNAUTHORIZED')
    },
  )
})

describe('the guard is the platform one, in the source', () => {
  it('cms.routes.ts does not reach for the workspace guard', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../routes/cms.routes.ts', import.meta.url), 'utf8')
    // Comments are stripped first: the file explains the old guard in prose,
    // and a grep over the prose would pass forever without the code changing.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')

    // Every admin chain starts with the platform guard; the admin role
    // permission (RBAC) sits after it and narrows, never replaces, it.
    expect(code).toContain(
      "const ADMIN_READ = [authenticate, platformAdminGuard, requireAdminPermission('content.cms.read')]",
    )
    expect(code).toContain(
      "const ADMIN_WRITE = [authenticate, platformAdminGuard, requireAdminPermission('content.cms.write')]",
    )
    expect(code).not.toContain('requireWorkspaceContext')
  })

  it('the media upload of the content is behind the platform guard too', async () => {
    // The CMS has no media route of its own (the admin screen's upload button
    // is still dead), so the media a customer could have written went through
    // the BLOG's image upload. It is behind the platform guard — asserted
    // here so a future route cannot quietly be added beside it.
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../routes/blog.routes.ts', import.meta.url), 'utf8')
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')

    expect(code).toContain('const admin = { preHandler: [authenticate, platformAdminGuard] }')
  })
})
