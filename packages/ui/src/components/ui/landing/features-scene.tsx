// packages/ui/src/components/ui/landing/features-scene.tsx
'use client'

import NextLink from 'next/link'
import { useSceneObserver } from './use-scene-observer'
import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
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

export default function FeaturesScene({ t, localePrefix }: FeaturesSceneProps) {
  const routePrefix = localePrefix ? `/${localePrefix}` : ''
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({ threshold: 0.2, narrativeState: 'confidence' })

  return (
    <section id="features" ref={ref} data-narrative="confidence" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.featuresLabel', 'امکانات')}
          title={t('landing.featuresTitle', 'همه ابزارهای کسب‌وکار، یکجا')}
          description={t('landing.featuresDesc', 'از فروش و انبار تا حسابداری و هوش مصنوعی.')}
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <li
                key={feature.key}
                className={cn(
                  'group flex flex-col rounded-xl border p-5 transition-colors sm:p-6',
                  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)]',
                  'hover:border-[hsl(var(--color-primary)/0.35)]',
                )}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {feature.status !== undefined && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        feature.status === 'active'
                          ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                          : 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
                      )}
                    >
                      {feature.status === 'active' ? 'فعال' : 'به‌زودی'}
                    </span>
                  )}
                </div>

                <h3 className="mb-1.5 text-base font-semibold text-[hsl(var(--fg-primary))]">
                  {t(`landing.feature.${feature.key}Title`, feature.title)}
                </h3>
                <p className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                  {t(`landing.feature.${feature.key}Desc`, feature.description)}
                </p>

                {/* Contextual link to the feature's own page — descriptive
                    anchor text (the page's real subject), not "learn more". */}
                {feature.pageHref && feature.pageLabelKey && (
                  <NextLink
                    href={`${routePrefix}${feature.pageHref}`}
                    className="mt-auto inline-flex pt-4 text-sm font-medium text-[hsl(var(--color-primary))] hover:underline"
                  >
                    {t(feature.pageLabelKey, feature.pageLabelFallback)}
                  </NextLink>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
