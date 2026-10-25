import { LandingPage } from '@hisabche/ui/landing/landing-page'
import { BILLING_CURRENCY } from '@hisabche/ui-contract'
import { ScopedMessages } from './scoped-messages'
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { localeUrl, languageAlternates, resolveLocale, SITE_URL, locales } from './i18n-config'

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
  // ⚠️ GSC 18 Oct 2026: «Not found (404) — https://hisabche.com/en/en/».
  // `languageAlternates` adds the locale itself; it was given `/en/` (already
  // prefixed), so the home page declared /fa/en/, /af/en/ and /en/en/ as its
  // translations — three 404s Google kept crawling. And the canonical with a
  // trailing slash, `/en/`, 308-redirects to `/en`: a canonical that is a redirect.
  // The home page is the bare locale: `/fa`, `/af`, `/en`.

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords.join(', '),
    alternates: {
      canonical: localeUrl(locale),
      languages: languageAlternates(),
    },
    openGraph: {
      title: config.ogTitle,
      description: config.ogDescription,
      url: localeUrl(locale),
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

  const faqItems = {
    fa: [
      {
        question: 'آیا حسابچه رایگان است؟',
        answer:
          'بله، نسخه رایگان حسابچه برای یک کسب‌وکار و امکانات اصلی کاملاً رایگان است. برای امکانات پیشرفته می‌توانید نسخه تجاری را تهیه کنید.',
      },
      {
        question: 'چطور حسابچه را شروع کنم؟',
        answer:
          'کافی است روی دکمه شروع رایگان کلیک کنید و ثبت‌نام کنید. هیچ کارت بانکی لازم ندارید.',
      },
      {
        question: 'آیا حتماً باید اینترنت داشته باشم؟',
        answer:
          'خیر. حسابچه کاملاً آفلاین کار می‌کند. می‌توانید فاکتور ثبت کنید، موجودی را بروز کنید و به محض اتصال دوباره، همه چیز به‌طور خودکار همگام‌سازی می‌شود.',
      },
      {
        question: 'اگر گوشی‌ام خراب شود، اطلاعاتم از بین می‌رود؟',
        answer:
          'خیر. تمام اطلاعات شما در سرور امن حسابچه بک‌آپ می‌شود. همچنین نسخه‌ای امن روی خود گوشی ذخیره می‌شود.',
      },
    ],
    af: [
      {
        question: 'آیا حسابچه رایگان است؟',
        answer: 'بلی، نسخه رایگان حسابچه برای یک تجارت و امکانات اصلی کاملاً رایگان است.',
      },
      {
        question: 'چطور حسابچه را شروع کنم؟',
        answer:
          'کافی است روی دکمه شروع رایگان کلیک کرده و ثبت‌نام نمایید. بدون نیاز به کارت بانکی.',
      },
      {
        question: 'آیا حتماً باید انترنت داشته باشم؟',
        answer:
          'نخیر. حسابچه کاملاً آفلاین کار می‌کند و بدون انترنت فاکتور و گدام ثبت می‌شود و با وصل مجدد همگام می‌گردد.',
      },
      {
        question: 'اگر تلفن خراب شود، معلومات از بین می‌رود؟',
        answer: 'نخیر. تمام معلومات در سرور امن حسابچه ذخیره و بک‌آپ می‌شود.',
      },
    ],
    en: [
      {
        question: 'Is Hisabche free to use?',
        answer:
          'Yes, Hisabche offers a free plan with double-entry accounting, sales, and stock management with no credit card required.',
      },
      {
        question: 'How do I get started?',
        answer: 'Click Start Free and register in 30 seconds. Your workspace is ready immediately.',
      },
      {
        question: 'Does Hisabche require an internet connection?',
        answer:
          'No. Hisabche is offline-first. You can issue sales, record purchases, and manage stock offline, automatically syncing upon reconnection.',
      },
      {
        question: 'Will my data be lost if my device is damaged?',
        answer:
          'No. Your records are encrypted and synchronized safely to the cloud with daily point-in-time backups.',
      },
    ],
  }[locale]

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: config.siteName,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.siteName,
      url: localeUrl(locale),
      inLanguage: config.ogLocale,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: config.schemaName,
      alternateName: config.schemaAlternateName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: config.schemaOperatingSystem,
      description: config.schemaDescription,
      url: localeUrl(locale),
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: BILLING_CURRENCY[locale as keyof typeof BILLING_CURRENCY],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
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
