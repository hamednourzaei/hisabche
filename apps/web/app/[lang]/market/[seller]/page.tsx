import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { fetchMarketListings, fetchMarketSeller } from '../../../../lib/market-api'
import { BlogChrome, blogTranslator } from '../../blog/blog-shared'
import { resolveLocale } from '../../i18n-config'
import {
  CLOSED_METADATA,
  Crumbs,
  JsonLd,
  ListingGrid,
  breadcrumb,
  marketMetadata,
  sellerSchema,
} from '../market-shared'

export const revalidate = 600 // = MARKET_REVALIDATE_SECONDS; must be a literal

export function generateStaticParams() {
  return []
}

type Params = Promise<{ lang: string; seller: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, seller: slug } = await params
  const locale = resolveLocale(lang)
  const seller = await fetchMarketSeller(slug)
  if (seller.kind !== 'ok') return CLOSED_METADATA
  const t = await blogTranslator(locale)
  return marketMetadata({
    locale,
    path: `/market/${seller.data.slug}`,
    title: t('market.public.sellerTitle', { name: seller.data.name }),
    description:
      seller.data.description || t('market.public.sellerDescription', { name: seller.data.name }),
  })
}

export default async function MarketSellerPage({ params }: { params: Params }) {
  const { lang, seller: slug } = await params
  const locale = resolveLocale(lang)
  setRequestLocale(locale)
  const [seller, list] = await Promise.all([
    fetchMarketSeller(slug),
    fetchMarketListings({ seller: slug }),
  ])
  if (seller.kind !== 'ok' || list.kind !== 'ok') notFound()
  const t = await blogTranslator(locale)
  const shop = seller.data
  const place = [shop.city, shop.country].filter(Boolean).join(' · ')

  return (
    <BlogChrome locale={locale} t={t}>
      <JsonLd
        graph={[
          sellerSchema(locale, shop),
          breadcrumb(locale, [
            { name: t('market.public.title'), path: '/market' },
            { name: shop.name, path: `/market/${shop.slug}` },
          ]),
        ]}
      />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <Crumbs
          locale={locale}
          trail={[{ name: t('market.public.title'), path: '/market' }, { name: shop.name }]}
        />
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))] sm:text-3xl">
            {shop.name}
          </h1>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {[place, shop.verified ? t('market.public.verified') : ''].filter(Boolean).join(' · ')}
          </p>
          {shop.description ? (
            <p className="whitespace-pre-line text-sm text-[hsl(var(--fg-secondary))]">
              {shop.description}
            </p>
          ) : null}
          {shop.contact ? (
            <p className="text-sm">
              {t('market.public.contact')}: <span dir="auto">{shop.contact}</span>
            </p>
          ) : null}
        </header>
        {list.data.listings.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">{t('market.public.sellerEmpty')}</p>
        ) : (
          <ListingGrid locale={locale} t={t} listings={list.data.listings} showSeller={false} />
        )}
      </main>
    </BlogChrome>
  )
}
