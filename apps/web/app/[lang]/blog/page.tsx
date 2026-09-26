import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../i18n-config'
import { BlogListPage, listMetadata } from './blog-shared'

// ISR: built on the first request per locale, refreshed hourly or at once on
// an admin change (/api/revalidate → the `blog` tag). No <Suspense> around
// the page and no search params — both would make it dynamic.
export const revalidate = 3600 // = BLOG_REVALIDATE_SECONDS (lib/blog-api.ts); segment config must be a literal

// No path is built ahead: the API may be unreachable during `next build`, and
// an article only exists once someone publishes it. An empty list still makes
// the route ISR — rendered on its first request, then cached for `revalidate`
// (without it the route is dynamic and renders on every request).
export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return listMetadata(lang, { kind: 'all' }, 1)
}

export default async function BlogIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  setRequestLocale(resolveLocale(lang))
  return <BlogListPage lang={lang} scope={{ kind: 'all' }} page={1} />
}
