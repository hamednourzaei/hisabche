// The goods marketplace's public pages: what the three routes share. All
// server-rendered — no client island, so no hydration and no client bundle.
//
// ⚠️ A SHOWCASE, NOT A SHOP. There is no cart, order or online payment, and no
// text or structured data here says there is (landing-claims): a listing shows
// the seller's price and how to reach the seller.
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FRACTION_DIGITS,
  formatMoney,
  resolveIntlLocale,
  type KnownCurrency,
} from '@hisabche/formatting'
import type { MarketPublicListing, MarketPublicSeller } from '@hisabche/api'

import { languageAlternates, localePath, localeUrl, type Locale } from '../i18n-config'
import type { Translate } from '../blog/blog-shared'

function isKnown(currency: string): currency is KnownCurrency {
  return Object.prototype.hasOwnProperty.call(FRACTION_DIGITS, currency)
}

/** Minor units → «12.50», by moving the point in the TEXT — never a float. */
export function minorToDecimal(minor: number, digits: number): string {
  if (digits === 0) return String(minor)
  const text = String(Math.trunc(minor)).padStart(digits + 1, '0')
  return `${text.slice(0, -digits)}.${text.slice(-digits)}`
}

/** The seller's price as a person reads it. An unknown code is shown raw, with its code. */
export function marketMoney(minor: number, currency: string, locale: Locale): string {
  if (!isKnown(currency)) return `${minor} ${currency}`
  return formatMoney(minor / 10 ** FRACTION_DIGITS[currency], currency, resolveIntlLocale(locale))
}

/**
 * The price for schema.org, which wants an ISO 4217 code.
 *
 * ⚠️ `IRT` (toman) is how Iranians price things and is NOT an ISO code; one
 * toman is ten rials by definition, so it is stated as IRR × 10 — an exact
 * integer step, not a conversion at a rate. A code we cannot state honestly
 * yields null, and the Offer is left out rather than published wrong.
 */
export function schemaPrice(
  minor: number,
  currency: string,
): { price: string; priceCurrency: string } | null {
  if (currency === 'IRT') return { price: String(minor * 10), priceCurrency: 'IRR' }
  if (!isKnown(currency) || currency.startsWith('X')) return null
  return { price: minorToDecimal(minor, FRACTION_DIGITS[currency]), priceCurrency: currency }
}

/** JSON-LD, with `<` escaped so a title cannot close the script element. */
export function JsonLd({ graph }: { graph: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
          /</g,
          '\\u003c',
        ),
      }}
    />
  )
}

export function breadcrumb(locale: Locale, trail: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: localeUrl(locale, item.path),
    })),
  }
}

export function sellerSchema(locale: Locale, seller: MarketPublicSeller) {
  return {
    '@type': 'Store',
    '@id': `${localeUrl(locale, `/market/${seller.slug}`)}#seller`,
    name: seller.name,
    url: localeUrl(locale, `/market/${seller.slug}`),
    ...(seller.description ? { description: seller.description } : {}),
    ...(seller.city || seller.country
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(seller.city ? { addressLocality: seller.city } : {}),
            ...(seller.country ? { addressCountry: seller.country } : {}),
          },
        }
      : {}),
  }
}

/** Metadata every market page shares: self-canonical, hreflang for all three, OG + Twitter. */
export function marketMetadata(input: {
  locale: Locale
  path: string
  title: string
  description: string
  image?: string | null | undefined
}): Metadata {
  const images = input.image ? [input.image] : undefined
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: localePath(input.locale, input.path),
      languages: languageAlternates(input.path),
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: localeUrl(input.locale, input.path),
      type: 'website',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: input.title,
      description: input.description,
      ...(images ? { images } : {}),
    },
    robots: { index: true, follow: true },
  }
}

/** What a closed marketplace, a missing seller or a missing listing answers with. */
export const CLOSED_METADATA: Metadata = { robots: { index: false, follow: false } }

export function ListingGrid({
  locale,
  t,
  listings,
  showSeller,
}: {
  locale: Locale
  t: Translate
  listings: MarketPublicListing[]
  showSeller: boolean
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <li key={`${listing.seller.slug}/${listing.slug}`}>
          <Link
            href={localePath(locale, `/market/${listing.seller.slug}/${listing.slug}`)}
            prefetch={false}
            className="block overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] transition-colors hover:bg-[hsl(var(--surface-muted))]"
          >
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                width={320}
                height={320}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="aspect-square w-full bg-[hsl(var(--surface-muted))]"
              />
            )}
            <div className="space-y-1 p-3">
              <h3 className="line-clamp-2 text-sm font-medium text-[hsl(var(--fg-primary))]">
                {listing.title}
              </h3>
              <p dir="ltr" className="text-start text-sm font-semibold tabular-nums">
                {marketMoney(listing.priceMinor, listing.currency, locale)}
              </p>
              {listing.availability === 'out_of_stock' ? (
                <p className="text-xs text-[hsl(var(--color-destructive))]">
                  {t('market.availability.out_of_stock')}
                </p>
              ) : null}
              {showSeller ? (
                <p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">
                  {listing.seller.name}
                  {listing.seller.verified ? ` · ${t('market.public.verified')}` : ''}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Crumbs({
  locale,
  trail,
}: {
  locale: Locale
  trail: Array<{ name: string; path?: string }>
}) {
  return (
    <nav aria-label="breadcrumb" className="text-xs text-[hsl(var(--fg-tertiary))]">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((item, index) => (
          <li key={item.name} className="flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.path !== undefined ? (
              <Link href={localePath(locale, item.path)} prefetch={false} className="underline">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
