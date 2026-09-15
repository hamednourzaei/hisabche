// apps/web/app/[lang]/layout.tsx

import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ClientErrorBoundary } from './client-error-boundary'
import '@hisabche/ui/globals.css'
import localFont from 'next/font/local'
import { cn } from '@hisabche/ui/utils'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import { AnalyticsPageview } from './analytics-pageview'
import { Suspense } from 'react'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { IntlProvider } from './intl-provider'
import {
  SITE_URL,
  localeMeta,
  localeToBcp47,
  localeUrl,
  languageAlternates,
  localePath,
  resolveLocale,
} from './i18n-config'

/* ═══════════════════════════════════════════════════════════════════════════
   RootLayout v8 — Fixed Favicons + PWA manifest
   ═══════════════════════════════════════════════════════════════════════════ */

const vazirmatn = localFont({
  src: [
    { path: '../../public/fonts/Vazirmatn-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', 'Tahoma'],
  preload: true,
})

const siteConfig = {
  fa: {
    title: 'حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار',
    description:
      'نرم‌افزار حسابداری، فاکتور، مدیریت انبار، بدهی مشتریان و تحلیل مالی برای کسب‌وکارهای کوچک و متوسط. رایگان شروع کنید.',
    keywords: [
      'حسابداری',
      'نرم‌افزار حسابداری',
      'حسابداری رایگان',
      'حسابداری آنلاین',
      'حسابداری آفلاین',
      'مدیریت انبار',
      'انبارداری',
      'موجودی کالا',
      'فاکتور',
      'صدور فاکتور',
      'فاکتور آنلاین',
      'مدیریت بدهی',
      'مدیریت مشتریان',
      'حسابچه',
      'نرم‌افزار حسابداری ایرانی',
      'برنامه حسابداری',
      'حسابداری فروشگاهی',
      'مدیریت کسب‌وکار',
      'گزارش مالی',
      'تحلیل مالی',
    ],
    ogTitle: 'حسابچه — نرم‌افزار حسابداری و مدیریت کسب‌وکار',
    ogDescription: 'حسابداری، فاکتور، انبار و مدیریت بدهی در یک اپ. بدون اینترنت، رایگان.',
    siteName: 'حسابچه',
    locale: 'fa',
  },
  af: {
    title: 'حسابچه — نرم‌افزار حسابداری و مدیریت تجارت',
    description:
      'نرم‌افزار حسابداری، فاکتور، مدیریت گدام، قرض مشتریان و تحلیل مالی برای تجارت‌های کوچک و متوسط. رایگان شروع کنید.',
    keywords: [
      'حسابداری',
      'نرم‌افزار حسابداری',
      'حسابداری رایگان',
      'حسابداری آنلاین',
      'حسابداری آفلاین',
      'مدیریت گدام',
      'گدامداری',
      'موجودی جنس',
      'فاکتور',
      'صدور فاکتور',
      'فاکتور آنلاین',
      'مدیریت قرض',
      'مدیریت مشتریان',
      'حسابچه',
      'نرم‌افزار حسابداری افغانستان',
      'برنامه حسابداری',
      'حسابداری دوکانداری',
      'مدیریت تجارت',
      'گزارش مالی',
      'تحلیل مالی',
    ],
    ogTitle: 'حسابچه — نرم‌افزار حسابداری و مدیریت تجارت',
    ogDescription: 'حسابداری، فاکتور، گدام و مدیریت قرض در یک اپ. بدون انترنت، رایگان.',
    siteName: 'حسابچه',
    locale: 'fa_AF',
  },
  en: {
    title: 'Hisabche — Free Accounting & Business Management Software',
    description:
      'Free accounting software with invoicing, inventory management, customer debt tracking and financial analytics for small businesses. Start free.',
    keywords: [
      'accounting software',
      'free accounting',
      'online accounting',
      'offline accounting',
      'invoicing',
      'invoice software',
      'inventory management',
      'stock management',
      'customer management',
      'debt tracking',
      'hisabche',
      'business management',
      'financial reports',
      'small business',
      'free invoice software',
      'warehouse management',
      'billing software',
      'accounting app',
      'ERP',
      'financial analytics',
    ],
    ogTitle: 'Hisabche — Free Accounting & Business Management Software',
    ogDescription:
      'Free accounting, invoicing, inventory and debt management in one app. Works offline.',
    siteName: 'Hisabche',
    locale: 'en_US',
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  // Fall back to the DEFAULT locale, not "en" — child routes (about, contact,
  // every /legal/*) already fall back to fa, and mixing the two produced
  // documents with an English <title> and a Persian description.
  const locale = resolveLocale(lang)
  const config = siteConfig[locale]

  return {
    title: { template: `%s | ${config.siteName}`, default: config.title },
    description: config.description,
    keywords: config.keywords,
    openGraph: {
      type: 'website',
      url: localeUrl(locale),
      title: config.ogTitle,
      description: config.ogDescription,
      siteName: config.siteName,
      locale: config.locale,
      // No explicit `images` — /og-image.png never existed in public/, so every
      // social card was image-less. app/[lang]/opengraph-image.tsx now generates
      // a localized card and Next attaches it to openGraph and twitter for this
      // route and all descendants. Setting `images` here would override it.
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
    icons: {
      icon: [
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
        { url: '/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
        { url: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
        { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
      shortcut: '/favicon.ico',
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      other: [{ rel: 'manifest', url: '/site.webmanifest' }],
    },
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: localePath(locale),
      languages: languageAlternates(),
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7FAF9' },
    { media: '(prefers-color-scheme: dark)', color: '#061417' },
  ],
}

/**
 * ⚠️ THE LOCALE IS HANDED OVER, NOT READ FROM THE REQUEST.
 *
 * This layout called `getLocale()` / `getMessages()` with no locale, so
 * next-intl resolved it from request HEADERS and every page under `[lang]`
 * rendered per request: production served `/fa` as `private, no-store`
 * (TTFB 1.1 s) and the build's prerender manifest held no page at all.
 *
 * `setRequestLocale(lang)` takes the locale from the ROUTE. Static params are
 * NOT declared here: at layout level they prerender every page below it, and
 * authenticated / token pages (e.g. `/fa/accept-invite`) cannot be built ahead
 * — the build refused. Public pages declare their own `generateStaticParams`.
 */
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  // Direction comes from localeMeta rather than a hardcoded `lang === "fa" ||
  // lang === "af"` check, so adding a locale can't silently ship LTR RTL text.
  const routeLocale = resolveLocale(lang)
  const dir = localeMeta[routeLocale].direction
  // `<html lang>` must be a valid BCP-47 tag. The route segment "af" is
  // Afrikaans; Dari is "fa-AF" — which is what OG locale and hreflang already
  // declared on the same page, so the document used to contradict itself.
  const htmlLang = localeToBcp47[routeLocale]
  const config = siteConfig[routeLocale]
  // Before ANY next-intl server call below — see generateStaticParams above.
  setRequestLocale(routeLocale)
  const locale = routeLocale
  const messages = await getMessages({ locale: routeLocale })

  return (
    <html
      lang={htmlLang}
      dir={dir}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(vazirmatn.variable)}
    >
      <head>
        {/* REMOVED: `<base href="/" />`.
            It made every *relative* URL on every page resolve against the site
            root instead of the current document. The site is full of fragment
            links — the footer's #features/#pricing/#security/#faq on all 45
            public pages, and FaqScene's in-page "learn more" anchors — and with
            a <base> those resolve to `https://www.hisabche.com/#features`, i.e.
            the UNPREFIXED root, which proxy.ts 307-redirects. So every one of
            those links (a) navigated the reader away from the page instead of
            scrolling, and (b) presented Google with an internal link to a
            redirect rather than to a real section. Nothing in the app needs a
            <base>: every other href here and in packages/ui is already a
            root-absolute path. */}
        {/* NOTE: /favicon.svg and /favicon.ico are both 2.2MB PNG files with the
            wrong extension. The `type="image/svg+xml"` entry that used to sit
            here made browsers fetch 2.2MB and then reject it as malformed SVG.
            The correctly-typed PNG icons below are used instead. */}
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <style>{`html{scroll-behavior:smooth}body{font-family:var(--font-sans,system-ui);background-color:hsl(var(--surface-base,192 55% 6%));color:hsl(var(--fg-primary,160 40% 98%));margin:0;padding:0;line-height:1.55;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}*{box-sizing:border-box;margin:0;padding:0}h1,.h1{font-size:clamp(2.25rem,5vw,4rem);line-height:1.2;font-weight:700}h2,.h2{font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.2;font-weight:600}p,.body{font-size:clamp(.875rem,2vw,1rem);line-height:1.65}button,[role=button]{cursor:pointer;font-family:inherit}img{max-width:100%;height:auto;display:block}html{overflow-y:scroll}:focus-visible{outline:2px solid hsl(var(--color-primary,168 84% 43%) / .5);outline-offset:2px;border-radius:6px}`}</style>
        {/* Hardcoded <link rel="alternate"> tags used to live here. They pointed
            every page on the site — including /public-invoice/[token] and the
            whole dashboard — at the three home pages, i.e. hreflang between
            pages that are not equivalents, duplicated with the tags Next
            already emits from `alternates.languages`. hreflang is now declared
            once, per route, through the Metadata API. */}
        <meta name="theme-color" content="#061417" />
        <meta name="color-scheme" content="dark light" />
        <link rel="dns-prefetch" href="https://api.hisabche.com" />
        <link rel="preconnect" href="https://api.hisabche.com" crossOrigin="anonymous" />
      </head>
      <body
        className={cn(
          'min-h-screen antialiased font-sans',
          'bg-[hsl(var(--surface-base))]',
          'text-[hsl(var(--fg-primary))]',
          vazirmatn.variable,
        )}
      >
        {/* ✅ FIX: کلید ذخیره‌سازی 'hisab-theme' بود ولی zustand زیر 'hisabche-theme'
            (به‌صورت JSON) ذخیره می‌کند — یعنی تم انتخابی کاربر بعد از رفرش خوانده
            نمی‌شد. ضمناً کلاس `light` هم باید ست شود چون توکن‌های روشن فقط زیر آن تعریف شده‌اند. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var mode='system';var raw=localStorage.getItem('hisabche-theme');if(raw){var parsed=JSON.parse(raw);mode=(parsed&&parsed.state&&parsed.state.mode)||'system'}var isDark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);var r=document.documentElement;r.classList.toggle('dark',isDark);r.classList.toggle('light',!isDark);r.setAttribute('data-theme',isDark?'dark':'light');r.style.colorScheme=isDark?'dark':'light'}catch(e){}})();`,
          }}
        />
        {/* Site-wide entity graph.
            This used to be a SECOND `SoftwareApplication` block, which (a) was a
            duplicate of the one on the landing page with a conflicting
            `operatingSystem`, (b) declared /about, /contact and every /legal/*
            page to BE the software product, and (c) shipped with
            `strategy="afterInteractive"`, so it was injected by client JS and
            absent from the server HTML crawlers read.

            Organization + WebSite are genuinely site-wide, so they belong here;
            SoftwareApplication stays on the landing page alone. `@id` values tie
            the nodes into one graph instead of leaving disconnected entities.
            Every field below is sourced from the repo — the social handles and
            support address are the ones already rendered in SiteFooter and on
            /contact. No address, phone, rating or certification is asserted,
            because none exists to assert. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${SITE_URL}/#organization`,
                  name: routeLocale === 'en' ? 'Hisabche' : 'حسابچه',
                  alternateName: routeLocale === 'en' ? 'حسابچه' : 'Hisabche',
                  url: SITE_URL,
                  logo: {
                    '@type': 'ImageObject',
                    url: `${SITE_URL}/android-chrome-512x512.png`,
                    width: 512,
                    height: 512,
                  },
                  sameAs: [
                    'https://t.me/hisabche',
                    'https://facebook.com/hisabche',
                    'https://instagram.com/hisabche',
                  ],
                  contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer support',
                    email: 'support@hisabche.com',
                    availableLanguage: ['fa', 'fa-AF', 'en'],
                  },
                },
                {
                  '@type': 'WebSite',
                  '@id': `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: config.siteName,
                  description: config.description,
                  publisher: { '@id': `${SITE_URL}/#organization` },
                  inLanguage: htmlLang,
                },
              ],
            }),
          }}
        />
        {/* ⚠️ GTAG LOADS ON FIRST ENGAGEMENT, NOT ON PAGE LOAD.
            Even with `lazyOnload` the 168 KiB gtag bundle ran 190 ms of main
            thread inside PageSpeed's window. The queue (`dataLayer` + `gtag`)
            is defined immediately, so every `gtag(...)` call — including the
            route page views — is kept and sent once the library arrives: on
            the first scroll / tap / key press, or after 12 s. Trade-off: a
            visitor who leaves within 12 s without touching the page is not
            counted. */}
        <script
          id="google-analytics"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-T5XG907W4R');(function(){var done=false,ev=['pointerdown','keydown','scroll','touchstart'];function load(){if(done)return;done=true;ev.forEach(function(e){removeEventListener(e,load)});var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-T5XG907W4R';document.head.appendChild(s)}ev.forEach(function(e){addEventListener(e,load,{once:true,passive:true})});setTimeout(load,12000)})();`,
          }}
        />
        <ClientErrorBoundary>
          {/* ✅ FIX: onError/getMessageFallback را نمی‌شود مستقیم از این
              Server Component به NextIntlClientProvider پاس داد (کرش RSC:
              "Functions cannot be passed directly to Client Components") —
              به همین خاطر در یک wrapper جدا و "use client" (IntlProvider)
              تعریف شده‌اند تا کاملاً سمت کلاینت بمانند. */}
          <IntlProvider locale={locale} messages={messages}>
            <Providers>{children}</Providers>
          </IntlProvider>
        </ClientErrorBoundary>
        <Suspense fallback={null}>
          <AnalyticsPageview />
        </Suspense>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
