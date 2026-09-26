// ============================================
// Blog Core — the rules that decide what reaches a reader's browser.
//
// The sanitiser is the only door into `content_html`; these are the vectors it
// must close. The service tests use a fake repository so each rule is checked
// on its own: honeypot, reply depth, alt text, taxonomy language, image bytes.
// ============================================

import { describe, expect, it, vi } from 'vitest'
import { blogPostInputSchema, seoChecklist } from '@hisabche/validation'

import {
  BlogError,
  headingSlug,
  linkDecision,
  readingMinutes,
  resolvePublication,
  sniffImageType,
  tocOf,
  withHeadingIds,
} from '../services/blog/blog.domain'
import { sanitizeArticleHtml } from '../services/blog/blog.sanitize'
import { BlogService } from '../services/blog/blog.service'
import type { BlogRepository } from '../services/blog/blog.repository'

const NOW = new Date('2026-09-26T12:00:00Z')

describe('publication', () => {
  it('«published» with a future date is stored as scheduled', () => {
    expect(resolvePublication('published', '2026-10-01T00:00:00Z', NOW)).toEqual({
      status: 'scheduled',
      publishedAt: '2026-10-01T00:00:00.000Z',
    })
  })

  it('«published» with no date is published now; keeps an earlier publication date', () => {
    expect(resolvePublication('published', null, NOW)).toEqual({
      status: 'published',
      publishedAt: NOW.toISOString(),
    })
    expect(resolvePublication('published', null, NOW, '2026-01-01T00:00:00.000Z').publishedAt).toBe(
      '2026-01-01T00:00:00.000Z',
    )
  })

  it('«scheduled» in the past is simply published', () => {
    expect(resolvePublication('scheduled', '2026-09-01T00:00:00Z', NOW).status).toBe('published')
  })

  it('a draft keeps its old date and is never public', () => {
    expect(resolvePublication('draft', null, NOW, '2026-01-01T00:00:00.000Z')).toEqual({
      status: 'draft',
      publishedAt: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('reading time and headings', () => {
  it('200 words a minute, never less than one', () => {
    expect(readingMinutes('<p>کوتاه</p>')).toBe(1)
    expect(readingMinutes(`<p>${'واژه '.repeat(401)}</p>`)).toBe(3)
  })

  it('every heading gets a unique id; the outline lists h2 and h3', () => {
    const { html, toc } = withHeadingIds(
      '<h2 id="evil">فاکتور چیست</h2><h3>انواع</h3><h2>فاکتور چیست</h2><h4>ریز</h4>',
    )
    expect(html).toContain('<h2 id="فاکتور-چیست">')
    expect(html).toContain('<h2 id="فاکتور-چیست-2">')
    expect(html).not.toContain('evil')
    expect(toc.map((t) => [t.level, t.id])).toEqual([
      [2, 'فاکتور-چیست'],
      [3, 'انواع'],
      [2, 'فاکتور-چیست-2'],
    ])
    expect(tocOf(html)).toEqual(toc)
  })

  it('heading ids keep Persian letters and turn the zero-width joiner into a hyphen', () => {
    expect(headingSlug('نرم‌افزار حسابداری')).toBe('نرم-افزار-حسابداری')
    expect(headingSlug('!!!')).toBe('section')
  })
})

describe('links inside an article', () => {
  it('an internal path without a locale gets the article’s locale', () => {
    expect(linkDecision('/features/invoicing', 'af')).toMatchObject({
      href: '/af/features/invoicing',
      rel: null,
      localeAdded: true,
    })
  })

  it('a link into the private app is nofollow (§8); a public page is followed', () => {
    expect(linkDecision('/fa/dashboard', 'fa').rel).toBe('nofollow')
    expect(linkDecision('/fa/signup', 'fa').rel).toBe('nofollow')
    expect(linkDecision('/en/blog/invoice-template', 'en').rel).toBeNull()
    expect(linkDecision('https://hisabche.com/fa/features/offline', 'fa').rel).toBeNull()
  })

  it('external links open in a new tab with noopener and stay followed (sources)', () => {
    expect(linkDecision('https://ard.gov.af/guide', 'af')).toEqual({
      href: 'https://ard.gov.af/guide',
      rel: 'noopener noreferrer',
      target: '_blank',
      localeAdded: false,
    })
  })
})

describe('the sanitiser — the only door into content_html', () => {
  const clean = (html: string) => sanitizeArticleHtml(html, 'fa').html

  it.each([
    ['<script>alert(1)</script><p>x</p>', '<p>x</p>'],
    ['<p onclick="steal()">x</p>', '<p>x</p>'],
    ['<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
    ['<iframe src="https://evil"></iframe><p>x</p>', '<p>x</p>'],
    ['<style>body{display:none}</style><p>x</p>', '<p>x</p>'],
    ['<p style="color:red;background:url(x)">x</p>', '<p>x</p>'],
  ])('strips %s', (input, expected) => {
    expect(clean(input)).toBe(expected)
  })

  it('an image from http: or data: is dropped entirely', () => {
    expect(clean('<img src="data:image/png;base64,AAAA" alt="a"><p>x</p>')).toBe('<p>x</p>')
    expect(clean('<img src="http://x/y.png" alt="a"><p>x</p>')).toBe('<p>x</p>')
  })

  it('keeps ONLY the project fonts and the type scale', () => {
    expect(clean('<p><span style="font-family: var(--font-sans)">a</span></p>')).toContain(
      'font-family:var(--font-sans)',
    )
    expect(clean('<p><span style="font-size: 1.25rem">a</span></p>')).toContain('font-size:1.25rem')
    expect(clean('<p><span style="font-family: Comic Sans MS">a</span></p>')).toBe(
      '<p><span>a</span></p>',
    )
    expect(clean('<p><span style="font-size: 72px">a</span></p>')).toBe('<p><span>a</span></p>')
  })

  it('an h1 in the body becomes an h2 (the title is the page’s only h1)', () => {
    expect(clean('<h1>بخش</h1>')).toBe('<h2 id="بخش">بخش</h2>')
  })

  it('dir survives only as rtl/ltr/auto', () => {
    expect(clean('<p dir="rtl">x</p>')).toBe('<p dir="rtl">x</p>')
    expect(clean('<p dir="sideways">x</p>')).toBe('<p>x</p>')
  })

  it('⚠️ an image without alt text is REFUSED, not silently kept', () => {
    const result = sanitizeArticleHtml(
      '<img src="https://cdn.x/a.png" alt="نمودار"><img src="https://cdn.x/b.png">',
      'fa',
    )
    expect(result.errors).toEqual([{ path: 'contentHtml', message: 'blog.errors.imageAlt:2' }])
    expect(result.html).toContain('loading="lazy"')
  })

  it('a link that needed its locale added is reported to the admin, not silently changed', () => {
    const result = sanitizeArticleHtml('<p><a href="/docs/x">راهنما</a></p>', 'en')
    expect(result.html).toBe('<p><a href="/en/docs/x">راهنما</a></p>')
    expect(result.warnings).toEqual([
      { path: 'contentHtml', message: 'blog.warnings.linkLocaleAdded:/en/docs/x' },
    ])
  })
})

describe('image bytes, not the claimed type', () => {
  it('recognises the four allowed formats', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(Buffer.from('89504e470d0a1a0a0000', 'hex'))).toBe('image/png')
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary'))).toBe('image/webp')
    expect(sniffImageType(Buffer.from('\0\0\0\x1cftypavif', 'binary'))).toBe('image/avif')
  })

  it('an SVG or HTML file renamed .png is not an image', () => {
    expect(sniffImageType(Buffer.from('<svg onload="x()"></svg>'))).toBeNull()
    expect(sniffImageType(Buffer.from('<html><script>'))).toBeNull()
  })
})

// ─── service, with a fake repository ─────────────────────────────────────────

function fakeRepo(overrides: Partial<Record<keyof BlogRepository, unknown>> = {}) {
  const repo = {
    isPublic: vi.fn(async () => true),
    findComment: vi.fn(async () => null),
    insertComment: vi.fn(
      async (input: { postId: string; userId: string; parentId: string | null; body: string }) => ({
        id: 'c-new',
        post_id: input.postId,
        user_id: input.userId,
        parent_id: input.parentId,
        body: input.body,
        status: 'pending',
        created_at: NOW.toISOString(),
      }),
    ),
    authorNames: vi.fn(async () => new Map([['u-1', 'علی']])),
    findById: vi.fn(async () => null),
    taxonomyByIds: vi.fn(async () => new Map()),
    savePost: vi.fn(async () => 'p-1'),
    uploadImage: vi.fn(async () => 'https://storage/blog-images/x.png'),
    ...overrides,
  }
  return repo
}

const service = (repo: ReturnType<typeof fakeRepo>) =>
  new BlogService(repo as unknown as BlogRepository, () => NOW)

const POST = '11111111-1111-4111-8111-111111111111'

describe('comments', () => {
  it('⚠️ a tripped honeypot stores nothing and looks like success', async () => {
    const repo = fakeRepo()
    const result = await service(repo).addComment(POST, 'u-1', {
      body: 'buy now',
      website: 'http://spam',
    })
    expect(result).toEqual({ comment: null })
    expect(repo.insertComment).not.toHaveBeenCalled()
  })

  it('a comment is stored for the TOKEN’s user and waits for moderation', async () => {
    const repo = fakeRepo()
    const { comment } = await service(repo).addComment(POST, 'u-1', { body: 'سؤال دارم' })
    expect(repo.insertComment).toHaveBeenCalledWith({
      postId: POST,
      userId: 'u-1',
      parentId: null,
      body: 'سؤال دارم',
    })
    expect(comment).toMatchObject({ status: 'pending', authorName: 'علی' })
  })

  it('a reply to a pending, nested or foreign comment is refused', async () => {
    const parents = [
      { post_id: POST, parent_id: null, status: 'pending' },
      { post_id: POST, parent_id: 'x', status: 'approved' },
      { post_id: 'other', parent_id: null, status: 'approved' },
    ]
    for (const parent of parents) {
      const repo = fakeRepo({ findComment: vi.fn(async () => ({ id: 'p', ...parent })) })
      await expect(
        service(repo).addComment(POST, 'u-1', {
          body: 'پاسخ',
          parentId: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toMatchObject({ code: 'BLOG_COMMENT_REPLY_INVALID' })
    }
  })

  it('a draft cannot be commented on', async () => {
    const repo = fakeRepo({ isPublic: vi.fn(async () => false) })
    await expect(service(repo).addComment(POST, 'u-1', { body: 'x y' })).rejects.toBeInstanceOf(
      BlogError,
    )
  })
})

describe('saving a post', () => {
  const input = (over: Record<string, unknown> = {}) =>
    blogPostInputSchema.parse({
      locale: 'fa',
      slug: 'what-is-a-sales-invoice',
      title: 'فاکتور فروش چیست',
      contentJson: { type: 'doc' },
      contentHtml: '<p>متن</p>',
      ...over,
    })
  const log = { warn: vi.fn() }

  it('an image without alt text refuses the save; nothing is written', async () => {
    const repo = fakeRepo()
    await expect(
      service(repo).save(
        null,
        input({ contentHtml: '<img src="https://x/a.png">' }),
        'admin-1',
        log,
      ),
    ).rejects.toMatchObject({ code: 'BLOG_CONTENT_INVALID' })
    expect(repo.savePost).not.toHaveBeenCalled()
  })

  it('a tag in another language is refused', async () => {
    const tag = '33333333-3333-4333-8333-333333333333'
    const repo = fakeRepo({
      taxonomyByIds: vi.fn(
        async () => new Map([[tag, { id: tag, locale: 'en', slug: 't', name: 't' }]]),
      ),
    })
    await expect(
      service(repo).save(null, input({ tagIds: [tag] }), 'admin-1', log),
    ).rejects.toMatchObject({
      code: 'BLOG_TAXONOMY_NOT_FOUND',
      details: [{ path: 'tagIds', message: 'blog.errors.taxonomyLocale' }],
    })
  })

  it('stores sanitised HTML, the computed reading time and the author; «published» in the future is scheduled', async () => {
    const savePost = vi.fn(async (..._args: unknown[]) => 'p-1')
    const repo = fakeRepo({
      savePost,
      findById: vi.fn(async (id: string) =>
        id === 'p-1'
          ? {
              id: 'p-1',
              locale: 'fa',
              slug: 's',
              title: 't',
              excerpt: null,
              content_html: '',
              cover_url: null,
              cover_alt: null,
              published_at: null,
              updated_at: NOW.toISOString(),
              reading_minutes: 1,
              status: 'scheduled',
              noindex: false,
              category_id: null,
              translation_group_id: 'g',
              content_json: {},
              faq: [],
              meta_title: null,
              meta_description: null,
              focus_keyword: null,
              keywords: [],
              canonical_url: null,
              og_image_url: null,
              author_id: 'admin-1',
              created_at: NOW.toISOString(),
            }
          : null,
      ),
      tagsOfPosts: vi.fn(async () => new Map()),
      tagIdsOf: vi.fn(async () => []),
      stats: vi.fn(async () => new Map()),
      translationsOf: vi.fn(async () => []),
    })
    await service(repo).save(
      null,
      input({
        contentHtml: '<script>x</script><p>متن</p>',
        status: 'published',
        publishedAt: '2026-10-01T08:00:00Z',
      }),
      'admin-1',
      log,
    )
    const [, fields] = savePost.mock.calls[0] as [null, Record<string, unknown>]
    expect(fields).toMatchObject({
      content_html: '<p>متن</p>',
      status: 'scheduled',
      published_at: '2026-10-01T08:00:00.000Z',
      reading_minutes: 1,
      author_id: 'admin-1',
    })
  })
})

describe('image upload', () => {
  it('refuses a file whose bytes are not the type it claims', async () => {
    const repo = fakeRepo()
    await expect(
      service(repo).uploadImage({
        fileName: 'x.png',
        mimeType: 'image/png',
        contentBase64: Buffer.from('<svg onload="x()"/>').toString('base64'),
      }),
    ).rejects.toMatchObject({ code: 'BLOG_IMAGE_INVALID' })
    expect(repo.uploadImage).not.toHaveBeenCalled()
  })
})

describe('SEO checklist (guidance, shared with the admin editor)', () => {
  it('measures what it says and never throws on empty input', () => {
    const checks = seoChecklist({
      title: 'فاکتور فروش چیست',
      metaTitle: null,
      metaDescription: null,
      focusKeyword: 'فاكتور فروش',
      html: '<p>فاکتور فروش سندی است.</p><h2>انواع فاکتور فروش</h2><img src="x"><a href="/fa/blog/a">a</a>',
      locale: 'fa',
    })
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
    // Arabic kaf in the keyword still matches the Persian text.
    expect(byId.keywordInTitle!.pass).toBe(true)
    expect(byId.keywordInFirstParagraph!.pass).toBe(true)
    expect(byId.keywordInHeading!.pass).toBe(true)
    expect(byId.imageAlt).toMatchObject({ pass: false, value: 1 })
    expect(byId.internalLinks).toMatchObject({ pass: false, value: 1 })
    expect(
      seoChecklist({
        title: '',
        metaTitle: null,
        metaDescription: null,
        focusKeyword: null,
        html: '',
        locale: 'en',
      }),
    ).toHaveLength(9)
  })
})
