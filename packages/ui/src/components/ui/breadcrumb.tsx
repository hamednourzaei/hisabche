// packages/ui/src/components/ui/breadcrumb.tsx
'use client'

// ============================================
// The trail, derived from NAV_CONTRACT rather than from a second list.
//
// ---------------------------------------------------------------------------
// TWO BUGS THIS REPLACES
//
// 1. The locale was stripped for `af` and `en` but NOT for `fa`. Persian is the
//    default locale and the one nearly everybody uses, so on almost every page
//    the trail read `🏠 › fa › بودجه` — the language code rendered as if it
//    were a place you could visit.
//
// 2. Labels came from a hand-written map that had to be updated by hand
//    whenever a destination was added. It knew `warehouse` and `invoices` and
//    had never heard of `bank`, `budgets`, `till` or `expiry`, so those pages
//    showed the raw URL segment as their name.
//
// Both are the same mistake: a second source of truth for something
// NAV_CONTRACT already knows. `breadcrumbsFor` reads the contract, so a
// renamed destination renames its own crumb and a new one needs no work here.
// ============================================

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Home } from 'lucide-react'

import { breadcrumbsFor, localizePath } from '@hisabche/ui-contract'
import { cn } from '../../lib/utils'
import { useRouteLang } from '../../hooks/use-locale-push'

/** Kept in step with `apps/web/app/[lang]/i18n-config.ts`. */
const LOCALES = ['fa', 'af', 'en'] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname()
  const lang = useRouteLang()
  const t = useTranslations()

  // Every link carries the locale back on web — a bare `/invoices` bounces the
  // user through the locale redirect — and none on desktop, which has no
  // `/fa/…` routes (this used to default to 'fa' there).
  const withLocale = (path: string) => localizePath(path, lang)

  const crumbs = breadcrumbsFor(pathname ?? '', LOCALES)

  // One crumb means we are at the root; the home icon already says that.
  if (crumbs.length <= 1) return null

  const label = (crumb: { labelKey: string; segment: string }): string => {
    // A crumb the contract does not recognise. An id in the path is a record,
    // not a place — showing the raw UUID would be noise nobody can read.
    if (crumb.labelKey === '') {
      return UUID.test(crumb.segment) ? t('common.details') : crumb.segment
    }
    const translated = t(crumb.labelKey as Parameters<typeof t>[0])
    return translated && translated !== crumb.labelKey ? translated : crumb.labelKey
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      <Link
        href={withLocale('/dashboard')}
        className="text-[hsl(var(--fg-tertiary))] transition-colors hover:text-[hsl(var(--fg-primary))]"
      >
        <Home className="size-4" />
        <span className="sr-only">{t('nav.today')}</span>
      </Link>

      {crumbs.slice(1).map((crumb, index) => {
        const text = label(crumb)

        return (
          <span key={`${crumb.labelKey}-${index}`} className="flex items-center gap-1.5">
            <ChevronLeft className="size-3.5 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />

            {crumb.path ? (
              <Link
                href={withLocale(crumb.path)}
                className="max-w-[150px] truncate text-[hsl(var(--fg-secondary))] transition-colors hover:text-[hsl(var(--fg-primary))]"
              >
                {text}
              </Link>
            ) : (
              // The last crumb is where you already are, so it is not a link.
              <span
                aria-current="page"
                className="max-w-[200px] truncate font-medium text-[hsl(var(--fg-primary))]"
              >
                {text}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
