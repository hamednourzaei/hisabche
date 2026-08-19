// packages/ui/src/components/ui/landing/features-scene.tsx
'use client'

import NextLink from 'next/link'
import { useSceneObserver } from './use-scene-observer'
import { cn } from '../../../lib/utils'
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
  },
  {
    icon: Package,
    key: 'inventory',
    title: 'مدیریت انبار',
    description: 'موجودی، هشدار کمبود، انتقال کالا',
    status: 'active',
  },
  {
    icon: Calculator,
    key: 'accounting',
    title: 'حسابداری و مالی',
    description: 'دفتر کل، سود و زیان، ترازنامه',
    status: 'active',
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

export default function FeaturesScene({ t, localePrefix }: FeaturesSceneProps) {
  const routePrefix = localePrefix ? `/${localePrefix}` : ''
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.2,
    narrativeState: 'confidence',
  })
  const animated = state === 'animated'

  return (
    <section
      id="features"
      ref={ref}
      data-narrative="confidence"
      className="py-12 sm:py-16 lg:py-20"
    >
      <div className="container-narrow max-w-6xl px-4 sm:px-6">
        <div
          className={cn(
            'text-center mb-10 sm:mb-12 lg:mb-16',
            'transition-all duration-700 motion-reduce:transition-none',
            animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
          )}
        >
          <p className="text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t('landing.featuresLabel', 'امکانات')}
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight">
            {t('landing.featuresTitle', 'همه ابزارهای کسب‌وکار، یکجا')}
          </h2>
          <p className="mt-2 sm:mt-3 lg:mt-4 text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed max-w-lg mx-auto px-4 sm:px-0">
            {t('landing.featuresDesc', 'از فروش و انبار تا حسابداری و هوش مصنوعی.')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.key}
                className={cn(
                  'group relative overflow-hidden rounded-[var(--radius-xl)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3.5 sm:p-4 lg:p-6 transition-all duration-500',
                  'hover:border-[hsl(var(--color-primary)/0.3)] hover:shadow-lg hover:-translate-y-1',
                  'motion-reduce:hover:translate-y-0',
                  animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                )}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl bg-[hsl(var(--color-primary)/0.1)] flex items-center justify-center text-[hsl(var(--color-primary))]">
                    <Icon className="size-4 sm:size-4.5 lg:size-5" />
                  </div>
                  {feature.status !== undefined && (
                    <span
                      className={cn(
                        'text-[8px] sm:text-[10px] lg:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium',
                        feature.status === 'active'
                          ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                          : 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
                      )}
                    >
                      {feature.status === 'active' ? 'فعال' : 'به‌زودی'}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-xs sm:text-sm lg:text-base leading-snug mb-0.5 sm:mb-1 text-[hsl(var(--fg-primary))] line-clamp-1 sm:line-clamp-2">
                  {t(`landing.feature.${feature.key}Title`, feature.title)}
                </h3>
                <p className="text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-secondary))] leading-relaxed line-clamp-2">
                  {t(`landing.feature.${feature.key}Desc`, feature.description)}
                </p>

                {/* Contextual, in-content link to the feature's own page.
                    Descriptive anchor text (the page's real subject), not
                    "learn more" — the anchor is the strongest relevance signal
                    a link carries, and a generic one wastes it. */}
                {feature.pageHref && feature.pageLabelKey && (
                  <NextLink
                    href={`${routePrefix}${feature.pageHref}`}
                    className={cn(
                      'mt-2 inline-flex text-[10px] sm:text-xs font-medium',
                      'text-[hsl(var(--color-primary))] hover:underline',
                    )}
                  >
                    {t(feature.pageLabelKey, feature.pageLabelFallback)}
                  </NextLink>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
