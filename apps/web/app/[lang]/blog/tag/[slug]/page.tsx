import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../../../i18n-config'
import { BlogListPage, listMetadata } from '../../blog-shared'

// A tag with fewer than three articles is noindex (listMetadata) and left out
// of the sitemap — a thin list is not a page worth ranking.
export const revalidate = 3600 // = BLOG_REVALIDATE_SECONDS (lib/blog-api.ts); segment config must be a literal

type Params = Promise<{ lang: string; slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params
  return listMetadata(lang, { kind: 'tag', slug: decodeURIComponent(slug) }, 1)
}

export default async function BlogTagPage({ params }: { params: Params }) {
  const { lang, slug } = await params
  setRequestLocale(resolveLocale(lang))
  return (
    <BlogListPage lang={lang} scope={{ kind: 'tag', slug: decodeURIComponent(slug) }} page={1} />
  )
}
