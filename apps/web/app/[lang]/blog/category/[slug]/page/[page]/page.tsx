import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { localePath, resolveLocale } from '../../../../../i18n-config'
import { BlogListPage, listBasePath, listMetadata, parsePageSegment } from '../../../../blog-shared'

export const revalidate = 3600 // = BLOG_REVALIDATE_SECONDS (lib/blog-api.ts); segment config must be a literal

// No path is built ahead: the API may be unreachable during `next build`, and
// an article only exists once someone publishes it. An empty list still makes
// the route ISR — rendered on its first request, then cached for `revalidate`
// (without it the route is dynamic and renders on every request).
export function generateStaticParams() {
  return []
}

type Params = Promise<{ lang: string; slug: string; page: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug, page } = await params
  const n = parsePageSegment(page)
  return n ? listMetadata(lang, { kind: 'category', slug: decodeURIComponent(slug) }, n) : {}
}

export default async function BlogCategoryPageN({ params }: { params: Params }) {
  const { lang, slug, page } = await params
  const scope = { kind: 'category' as const, slug: decodeURIComponent(slug) }
  if (page === '1') permanentRedirect(localePath(lang, listBasePath(scope)))
  const n = parsePageSegment(page)
  if (!n) notFound()
  setRequestLocale(resolveLocale(lang))
  return <BlogListPage lang={lang} scope={scope} page={n} />
}
