// packages/ui/src/components/ui/landing/site-footer.tsx
'use client'

import Link from 'next/link'
import { cn } from '../../../lib/utils'
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

  const year = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'border-t border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-muted)/0.3)]',
      )}
    >
      <div className="container-narrow px-4 sm:px-6 py-8 sm:py-10 lg:py-16">
        {/* ── Brand block: centred above the columns at every width ── */}
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div className="mb-2 text-base font-bold text-[hsl(var(--fg-primary))] sm:mb-3 sm:text-lg">
            {t('app.name', 'حسابچه')}
            <span className="text-[hsl(var(--color-primary))]">.</span>
          </div>
          <p className="max-w-sm text-[11px] leading-relaxed text-[hsl(var(--fg-tertiary))] sm:text-xs lg:text-sm">
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

        {/* ── Link columns: three across at every width ── */}
        <div className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {COLUMNS.map((col) => (
            <nav key={col.titleKey} aria-label={t(col.titleKey, col.titleFallback)}>
              <h3 className="mb-2 text-[11px] font-semibold text-[hsl(var(--fg-primary))] sm:mb-3 sm:text-xs lg:mb-4 lg:text-sm">
                {t(col.titleKey, col.titleFallback)}
              </h3>
              <ul className="space-y-1.5 sm:space-y-2 lg:space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={withLocale(link.href)}
                      className="text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-200"
                    >
                      {t(`landing.footerLink.${link.key}`, link.fallback)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div
          className={cn(
            'mt-8 sm:mt-10 lg:mt-14 pt-5 sm:pt-6 lg:pt-8 border-t border-[hsl(var(--border-default))]',
            'flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 lg:gap-4',
          )}
        >
          {/* ⚠️ `suppressHydrationWarning` — THE YEAR IS THE ONE THING HERE
              THAT CAN LEGITIMATELY DIFFER.

              These pages are cached (`revalidate = 3600` on the docs, ISR
              elsewhere), so on the 1st of January the served HTML still says
              last year while the browser computes this one. React treats that
              as a corrupt tree and throws error #418 — «text content does not
              match» — discarding and re-rendering the whole subtree.

              This is React's own escape hatch for exactly this case: a value
              derived from the clock. It suppresses the warning for this
              element only, and the client's value wins on the next render. */}
          <p
            suppressHydrationWarning
            className="text-[9px] sm:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))] order-2 sm:order-1"
          >
            {t('landing.footerCopyright', `© ${year} حسابچه. تمامی حقوق محفوظ است.`).replace(
              '{year}',
              String(year),
            )}
          </p>
          <p className="text-[9px] sm:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))] order-1 sm:order-2">
            {t('landing.footer', 'سیستم مدیریت کسب‌وکار')}
          </p>
        </div>
      </div>
    </footer>
  )
}
