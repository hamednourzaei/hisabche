import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { fetchMarketListing } from '../../../../../lib/market-api'
import { BlogChrome, blogTranslator } from '../../../blog/blog-shared'
import { localePath, localeUrl, resolveLocale } from '../../../i18n-config'
import {
  CLOSED_METADATA,
  Crumbs,
  JsonLd,
  breadcrumb,
  marketMetadata,
  marketMoney,
  schemaPrice,
  sellerSchema,
} from '../../market-shared'

export const revalidate = 600 // = MARKET_REVALIDATE_SECONDS; must be a literal

export function generateStaticParams() {
  return []
}

type Params = Promise<{ lang: string; seller: string; listing: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, seller, listing } = await params
  const locale = resolveLocale(lang)
  const result = await fetchMarketListing(seller, listing)
  if (result.kind !== 'ok') return CLOSED_METADATA
  const item = result.data
  const t = await blogTranslator(locale)
  const names = { title: item.title, seller: item.seller.name }
  return marketMetadata({
    locale,
    path: `/market/${item.seller.slug}/${item.slug}`,
    title: item.seoTitle || t('market.public.listingTitle', names),
    description:
      item.seoDescription ||
      item.description.slice(0, 155) ||
      t('market.public.listingDescription', names),
    image: item.images[0]?.url ?? null,
  })
}

export default async function MarketListingPage({ params }: { params: Params }) {
  const { lang, seller, listing } = await params
  const locale = resolveLocale(lang)
  setRequestLocale(locale)
  const result = await fetchMarketListing(seller, listing)
  if (result.kind !== 'ok') notFound()
  const t = await blogTranslator(locale)
  const item = result.data
  const path = `/market/${item.seller.slug}/${item.slug}`
  const price = schemaPrice(item.priceMinor, item.currency)

  return (
    <BlogChrome locale={locale} t={t}>
      <JsonLd
        graph={[
          {
            '@type': 'Product',
            '@id': `${localeUrl(locale, path)}#product`,
            name: item.title,
            url: localeUrl(locale, path),
            ...(item.description ? { description: item.description } : {}),
            ...(item.images.length > 0 ? { image: item.images.map((image) => image.url) } : {}),
            // The seller's stated price. No Offer when the currency cannot be
            // stated in ISO 4217 — a wrong price in search is worse than none.
            ...(price
              ? {
                  offers: {
                    '@type': 'Offer',
                    url: localeUrl(locale, path),
                    price: price.price,
                    priceCurrency: price.priceCurrency,
                    availability:
                      item.availability === 'in_stock'
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/OutOfStock',
                    seller: { '@id': `${localeUrl(locale, `/market/${item.seller.slug}`)}#seller` },
                  },
                }
              : {}),
          },
          sellerSchema(locale, item.seller),
          breadcrumb(locale, [
            { name: t('market.public.title'), path: '/market' },
            { name: item.seller.name, path: `/market/${item.seller.slug}` },
            { name: item.title, path },
          ]),
        ]}
      />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <Crumbs
          locale={locale}
          trail={[
            { name: t('market.public.title'), path: '/market' },
            { name: item.seller.name, path: `/market/${item.seller.slug}` },
            { name: item.title },
          ]}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            {item.images.length === 0 ? (
              <div
                aria-hidden="true"
                className="aspect-square w-full rounded-xl bg-[hsl(var(--surface-muted))]"
              />
            ) : (
              item.images.map((image, index) => (
                <img
                  key={image.url}
                  src={image.url}
                  alt={image.altText || item.title}
                  width={640}
                  height={640}
                  // The first image is the page's largest paint; the rest wait.
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))
            )}
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{item.title}</h1>
            <p dir="ltr" className="text-start text-xl font-semibold tabular-nums">
              {marketMoney(item.priceMinor, item.currency, locale)}
            </p>
            <p className="text-sm">
              {t(`market.availability.${item.availability}`)}
              {item.quantity !== null && item.availability === 'in_stock'
                ? ` · ${t('market.public.quantity', { count: item.quantity })}`
                : ''}
            </p>
            {item.description ? (
              <p className="whitespace-pre-line text-sm text-[hsl(var(--fg-secondary))]">
                {item.description}
              </p>
            ) : null}
            <section className="space-y-1 rounded-xl border border-[hsl(var(--border-default))] p-4 text-sm">
              <h2 className="font-semibold">{t('market.public.seller')}</h2>
              <Link
                href={localePath(locale, `/market/${item.seller.slug}`)}
                prefetch={false}
                className="text-[hsl(var(--color-primary))] underline"
              >
                {item.seller.name}
              </Link>
              {item.seller.verified ? <span> · {t('market.public.verified')}</span> : null}
              {/* The honest next step: there is no online ordering — the
                  buyer reaches the seller. */}
              <p className="text-[hsl(var(--fg-secondary))]">{t('market.public.howToBuy')}</p>
              {item.seller.contact ? <p dir="auto">{item.seller.contact}</p> : null}
            </section>
          </div>
        </div>
      </main>
    </BlogChrome>
  )
}
