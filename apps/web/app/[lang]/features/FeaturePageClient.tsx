'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import SiteFooter from '@hisabche/ui/landing/site-footer'

/* ═══════════════════════════════════════════════════════════════════════════
   Shared shell for the /features/* pages.

   Deliberately modelled on LegalPageClient (same header, same container, same
   SiteFooter) rather than introducing a second page chrome — these are the same
   kind of standalone public page, and the landing page's scene components are
   built for the one-page scroll, not for a document.

   Content lives entirely in the message catalogue under
   `landing.featurePage.<key>`, so fa / af / en each carry their own wording.
   That matters more here than anywhere else on the site: Afghan shopkeepers say
   قرض, گدام, انترنت, اسعار where Iranian users say بدهی/نسیه, انبار, اینترنت,
   ارز. These pages are written per market, not translated from one another.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Section {
  heading: string
  body: string
}

interface FaqItem {
  q: string
  a: string
}

export interface RelatedLink {
  href: string
  labelKey: string
  labelFallback: string
}

interface FeaturePageClientProps {
  /** Key under `landing.featurePage`, e.g. "customerDebt". */
  contentKey: string
  related: RelatedLink[]
}

export function FeaturePageClient({ contentKey, related }: FeaturePageClientProps) {
  const t = useTranslations()
  // Route links must carry the locale segment — proxy.ts runs with
  // `localePrefix: 'always'`, so a bare "/" is a redirect whose target is
  // chosen by Accept-Language rather than by the page being read.
  const locale = useLocale()
  const home = `/${locale}`

  const safeT = (key: string, fallback?: string) => {
    const result = t(key)
    return result && result !== key ? result : (fallback ?? key)
  }

  const base = `landing.featurePage.${contentKey}`
  const raw = (key: string): unknown => {
    try {
      return t.raw(key)
    } catch {
      return undefined
    }
  }

  const sectionsRaw = raw(`${base}.sections`)
  const sections = Array.isArray(sectionsRaw) ? (sectionsRaw as Section[]) : []
  const faqRaw = raw(`${base}.faq`)
  const faq = Array.isArray(faqRaw) ? (faqRaw as FaqItem[]) : []

  const h1 = safeT(`${base}.h1`)
  const intro = safeT(`${base}.intro`)

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-base))]">
      <header className="border-b border-[hsl(var(--border-default))]">
        <div className="container-narrow px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href={home} className="text-lg font-bold text-[hsl(var(--fg-primary))]">
            {safeT('app.name', 'حسابچه')}
            <span className="text-[hsl(var(--color-primary))]">.</span>
          </Link>
          <Link
            href={home}
            className="text-sm text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          >
            {safeT('landing.featurePage.backToHome', 'Back to home')}
          </Link>
        </div>
      </header>

      <main className="container-narrow px-4 sm:px-6 py-10 sm:py-16 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--fg-primary))] mb-4">{h1}</h1>
        <p className="text-base sm:text-lg leading-relaxed text-[hsl(var(--fg-secondary))] mb-10">
          {intro}
        </p>

        {sections.map((section) => (
          <section key={section.heading} className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--fg-primary))] mb-3">
              {section.heading}
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-[hsl(var(--fg-secondary))]">
              {section.body}
            </p>
          </section>
        ))}

        {faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--fg-primary))] mb-5">
              {safeT('landing.featurePage.faqTitle', 'Common questions')}
            </h2>
            <dl className="space-y-5">
              {faq.map((item) => (
                <div
                  key={item.q}
                  className={cn(
                    'rounded-xl border border-[hsl(var(--border-default))]',
                    'bg-[hsl(var(--surface-elevated))] p-4 sm:p-5',
                  )}
                >
                  <dt className="font-semibold text-[hsl(var(--fg-primary))] mb-2">{item.q}</dt>
                  <dd className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section
          className={cn(
            'mt-12 rounded-2xl border border-[hsl(var(--color-primary)/0.3)]',
            'bg-[hsl(var(--color-primary)/0.08)] p-6 sm:p-8 text-center',
          )}
        >
          <h2 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--fg-primary))] mb-2">
            {safeT(`${base}.ctaTitle`)}
          </h2>
          <p className="text-sm sm:text-base text-[hsl(var(--fg-secondary))] mb-5">
            {safeT(`${base}.ctaBody`)}
          </p>
          <Link
            href={`/${locale}/signup`}
            className={cn(
              'inline-flex items-center justify-center rounded-xl px-6 py-3',
              'bg-[hsl(var(--color-primary))] text-[hsl(var(--surface-base))]',
              'font-semibold hover:opacity-90 transition-opacity',
            )}
          >
            {safeT('landing.featurePage.ctaButton', 'Start free')}
          </Link>
        </section>

        {/* Contextual cross-links. Without these each feature page would be a
            dead end reachable only from the footer, which is how the legal
            pages ended up with no lateral link equity at all. */}
        {related.length > 0 && (
          <nav
            className="mt-10"
            aria-label={safeT('landing.featurePage.otherFeatures', 'More pages')}
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--fg-tertiary))] mb-3">
              {safeT('landing.featurePage.otherFeatures', 'More pages')}
            </h2>
            <ul className="flex flex-wrap gap-3">
              {related.map((link) => (
                <li key={link.href}>
                  <Link
                    href={`/${locale}${link.href}`}
                    className={cn(
                      'inline-flex rounded-lg border border-[hsl(var(--border-default))]',
                      'px-4 py-2 text-sm text-[hsl(var(--fg-secondary))]',
                      'hover:text-[hsl(var(--fg-primary))] hover:border-[hsl(var(--color-primary)/0.35)]',
                      'transition-colors',
                    )}
                  >
                    {safeT(link.labelKey, link.labelFallback)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>

      <SiteFooter t={safeT} localePrefix={locale} />
    </div>
  )
}
