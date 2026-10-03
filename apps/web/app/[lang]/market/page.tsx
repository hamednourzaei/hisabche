import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { fetchMarketListings } from '../../../lib/market-api'
import { BlogChrome, blogTranslator } from '../blog/blog-shared'
import { resolveLocale } from '../i18n-config'
import { CLOSED_METADATA, JsonLd, ListingGrid, breadcrumb, marketMetadata } from './market-shared'

// ISR. The marketplace is OFF by default: while it is, the API answers 404,
// this page is a 404 and carries noindex — it does not exist yet.
export const revalidate = 600 // = MARKET_REVALIDATE_SECONDS (lib/market-api.ts); must be a literal

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const locale = resolveLocale(lang)
  const result = await fetchMarketListings({})
  if (result.kind !== 'ok') return CLOSED_METADATA
  const t = await blogTranslator(locale)
  return marketMetadata({
    locale,
    path: '/market',
    title: t('market.public.title'),
    description: t('market.public.description'),
  })
}

export default async function MarketIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = resolveLocale(lang)
  setRequestLocale(locale)
  const result = await fetchMarketListings({})
  if (result.kind !== 'ok') notFound()
  const t = await blogTranslator(locale)
  const { listings } = result.data

  return (
    <BlogChrome locale={locale} t={t}>
      <JsonLd
        graph={[
          breadcrumb(locale, [
            { name: t('app.name'), path: '' },
            { name: t('market.public.title'), path: '/market' },
          ]),
        ]}
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] sm:text-3xl">
            {t('market.public.title')}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('market.public.intro')}</p>
        </header>
        {listings.length === 0 ? (
          // Open, and nothing listed yet — a different answer from «closed».
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">{t('market.public.empty')}</p>
        ) : (
          <ListingGrid locale={locale} t={t} listings={listings} showSeller />
        )}
      </main>
    </BlogChrome>
  )
}
