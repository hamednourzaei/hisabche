// ============================================
// backend/src/services/cms/cms.service.ts
//
// The CMS is PLATFORM content, not workspace content: the pages, the globals
// and the media belong to the site, and their tables carry no `workspace_id`
// (docs/cms-foundation-migration.sql).
//
// ⚠️ THE ACTOR, NOT A TENANCY.
//
// This service used to take a `TenancyContext` and call `assertGlobalAdmin` —
// a function that asserted nothing, whose own comment said it relied on the
// route's guard. The route's guard was `requireWorkspaceContext`, so ANY
// customer with a workspace could create, edit, publish and archive the
// site's pages, and rewrite its globals.
//
// The guard is now the platform-admin one (routes/cms.routes.ts), and the
// service takes the **actor's user id** — which is all it ever needed (the
// author of a page, the publisher of a page). There is no workspace here to
// scope anything by, and inventing one (`workspaceId: ''`) is the fail-open
// tenancy value the auth middleware warns about.
// ============================================

import { ForbiddenError } from '../../errors/auth.error'
import { ValidationError } from '../../errors/validation.error'

import { isSlugReserved, pageInputSchema, PageInput, validatePageSections } from './cms.domain'
import { CmsRepository, CmsPageRow } from './cms.repository'

export class CmsService {
  constructor(private readonly repo: CmsRepository) {}

  async listPages(locale?: string, status?: string) {
    return this.repo.listPages(locale, status)
  }

  async getPage(id: string) {
    return this.repo.getPage(id)
  }

  async getPublishedPageByUrl(locale: string, slug: string) {
    // Public unauthenticated read
    const page = await this.repo.getPageByUrl(locale, slug)
    if (page.status !== 'published') {
      throw new ForbiddenError('PAGE_NOT_PUBLISHED')
    }
    return page
  }

  async createPage(actorUserId: string, input: PageInput) {
    const data = pageInputSchema.parse(input)

    if (isSlugReserved(data.slug)) {
      throw new ValidationError(`Slug '${data.slug}' is reserved by the application.`)
    }

    const sectionErrors = validatePageSections(data.sections)
    if (sectionErrors.length > 0) {
      throw new ValidationError(`Section validation failed:\n${sectionErrors.join('\n')}`)
    }

    const payload: Partial<CmsPageRow> = {
      ...data,
      created_by: actorUserId,
    }

    return this.repo.createPage(payload)
  }

  async updatePage(id: string, input: PageInput) {
    const data = pageInputSchema.parse(input)

    if (isSlugReserved(data.slug)) {
      throw new ValidationError(`Slug '${data.slug}' is reserved by the application.`)
    }

    const sectionErrors = validatePageSections(data.sections)
    if (sectionErrors.length > 0) {
      throw new ValidationError(`Section validation failed:\n${sectionErrors.join('\n')}`)
    }

    const payload: Partial<CmsPageRow> = {
      ...data,
    }

    return this.repo.updatePage(id, payload)
  }

  async publishPage(actorUserId: string, id: string) {
    // The version snapshot is still not written here — the same gap as before,
    // unchanged by the guard. Recorded rather than silently inherited.
    return this.repo.updatePage(id, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: actorUserId,
    })
  }

  async archivePage(id: string) {
    return this.repo.updatePage(id, {
      status: 'archived',
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GLOBALS / REMOTE CONTENT SNIPPETS
  // ═══════════════════════════════════════════════════════════════════════

  async getPublishedGlobals(locale: string) {
    // Unauthenticated public read for Apps (Android/Windows/Web)
    return this.repo.listGlobals(locale)
  }

  async upsertGlobal(
    actorUserId: string,
    locale: string,
    key: string,
    content: Record<string, unknown>,
  ) {
    return this.repo.upsertGlobal(locale, key, content, actorUserId)
  }
}
