import { LandingPage } from '@hisabche/ui/landing/landing-page'
import { BILLING_CURRENCY } from '@hisabche/ui-contract'
import { ScopedMessages } from './scoped-messages'
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
    title: 'نرم‌افزار حسابداری آنلاین و آفلاین — حسابچه',
    description:
      'نرم‌افزار حسابداری آنلاین و آفلاین برای کسب‌وکار: فروش، خرید، انبار، صندوق و حسابداری دوطرفه در یک سیستم؛ آنلاین در وب و بدون اینترنت در اپ.',
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
    ogTitle: 'نرم‌افزار حسابداری آنلاین و آفلاین — حسابچه',
    ogDescription:
      'فروش، خرید، انبار، صندوق و حسابداری دوطرفه در یک سیستم یکپارچه — حتی بدون اینترنت.',
    siteName: 'حسابچه',
    ogLocale: 'fa_IR',
    schemaName: 'حسابچه',
    schemaAlternateName: 'Hisabche',
    schemaDescription:
      'سیستم مدیریت کسب‌وکار با حسابداری دوطرفه، فروش، انبار و گزارش مالی برای کسب‌وکارهای کوچک و متوسط',
    schemaOperatingSystem: 'Web, iOS, Android',
  },
  af: {
    title: 'نرم‌افزار حسابداری آنلاین و آفلاین برای افغانستان — حسابچه',
    description:
      'نرم‌افزار حسابداری آنلاین و آفلاین برای تجارت‌های افغانستان: فروش، خرید، گدام، صندوق و حسابداری دوطرفه در یک سیستم؛ آنلاین در ویب و بدون انترنت در اپ.',
    keywords: [
      'نرم‌افزار حسابداری',
      'حسابداری افغانستان',
      'سیستم فروش',
      'مدیریت گدام',
      'صندوق',
      'مدیریت تجارت',
      'حسابچه',
      'hisabche',
      'حسابداری آنلاین',
      'حسابداری آفلاین',
    ],
    ogTitle: 'نرم‌افزار حسابداری آنلاین و آفلاین افغانستان — حسابچه',
    ogDescription: 'فروش، خرید، گدام، صندوق و حسابداری دوطرفه در یک سیستم؛ حتی بدون انترنت.',
    siteName: 'حسابچه',
    ogLocale: 'fa_AF',
    schemaName: 'حسابچه افغانستان',
    schemaAlternateName: 'Hisabche AF',
    schemaDescription:
      'سیستم مدیریت تجارت با حسابداری دوطرفه، فروش، گدام و راپور مالی برای تجارت‌های کوچک و متوسط',
    schemaOperatingSystem: 'Web, iOS, Android',
  },
  en: {
    title: 'Offline-First Accounting & Business OS — Hisabche',
    description:
      'The offline-first business OS: sales, inventory, till, CRM, and double-entry accounting in one system. Works in the browser, survives without internet.',
    keywords: [
      'accounting software',
      'offline-first',
      'business OS',
      'inventory management',
      'POS',
      'invoicing',
      'hisabche',
      'double-entry accounting',
      'cloud accounting',
    ],
    ogTitle: 'Offline-First Accounting & Business OS — Hisabche',
    ogDescription:
      'Sales, inventory, till, CRM, and double-entry accounting in one system — even without internet.',
    siteName: 'Hisabche',
    ogLocale: 'en_US',
    schemaName: 'Hisabche',
    schemaAlternateName: 'Hisabche',
    schemaDescription:
      'Offline-first business operating system with double-entry accounting, sales, inventory, and financial reporting for SMBs.',
    schemaOperatingSystem: 'Web, iOS, Android',
  },
} as const satisfies Record<string, PageConfigEntry>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const locale = resolveLocale(lang)
  const config = pageConfig[locale]
  const path = localePath(locale, '/')

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords.join(', '),
    alternates: {
      canonical: localeUrl(locale, '/'),
      languages: languageAlternates(path),
    },
    openGraph: {
      title: config.ogTitle,
      description: config.ogDescription,
      url: localeUrl(locale, '/'),
      siteName: config.siteName,
      locale: config.ogLocale,
      type: 'website',
      images: [
        {
          url: localeUrl(locale, '/api/og'),
          width: 1200,
          height: 630,
          alt: config.ogTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: config.ogTitle,
      description: config.ogDescription,
      images: [localeUrl(locale, '/api/og')],
      creator: '@hisabche',
    },
  }
}

function JsonLd({ lang }: { lang: string }) {
  const locale = resolveLocale(lang)
  const config = pageConfig[locale]

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: config.schemaName,
    alternateName: config.schemaAlternateName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: config.schemaOperatingSystem,
    description: config.schemaDescription,
    url: localeUrl(locale, '/'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: BILLING_CURRENCY[locale as keyof typeof BILLING_CURRENCY],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function RootPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = resolveLocale(lang)
  setRequestLocale(locale)

  return (
    <>
      <JsonLd lang={lang} />
      <ScopedMessages lang={lang} namespaces="landing-client">
        <LandingPage locale={locale} />
      </ScopedMessages>
    </>
  )
}
