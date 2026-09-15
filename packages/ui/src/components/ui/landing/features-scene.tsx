// packages/ui/src/components/ui/landing/features-scene.tsx

import Image from 'next/image'
import NextLink from 'next/link'
// SERVER COMPONENT — no hooks, no handlers. Rendered to HTML on the server and
// never hydrated: every client component on the landing is JavaScript a slow
// phone has to run before it can respond (PageSpeed mobile TBT was 6.9 s).
import { cn } from '../../../lib/utils'
import {
  ForwardArrow,
  LANDING_CONTAINER,
  LANDING_SECTION,
  LANDING_TYPE,
  SectionHeader,
} from './landing-primitives'
import type { LucideIcon } from 'lucide-react'
import {
  Users,
  FileText,
  Package,
  Calculator,
  Users2,
  BarChart3,
  Wifi,
  Sparkles,
  Building2,
  Link,
  Shield,
  Smartphone,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   FeaturesScene v13 — Clean grid of Hisabche features (from master roadmap)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FeaturesSceneProps {
  t: (key: string, fallback?: string) => string
  /** Locale segment for route links — same contract as SiteFooter/TopNav. */
  localePrefix?: string
}

interface FeatureItem {
  icon: LucideIcon
  key: string
  title: string
  description: string
  status?: 'active' | 'active' | undefined
  /**
   * Route beneath the locale segment for the feature card that has a dedicated
   * indexable page. Only two features have one — see
   * apps/web/app/[lang]/features/[slug]/page.tsx. This is the landing page's
   * only in-content link to them; before it, the footer was their single
   * inbound link on the whole site, which is exactly the "orphan-ish" shape
   * that leaves a page with no topical context around its link.
   */
  pageHref?: string
  /** Message key for the link label. Reuses the footer's wording. */
  pageLabelKey?: string
  pageLabelFallback?: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: Users,
    key: 'customers',
    title: 'مدیریت مشتریان',
    description: 'اطلاعات مشتری، سوابق خرید و بدهی‌ها',
    status: 'active',
    pageHref: '/features/customer-debt',
    pageLabelKey: 'landing.footerLink.customerDebt',
    pageLabelFallback: 'دفتر نسیه و بدهی مشتریان',
  },
  {
    icon: FileText,
    key: 'invoices',
    title: 'صدور فاکتور',
    description: 'فاکتور فروش سریع و چاپ PDF',
    status: 'active',
    pageHref: '/features/invoicing',
    pageLabelKey: 'landing.footerLink.invoicingPage',
    pageLabelFallback: 'صدور فاکتور آنلاین',
  },
  {
    icon: Package,
    key: 'inventory',
    title: 'مدیریت انبار',
    description: 'موجودی، هشدار کمبود، انتقال کالا',
    status: 'active',
    pageHref: '/features/inventory',
    pageLabelKey: 'landing.footerLink.inventoryPage',
    pageLabelFallback: 'انبارداری ساده',
  },
  {
    icon: Calculator,
    key: 'accounting',
    title: 'حسابداری و مالی',
    description: 'دفتر کل، سود و زیان، ترازنامه',
    status: 'active',
    pageHref: '/features/daybook',
    pageLabelKey: 'landing.footerLink.daybookPage',
    pageLabelFallback: 'دفتر روزنامه و سود و زیان',
  },
  {
    icon: Users2,
    key: 'hr',
    title: 'منابع انسانی',
    description: 'کارمندان، حقوق، حضور و غیاب',
    status: 'active',
  },
  {
    icon: BarChart3,
    key: 'reports',
    title: 'گزارشات و تحلیل',
    description: 'داشبورد فروش، سود، نمودارها',
    status: 'active',
  },
  {
    icon: Wifi,
    key: 'offline',
    title: 'آفلاین واقعی',
    description: 'کار بدون اینترنت، همگام‌سازی خودکار',
    status: 'active',
    pageHref: '/features/offline',
    pageLabelKey: 'landing.footerLink.offline',
    pageLabelFallback: 'حسابداری آفلاین',
  },
  {
    icon: Sparkles,
    key: 'ai',
    title: 'هوش مصنوعی',
    description: 'یادآوری هوشمند، پیشنهاد فروش، تحلیل داده',
    status: 'active',
  },
  {
    icon: Building2,
    key: 'workspace',
    title: 'چند کسب‌وکاری',
    description: 'مدیریت همزمان چند فروشگاه یا شرکت',
    status: 'active',
  },
  {
    icon: Link,
    key: 'integrations',
    title: 'اتصالات و API',
    description: 'اتصال به درگاه‌ها، وب‌هوک، اتصال‌دهنده‌ها',
    status: 'active',
  },
  {
    icon: Shield,
    key: 'security',
    title: 'امنیت و بک‌آپ',
    description: 'رمزنگاری، بک‌آپ خودکار، ورود دو مرحله‌ای',
    status: 'active',
  },
  {
    icon: Smartphone,
    key: 'mobile',
    title: 'موبایل و وب',
    description: 'اپلیکیشن موبایل و نسخه تحت وب',
    status: 'active',
  },
]

/**
 * The two alternating image/text blocks (layout adapted from
 * shadcn-dashboard-landing-template, MIT). Headline and lead come from the
 * feature page each block links to, so the landing never states something that
 * page does not.
 */
const SHOWCASE_BLOCKS = [
  {
    id: 'shop',
    pageKey: 'shopAccounting',
    pageHref: '/features/shop-accounting',
    linkKey: 'landing.footerLink.shopAccountingPage',
    linkFallback: 'نرم‌افزار حسابداری فروشگاهی',
    featureKeys: ['customers', 'invoices', 'inventory', 'accounting'],
    image: { src: '/dashboard-desktop.png', width: 1920, height: 1020, frame: 'desktop' },
  },
  {
    id: 'offline',
    pageKey: 'offline',
    pageHref: '/features/offline',
    linkKey: 'landing.footerLink.offline',
    linkFallback: 'حسابداری آفلاین',
    featureKeys: ['offline', 'mobile', 'workspace', 'security'],
    image: { src: '/dashboard-mobile.png', width: 1183, height: 2560, frame: 'phone' },
  },
] as const

const SHOWCASED = new Set<string>(SHOWCASE_BLOCKS.flatMap((b) => [...b.featureKeys]))

export default function FeaturesScene({ t, localePrefix }: FeaturesSceneProps) {
  const routePrefix = localePrefix ? `/${localePrefix}` : ''
  const byKey = new Map(FEATURES.map((f) => [f.key, f]))
  const rest = FEATURES.filter((f) => !SHOWCASED.has(f.key))

  return (
    <section
      id="features"

      data-narrative="confidence"
      className={cn(LANDING_SECTION, 'bg-[hsl(var(--surface-muted)/0.3)]')}
    >
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.featuresLabel', 'امکانات')}
          title={t('landing.featuresTitle', 'همه ابزارهای کسب‌وکار، یکجا')}
          description={t('landing.featuresDesc', 'از فروش و انبار تا حسابداری و هوش مصنوعی.')}
        />

        <div className="space-y-12 sm:space-y-20 lg:space-y-24">
          {SHOWCASE_BLOCKS.map((block, index) => (
            <div key={block.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              {/* Every second block puts the image on the END side on wide
                  screens. Grid order follows the writing direction, so this
                  reads correctly in RTL and LTR alike. */}
              {/* Hidden on phones: the Hero already shows the legible phone screenshot,
                  and a 1920px dashboard at 328px has no readable word in it. */}
              <div className={cn('hidden justify-center sm:flex', index % 2 === 1 && 'lg:order-2')}>
                <div
                  className={cn(
                    'relative w-full overflow-hidden border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-xl',
                    block.image.frame === 'phone'
                      ? 'max-w-[16rem] rounded-[2rem] p-2'
                      : 'rounded-xl',
                  )}
                >
                  <Image
                    src={block.image.src}
                    alt={t(`landing.featurePage.${block.pageKey}.h1`)}
                    width={block.image.width}
                    height={block.image.height}
                    sizes={
                      block.image.frame === 'phone' ? '256px' : '(min-width: 1024px) 560px, 100vw'
                    }
                    className={cn(
                      'block h-auto w-full',
                      block.image.frame === 'phone' && 'rounded-[1.5rem]',
                    )}
                  />
                </div>
              </div>

              <div>
                <h3
                  className={cn(
                    'mb-3 text-balance font-semibold tracking-tight text-[hsl(var(--fg-primary))] sm:mb-4',
                    LANDING_TYPE.h3,
                  )}
                >
                  {t(`landing.featurePage.${block.pageKey}.h1`)}
                </h3>
                <p
                  className={cn(
                    'mb-6 text-pretty text-[hsl(var(--fg-secondary))] sm:mb-8',
                    LANDING_TYPE.lead,
                  )}
                >
                  {t(`landing.featurePage.${block.pageKey}.metaDescription`)}
                </p>

                <ul className="mb-6 grid grid-cols-2 gap-3 sm:mb-8">
                  {block.featureKeys.map((key) => {
                    const feature = byKey.get(key)
                    if (!feature) return null
                    const Icon = feature.icon
                    return (
                      <li
                        key={key}
                        className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] transition-colors hover:border-[hsl(var(--color-primary)/0.35)]"
                      >
                        <Icon
                          className="mt-0.5 size-5 shrink-0 text-[hsl(var(--color-primary))]"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-[hsl(var(--fg-primary))]">
                            {t(`landing.feature.${key}Title`, feature.title)}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                            {t(`landing.feature.${key}Desc`, feature.description)}
                          </p>
                          {/* Descriptive in-content link to the feature's own page. */}
                          {feature.pageHref &&
                            feature.pageLabelKey &&
                            feature.pageHref !== block.pageHref && (
                              <NextLink
                                href={`${routePrefix}${feature.pageHref}`}
                                className="mt-1 inline-flex text-sm font-medium text-[hsl(var(--color-primary))] hover:underline"
                              >
                                {t(feature.pageLabelKey, feature.pageLabelFallback)}
                              </NextLink>
                            )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <NextLink
                  href={`${routePrefix}${block.pageHref}`}
                  className="btn-secondary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm sm:w-auto"
                >
                  {t(block.linkKey, block.linkFallback)}
                  <ForwardArrow />
                </NextLink>
              </div>
            </div>
          ))}
        </div>

        {/* Everything not shown in a block above. */}
        {/* Grouped compact rows on phones; cards from `sm`. */}
        <ul
          className={cn(
            'mt-10 divide-y divide-[hsl(var(--border-default)/0.7)] overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)]',
            'sm:mt-20 sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:border-0 sm:bg-transparent lg:mt-24 lg:grid-cols-4',
          )}
        >
          {rest.map((feature) => {
            const Icon = feature.icon
            return (
              <li
                key={feature.key}
                className="flex items-start gap-3 px-4 py-4 sm:flex-col sm:gap-0 sm:rounded-xl sm:border sm:border-[hsl(var(--border-default))] sm:bg-[hsl(var(--surface-elevated)/0.6)] sm:p-6"
              >
                <div className="sm:mb-4 sm:flex sm:w-full sm:items-center sm:justify-between sm:gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] sm:size-10">
                    <Icon className="size-[1.125rem] sm:size-5" aria-hidden="true" />
                  </span>
                  {feature.status === 'active' && (
                    <span className="hidden shrink-0 rounded-full bg-[hsl(var(--color-success)/0.12)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--color-success))] sm:inline">
                      {t('landing.featureStatus.active', 'فعال')}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="mb-1 text-[0.9375rem] font-semibold text-[hsl(var(--fg-primary))] sm:mb-1.5 sm:text-base">
                    {t(`landing.feature.${feature.key}Title`, feature.title)}
                  </h3>
                  <p className={cn('text-[hsl(var(--fg-secondary))]', LANDING_TYPE.body)}>
                    {t(`landing.feature.${feature.key}Desc`, feature.description)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
