// apps/web/app/[lang]/legal/legal-metadata.ts
import type { Metadata } from 'next'
import {
  type Locale,
  resolveLocale,
  localePath,
  localeUrl,
  languageAlternates,
} from '../i18n-config'

const OG_LOCALE: Record<Locale, string> = { fa: 'fa_IR', af: 'fa_AF', en: 'en_US' }

/**
 * Shared Metadata builder for every /legal/* (and other standalone public)
 * page — keeps canonical/OpenGraph/Twitter/robots consistent with the
 * convention already established in apps/web/app/[lang]/page.tsx, instead of
 * every legal sub-page re-deriving it ad hoc.
 */
export function buildLegalMetadata({
  lang,
  path,
  title,
  description,
}: {
  lang: string
  /** route path under the locale, e.g. "/legal/privacy" or "/contact" */
  path: string
  // Callers typically derive these via `titles[lang] || titles.fa` against a
  // Record<string, string> — with noUncheckedIndexedAccess that's `string |
  // undefined`, even though a default is always present at runtime.
  title: string | undefined
  description: string | undefined
}): Metadata {
  const locale = resolveLocale(lang)
  // Every locale is prefixed (proxy.ts `localePrefix: 'always'`). The previous
  // `locale === "fa" ? path : ...` emitted canonicals like "/legal/privacy" for
  // 13 fa pages — URLs that 307-redirect and so are not canonical at all.
  const canonical = localePath(locale, path)
  const url = localeUrl(locale, path)
  const safeTitle = title ?? ''
  const safeDescription = description ?? ''

  return {
    title: safeTitle,
    description: safeDescription,
    // Per-page hreflang. Without `languages` here these pages inherited the
    // root layout's set, which pointed at the three home pages — i.e. hreflang
    // between documents that are not translations of each other.
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: {
      title: safeTitle,
      description: safeDescription,
      url,
      siteName: locale === 'en' ? 'Hisabche' : 'حسابچه',
      locale: OG_LOCALE[locale],
      type: 'website',
      // Image comes from app/[lang]/opengraph-image.tsx — see the note in
      // layout.tsx. /og-image.png did not exist.
    },
    twitter: {
      card: 'summary_large_image',
      title: safeTitle,
      description: safeDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}
