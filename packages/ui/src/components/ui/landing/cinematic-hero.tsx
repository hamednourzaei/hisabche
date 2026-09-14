'use client'

// ============================================
// packages/ui/src/components/ui/landing/cinematic-hero.tsx
//
// Hero: centred headline over a dot grid, two actions, then the real product
// screenshot under a soft brand glow — followed by four facts about the
// software. Layout adapted from shadcn-dashboard-landing-template (MIT, see
// landing-primitives.tsx).
//
// ⚠️ THE FOUR FIGURES BELOW ARE FACTS ABOUT THE SOFTWARE, NOT METRICS.
// This block once showed «۳۴۰+ کسب‌وکار فعال», «۱۲,۰۰۰+ تراکنش روزانه»,
// «۱۰۰٪ آفلاین» and «۴.۹ رضایت» — none counted by anything. Each figure here
// is checkable inside the product. Never put a number back that nobody counts.
//
// ⚠️ NOTHING IS HIDDEN UNTIL JAVASCRIPT RUNS. The previous hero started every
// line at `opacity-0` and faded it in — the headline (the LCP element and the
// crawler's first read) was invisible until hydration.
// ============================================

import Image from 'next/image'
import { Building2, BookOpenCheck, Languages, PlayCircle, WifiOff } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { DotPattern, LANDING_CONTAINER } from './landing-primitives'
import { useSceneObserver } from './use-scene-observer'

export interface CinematicHeroProps {
  t: (key: string, fallback?: string) => string
  onNavigateLogin: () => void
}

const FACTS = [
  {
    icon: WifiOff,
    valueKey: 'landing.factOffline',
    value: 'آفلاین',
    labelKey: 'landing.factOfflineLabel',
    label: 'بدون اینترنت هم ثبت می‌کنید',
  },
  {
    icon: BookOpenCheck,
    valueKey: 'landing.factLedger',
    value: 'دوطرفه',
    labelKey: 'landing.factLedgerLabel',
    label: 'حسابداری استاندارد، نه دفترچه',
  },
  {
    icon: Building2,
    valueKey: 'landing.factMulti',
    value: 'چندشعبه',
    labelKey: 'landing.factMultiLabel',
    label: 'تفکیک‌شده یا تجمیعی',
  },
  {
    icon: Languages,
    valueKey: 'landing.factRtl',
    value: 'فارسی/دری',
    labelKey: 'landing.factRtlLabel',
    label: 'راست‌به‌چپ، با تقویم شمسی',
  },
] as const

export default function CinematicHero({ t, onNavigateLogin }: CinematicHeroProps) {
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({
    threshold: 0.1,
    narrativeState: 'frustration',
  })

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-20"
    >
      <DotPattern />

      <div className={cn(LANDING_CONTAINER, 'relative')}>
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement label */}
          <div className="mb-8 flex justify-center">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5',
                'border-[hsl(var(--color-primary)/0.35)] bg-[hsl(var(--color-primary)/0.08)]',
                'text-xs font-medium text-[hsl(var(--color-primary))] sm:text-sm',
              )}
            >
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[hsl(var(--color-primary))] opacity-50 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-[hsl(var(--color-primary))]" />
              </span>
              {t('landing.valuePill', 'بدون اینترنت هم کار می‌کند — همیشه، همه‌جا')}
            </span>
          </div>

          {/* H1 — the page's search subject; keep the product category in it. */}
          <h1 className="mb-6 text-balance text-4xl font-bold leading-[1.2] tracking-tight text-[hsl(var(--fg-primary))] sm:text-5xl lg:text-6xl">
            {t('landing.headline', 'نرم‌افزار حسابداری ساده برای')}{' '}
            <span className="bg-gradient-to-l from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.6)] bg-clip-text text-transparent">
              {t('landing.headlineHighlight', 'مغازه و فروشگاه شما')}
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-pretty text-lg leading-relaxed text-[hsl(var(--fg-secondary))] sm:text-xl">
            {t(
              'landing.subtitle',
              'فروش، نسیه، موجودی و سود — خودکار حساب می‌شود. ساخته‌شده برای مغازه‌داران ایران و افغانستان.',
            )}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-7 text-base sm:w-auto"
            >
              {t('landing.cta', 'شروع رایگان')}
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={scrollToFeatures}
              className="btn-secondary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-7 text-base sm:w-auto"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              {t('landing.ctaSecondary', 'مشاهده دموی محصول')}
            </button>
          </div>

          <p className="mt-5 text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
            {t('landing.microProof', 'بدون نیاز به آموزش · فعال‌سازی در ۳۰ ثانیه · پشتیبانی فارسی')}
          </p>
        </div>

        {/* Product screenshot under a brand glow, fading into the page. */}
        <div className="mx-auto mt-14 max-w-5xl sm:mt-20">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -top-6 left-1/2 h-24 w-[85%] -translate-x-1/2 rounded-full bg-[hsl(var(--color-primary)/0.35)] blur-3xl lg:-top-10 lg:h-72"
            />
            <div className="relative overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl">
              <Image
                src="/dashboard-desktop.png"
                alt={t('landing.dashboardAlt', 'نمای داشبورد حسابچه')}
                width={1920}
                height={1020}
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="block h-auto w-full"
                priority
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent via-[hsl(var(--surface-base)/0.6)] to-[hsl(var(--surface-base))] sm:h-40"
              />
            </div>
          </div>
        </div>

        {/* Facts about the software (see header note). */}
        <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-4 sm:mt-14 lg:grid-cols-4 lg:gap-6">
          {FACTS.map(({ icon: Icon, valueKey, value, labelKey, label }) => (
            <li
              key={valueKey}
              className="rounded-xl border border-[hsl(var(--border-default)/0.7)] bg-[hsl(var(--surface-base)/0.6)] p-5 text-center backdrop-blur-sm sm:p-6"
            >
              <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="block text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
                {t(valueKey, value)}
              </span>
              <span className="mt-1 block text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
                {t(labelKey, label)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
