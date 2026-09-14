// packages/ui/src/components/ui/landing/site-footer.tsx
'use client'

import Link from 'next/link'
import { cn } from '../../../lib/utils'
import { useNow } from '../../../hooks/use-now'
import { Send } from 'lucide-react'
import { FaInstagram, FaFacebook } from 'react-icons/fa6'

/* ═══════════════════════════════════════════════════════════════════════════
   SiteFooter v2 — Large SEO footer.
   Columns map to real search intent (product, features, industries, learning)
   rather than generic "Company / Legal" filler — every link is something a
   prospective user would plausibly search for.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SiteFooterProps {
  t: (key: string, fallback?: string) => string
  /**
   * Locale segment to prefix route links with, e.g. "fa". On web the middleware
   * runs with `localePrefix: 'always'`, so a bare `/about` is a 307 to
   * `/{detected-locale}/about` — which both costs every internal link a
   * redirect hop and lets Accept-Language override the locale the visitor is
   * actually reading. Desktop mounts the same footer through its own router
   * with no locale prefix, so this stays optional and defaults to no prefix.
   */
  localePrefix?: string
}

interface FooterLink {
  key: string
  fallback: string
  href: string
}

interface FooterColumn {
  titleKey: string
  titleFallback: string
  links: FooterLink[]
}

const COLUMNS: FooterColumn[] = [
  {
    titleKey: 'landing.footerColProduct',
    titleFallback: 'محصول',
    links: [
      { key: 'features', fallback: 'امکانات', href: '#features' },
      { key: 'pricing', fallback: 'قیمت‌گذاری', href: '#pricing' },
      { key: 'security', fallback: 'امنیت داده', href: '#security' },
      { key: 'faq', fallback: 'سوالات متداول', href: '#faq' },
      // Real routes, not in-page anchors — these are the site's only indexable
      // pages targeting a specific search intent, so they need a crawlable
      // link from every page that renders the footer.
      {
        key: 'customerDebt',
        fallback: 'دفتر نسیه و بدهی مشتریان',
        href: '/features/customer-debt',
      },
      { key: 'offline', fallback: 'حسابداری آفلاین', href: '/features/offline' },
      {
        key: 'shopAccountingPage',
        fallback: 'نرم‌افزار حسابداری فروشگاهی',
        href: '/features/shop-accounting',
      },
      { key: 'invoicingPage', fallback: 'صدور فاکتور آنلاین', href: '/features/invoicing' },
      { key: 'inventoryPage', fallback: 'انبارداری ساده', href: '/features/inventory' },
      { key: 'daybookPage', fallback: 'دفتر روزنامه و سود و زیان', href: '/features/daybook' },
    ],
  },
  {
    titleKey: 'landing.footerColCompany',
    titleFallback: 'شرکت',
    links: [
      // T12 — the docs are public; a visitor evaluating the product should be
      // able to read them before signing up.
      // Straight to the article — `/docs` is a redirect, and making every reader
      // in the footer take an extra hop is pointless.
      { key: 'docs', fallback: 'راهنما', href: '/docs/getting-started' },
      { key: 'about', fallback: 'درباره ما', href: '/about' },
      { key: 'contact', fallback: 'تماس با ما', href: '/contact' },
    ],
  },
  {
    titleKey: 'landing.footerColLegal',
    titleFallback: 'قانونی',
    links: [
      { key: 'terms', fallback: 'شرایط استفاده', href: '/legal/terms' },
      { key: 'privacy', fallback: 'حریم خصوصی', href: '/legal/privacy' },
      { key: 'cookies', fallback: 'سیاست کوکی', href: '/legal/cookies' },
      { key: 'refund', fallback: 'بازگشت وجه', href: '/legal/refund' },
      { key: 'disclaimer', fallback: 'سلب مسئولیت', href: '/legal/disclaimer' },
      { key: 'copyright', fallback: 'حق نشر', href: '/legal/copyright' },
      { key: 'security', fallback: 'امنیت', href: '/legal/security' },
      { key: 'accessibility', fallback: 'دسترسی‌پذیری', href: '/legal/accessibility' },
      { key: 'gdpr', fallback: 'حقوق حریم خصوصی', href: '/legal/gdpr' },
      { key: 'dataDeletion', fallback: 'درخواست حذف داده', href: '/legal/data-deletion' },
    ],
  },
]

const SOCIALS = [
  { icon: Send, label: 'Telegram', href: 'https://t.me/hisabche' },
  { icon: FaFacebook, label: 'Facebook', href: 'https://facebook.com/hisabche' },
  { icon: FaInstagram, label: 'Instagram', href: 'https://instagram.com/hisabche' },
]

export default function SiteFooter({ t, localePrefix }: SiteFooterProps) {
  /**
   * `#features`, `#pricing`, `#security` and `#faq` are sections of the LANDING
   * page, but this footer renders on all 45 public pages. A bare "#features" is
   * therefore a dead anchor on /about, /contact and every /legal/* page — the
   * element it names does not exist there.
   *
   * (It previously "worked" only by accident: the root layout carried
   * `<base href="/">`, which rebased every fragment onto the site root. That
   * turned each of these into a link to "/#features" — the unprefixed root,
   * which proxy.ts 307-redirects — so on the landing page itself the link
   * navigated away instead of scrolling. The <base> tag is gone; these are now
   * written out explicitly.)
   *
   * Emitting the full "/{locale}#features" fixes both cases at once: from a
   * legal page it is a real link to the landing section, and on the landing
   * page the path already matches, so the browser scrolls in-page without a
   * navigation.
   */
  const withLocale = (href: string) => {
    const prefix = localePrefix ? `/${localePrefix}` : ''
    if (href.startsWith('#')) return `${prefix || '/'}${href}`
    return `${prefix}${href}`
  }

  const now = useNow()
  const year = now === null ? null : new Date(now).getFullYear()
  const copyright = t('landing.footerCopyright', '© {year} حسابچه. تمامی حقوق محفوظ است.')

  return (
    <footer
      className={cn(
        'border-t border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-muted)/0.3)]',
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          {/* ── Brand block: beside the columns on wide screens, above them on narrow ── */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
            <div className="mb-2 text-base font-bold text-[hsl(var(--fg-primary))] sm:mb-3 sm:text-lg">
              {t('app.name', 'حسابچه')}
              <span className="text-[hsl(var(--color-primary))]">.</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[hsl(var(--fg-tertiary))]">
              {t(
                'landing.footerTagline',
                'حافظه‌ی زنده‌ی کسب‌وکار تو — آفلاین، امن، همیشه در دسترس.',
              )}
            </p>

            {/* دکمه‌های ارتباطی مربع با گوشه‌ی نرم — دایره در موبایل ریز و بی‌ریخت بود. */}
            <div className="mt-4 flex items-center justify-center gap-2.5 sm:gap-3">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl sm:size-11',
                    'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
                    'text-[hsl(var(--fg-secondary))]',
                    'hover:border-[hsl(var(--color-primary)/0.35)] hover:text-[hsl(var(--color-primary))]',
                    'transition-colors duration-200',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* ── Link columns. MOBILE FIRST: two short columns side by side and
              the long legal list across the full width in two columns of its
              own; three columns from `sm`. The old layout forced three 98px
              columns with 10px links on a 360px phone. ── */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-6 lg:gap-8">
            {COLUMNS.map((col, index) => (
              <nav
                key={col.titleKey}
                aria-label={t(col.titleKey, col.titleFallback)}
                className={cn(index === COLUMNS.length - 1 && 'col-span-2 sm:col-span-1')}
              >
                <h3 className="mb-2 text-sm font-semibold text-[hsl(var(--fg-primary))] sm:mb-3 lg:mb-4">
                  {t(col.titleKey, col.titleFallback)}
                </h3>
                <ul
                  className={cn(
                    'sm:space-y-2 lg:space-y-2.5',
                    index === COLUMNS.length - 1 && 'grid grid-cols-2 gap-x-4 sm:block',
                  )}
                >
                  {col.links.map((link) => (
                    <li key={link.key}>
                      <Link
                        href={withLocale(link.href)}
                        className="block py-1 text-sm text-[hsl(var(--fg-tertiary))] transition-colors duration-200 hover:text-[hsl(var(--fg-primary))] sm:py-0 sm:text-xs lg:text-sm"
                      >
                        {t(`landing.footerLink.${link.key}`, link.fallback)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          className={cn(
            'mt-8 sm:mt-10 lg:mt-14 pt-5 sm:pt-6 lg:pt-8 border-t border-[hsl(var(--border-default))]',
            'flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 lg:gap-4',
          )}
        >
          {/* ⚠️ THE YEAR IS READ AFTER MOUNT (useNow), NOT DURING RENDER.

              These pages are cached (`revalidate = 3600` on the docs, ISR
              elsewhere), so the served HTML can carry last year while the
              browser computes this one — React error #418, «text content does
              not match», and the whole subtree is thrown away. The server and
              the first client render both paint the line WITHOUT a year; the
              effect then adds it. */}
          <p className="text-xs text-[hsl(var(--fg-tertiary))] order-2 sm:order-1">
            {year === null
              ? copyright.replace('{year} ', '')
              : copyright.replace('{year}', String(year))}
          </p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))] order-1 sm:order-2">
            {t('landing.footer', 'سیستم مدیریت کسب‌وکار')}
          </p>
        </div>
      </div>
    </footer>
  )
}
