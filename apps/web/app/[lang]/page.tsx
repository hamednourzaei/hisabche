// apps/web/app/[lang]/page.tsx
import { Suspense } from 'react'
import { LandingPage } from '@hisabche/ui/landing/landing-page'
import { BILLING_CURRENCY } from '@hisabche/ui-contract'
import { AuthGate } from './auth-gate'
import { ScopedMessages } from './scoped-messages'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import {
  localeUrl,
  localePath,
  languageAlternates,
  localeToBcp47,
  resolveLocale,
  SITE_URL,
  locales,
} from './i18n-config'

/* ═══════════════════════════════════════════════════════════════════════════
   RootPage — localized landing page for /, /en, /af
   ═══════════════════════════════════════════════════════════════════════════ */

export const revalidate = 3600

interface PageConfigEntry {
  title: string
  description: string
  keywords: string[]
  ogTitle: string
  ogDescription: string
  siteName: string
  ogLocale: string
  schemaName: string
  schemaAlternateName: string
  schemaDescription: string
  schemaOperatingSystem: string
}

const pageConfig = {
  fa: {
    title: 'حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار',
    description:
      'نرم‌افزار حسابداری، فاکتور، انبار و مدیریت بدهی برای کسب‌وکارهای کوچک و متوسط. رایگان شروع کنید.',
    keywords: [
      'حسابداری',
      'نرم‌افزار حسابداری',
      'مدیریت انبار',
      'فاکتور',
      'مدیریت بدهی',
      'حسابچه',
      'hisabche',
      'نرم‌افزار حسابداری رایگان',
      'مدیریت کسب‌وکار',
      'انبارداری',
      'حسابداری آنلاین',
      'حسابداری آفلاین',
      'فاکتور آنلاین',
      'مدیریت مشتریان',
    ],
    ogTitle: 'حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار',
    ogDescription: 'حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپ. بدون اینترنت، رایگان.',
    siteName: 'حسابچه',
    ogLocale: 'fa_IR',
    schemaName: 'حسابچه',
    schemaAlternateName: 'Hisabche',
    schemaDescription: 'نرم‌افزار حسابداری، مدیریت انبار و فاکتور برای کسب‌وکارهای کوچک و متوسط',
    schemaOperatingSystem: 'Web, iOS, Android',
  },
  af: {
    title: 'حسابچه — نرم‌افزار حسابداری و مدیریت تجارت',
    description:
      'نرم‌افزار حسابداری، فاکتور، گدام و مدیریت قرض برای تجارت‌های کوچک و متوسط. رایگان شروع کنید.',
    keywords: [
      'حسابداری',
      'نرم‌افزار حسابداری',
      'مدیریت گدام',
      'فاکتور',
      'مدیریت قرض',
      'حسابچه',
      'hisabche',
      'نرم‌افزار حسابداری رایگان',
      'مدیریت تجارت',
      'گدامداری',
      'حسابداری آنلاین',
      'حسابداری آفلاین',
      'فاکتور آنلاین',
      'مدیریت مشتریان',
    ],
    ogTitle: 'حسابچه — نرم‌افزار حسابداری و مدیریت تجارت',
    ogDescription: 'حسابداری، فاکتور، گدام و مدیریت قرض در یک اپ. بدون انترنت، رایگان.',
    siteName: 'حسابچه',
    ogLocale: 'fa_AF',
    schemaName: 'حسابچه',
    schemaAlternateName: 'Hisabche',
    schemaDescription: 'نرم‌افزار حسابداری، مدیریت گدام و فاکتور برای تجارت‌های کوچک و متوسط',
    schemaOperatingSystem: 'Web, iOS, Android',
  },
  en: {
    title: 'Hisabche — Free Accounting & Business Management Software',
    description:
      'Free accounting, invoicing, inventory and debt management software for small and medium businesses. Start free.',
    keywords: [
      'accounting software',
      'free accounting',
      'inventory management',
      'invoicing',
      'debt management',
      'hisabche',
      'free accounting software',
      'business management',
      'warehouse management',
      'online accounting',
      'offline accounting',
      'online invoicing',
      'customer management',
    ],
    ogTitle: 'Hisabche — Free Accounting & Business Management Software',
    ogDescription:
      'Accounting, invoicing, inventory and debt management in one app. Works offline, free.',
    siteName: 'Hisabche',
    ogLocale: 'en_US',
    schemaName: 'Hisabche',
    schemaAlternateName: 'حسابچه',
    schemaDescription:
      'Accounting, inventory and invoicing software for small and medium businesses',
    schemaOperatingSystem: 'Web, iOS, Android',
  },
} satisfies Record<'fa' | 'af' | 'en', PageConfigEntry>

function getPageConfig(lang: string): PageConfigEntry {
  // Falls back to the default locale (fa), matching every other route — the
  // previous `?? pageConfig.en` disagreed with the layout and the legal pages.
  return pageConfig[resolveLocale(lang)]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const config = getPageConfig(lang)

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    // `localePrefix: 'always'` (proxy.ts) means the fa home page is served at
    // /fa, not /. The old `canonical: "/"` therefore pointed the highest-traffic
    // locale's self-referencing canonical at a 307 redirect.
    alternates: {
      canonical: localePath(lang),
      languages: languageAlternates(),
    },
    openGraph: {
      title: config.ogTitle,
      description: config.ogDescription,
      url: localeUrl(lang),
      siteName: config.siteName,
      locale: config.ogLocale,
      type: 'website',
      // Image comes from app/[lang]/opengraph-image.tsx — see the note in
      // layout.tsx. /og-image.png did not exist.
    },
    twitter: {
      card: 'summary_large_image',
      title: config.ogTitle,
      description: config.ogDescription,
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

function JsonLd({ lang }: { lang: string }) {
  const config = getPageConfig(lang)

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          '@id': `${localeUrl(lang)}/#software`,
          name: config.schemaName,
          alternateName: config.schemaAlternateName,
          description: config.schemaDescription,
          url: localeUrl(lang),
          // `inLanguage` must be a BCP-47 tag; the route segment "af" is
          // Afrikaans, so Dari content was being declared as Afrikaans.
          inLanguage: localeToBcp47[resolveLocale(lang)],
          applicationCategory: 'BusinessApplication',
          operatingSystem: config.schemaOperatingSystem,
          publisher: { '@id': `${SITE_URL}/#organization` },
          // The free tier is real (see PLANS in packages/ui .../pricing-scene.tsx).
          // Currency was "USD" while every price on the page is rendered in
          // افغانی, so the schema contradicted the visible pricing table. The
          // code now comes from BILLING_CURRENCY — the single declaration the
          // pricing table also reads — so the two cannot drift apart again.
          offers: { '@type': 'Offer', price: '0', priceCurrency: BILLING_CURRENCY },
          // REMOVED: `aggregateRating: { ratingValue: "4.9", ratingCount: "340" }`.
          // There is no review or rating system anywhere in this codebase — the
          // numbers were hardcoded marketing copy. Google requires
          // AggregateRating to reflect genuinely collected, visible reviews;
          // emitting invented ones is a structured-data spam violation that
          // risks a manual action against the whole domain.
        }),
      }}
    />
  )
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function RootPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  setRequestLocale(resolveLocale(lang))

  return (
    <>
      <JsonLd lang={lang} />
      <ScopedMessages lang={lang} namespaces="landing-client">
        <AuthGate>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center">
                <div
                  className={cn(
                    'h-8 w-8 animate-spin rounded-full',
                    'border-2 border-[hsl(var(--color-primary))] border-t-transparent',
                  )}
                />
              </div>
            }
          >
            <LandingPage locale={resolveLocale(lang)} />
          </Suspense>
        </AuthGate>
      </ScopedMessages>
    </>
  )
}
