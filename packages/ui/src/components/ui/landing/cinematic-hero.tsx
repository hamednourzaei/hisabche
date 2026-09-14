'use client'

// ============================================
// packages/ui/src/components/ui/landing/cinematic-hero.tsx
//
// Hero: centred headline over a dot grid, two actions, then the real product
// screenshot under a soft brand glow — followed by four facts about the
// software. Layout adapted from shadcn-dashboard-landing-template (MIT, see
// landing-primitives.tsx).
//
// MOBILE FIRST. Unprefixed classes are the phone layout; `sm:` and up add the
// desktop one. The screenshot is ART-DIRECTED, not scaled: a 1920px dashboard
// at 326px wide had no legible word in it, so phones get the phone screenshot.
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

import { getImageProps } from 'next/image'
import { Building2, BookOpenCheck, Languages, PlayCircle, WifiOff } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { DotPattern, ForwardArrow, LANDING_CONTAINER, LANDING_TYPE } from './landing-primitives'
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

/** Breakpoint where the desktop screenshot replaces the phone one (Tailwind `sm`). */
const DESKTOP_MEDIA = '(min-width: 640px)'

export default function CinematicHero({ t, onNavigateLogin }: CinematicHeroProps) {
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({
    threshold: 0.1,
    narrativeState: 'frustration',
  })

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  // One <picture>, two sources: the browser downloads only the one that
  // matches, so a phone never fetches the 1920px screenshot it cannot read.
  const alt = t('landing.dashboardAlt', 'نمای داشبورد حسابچه')
  const { props: desktopImg } = getImageProps({
    src: '/dashboard-desktop.png',
    alt,
    width: 1920,
    height: 1020,
    sizes: '(min-width: 1024px) 1024px, 100vw',
    priority: true,
  })
  const { props: phoneImg } = getImageProps({
    src: '/dashboard-mobile.png',
    alt,
    width: 1183,
    height: 2560,
    sizes: '240px',
    priority: true,
  })

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative overflow-hidden pb-10 pt-8 sm:pb-20 sm:pt-20"
    >
      <DotPattern />

      <div className={cn(LANDING_CONTAINER, 'relative')}>
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement label */}
          <div className="mb-5 flex justify-center sm:mb-8">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 sm:px-4 sm:py-1.5',
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
          <h1
            className={cn(
              'mb-4 text-balance font-bold tracking-tight text-[hsl(var(--fg-primary))] sm:mb-6',
              LANDING_TYPE.h1,
            )}
          >
            {t('landing.headline', 'نرم‌افزار حسابداری ساده برای')}{' '}
            <span className="bg-gradient-to-l from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.6)] bg-clip-text text-transparent">
              {t('landing.headlineHighlight', 'مغازه و فروشگاه شما')}
            </span>
          </h1>

          <p
            className={cn(
              'mx-auto mb-7 max-w-2xl text-pretty text-[hsl(var(--fg-secondary))] sm:mb-10 sm:text-xl',
              LANDING_TYPE.lead,
            )}
          >
            {t(
              'landing.subtitle',
              'فروش، نسیه، موجودی و سود — خودکار حساب می‌شود. ساخته‌شده برای مغازه‌داران ایران و افغانستان.',
            )}
          </p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-7 text-base"
            >
              {t('landing.cta', 'شروع رایگان')}
              <ForwardArrow />
            </button>
            <button
              type="button"
              onClick={scrollToFeatures}
              className="btn-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-7 text-base"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              {t('landing.ctaSecondary', 'مشاهده دموی محصول')}
            </button>
          </div>

          <p className="mt-4 text-xs text-[hsl(var(--fg-tertiary))] sm:mt-5 sm:text-sm">
            {t('landing.microProof', 'بدون نیاز به آموزش · فعال‌سازی در ۳۰ ثانیه · پشتیبانی فارسی')}
          </p>
        </div>

        {/* Product screenshot under a brand glow. Phone frame on phones,
            browser-width shot from `sm`. */}
        <div className="mx-auto mt-10 max-w-[13rem] sm:mt-20 sm:max-w-5xl">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -top-6 left-1/2 h-40 w-[85%] -translate-x-1/2 rounded-full bg-[hsl(var(--color-primary)/0.35)] blur-3xl lg:-top-10 lg:h-72"
            />
            <div className="relative max-h-[22rem] overflow-hidden rounded-[2rem] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2 shadow-2xl sm:max-h-none sm:rounded-xl sm:p-0">
              <picture>
                <source media={DESKTOP_MEDIA} srcSet={desktopImg.srcSet} sizes={desktopImg.sizes} />
                <img
                  {...phoneImg}
                  alt={alt}
                  className="block h-auto w-full rounded-[1.5rem] sm:rounded-none"
                />
              </picture>
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-[hsl(var(--surface-base)/0.6)] to-[hsl(var(--surface-base))] sm:h-40"
              />
            </div>
          </div>
        </div>

        {/* Facts about the software (see header note). On phones one grouped
            list of compact rows (icon beside text) — no horizontal scrolling,
            and a quarter of the height the 2×2 card grid took. Cards from `sm`. */}
        <ul
          className={cn(
            'mx-auto mt-8 max-w-5xl divide-y divide-[hsl(var(--border-default)/0.7)] overflow-hidden rounded-xl border border-[hsl(var(--border-default)/0.7)] bg-[hsl(var(--surface-base)/0.6)]',
            'sm:mt-14 sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent lg:grid-cols-4 lg:gap-6',
          )}
        >
          {FACTS.map(({ icon: Icon, valueKey, value, labelKey, label }) => (
            <li
              key={valueKey}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-start',
                'sm:block sm:rounded-xl sm:border sm:border-[hsl(var(--border-default)/0.7)] sm:bg-[hsl(var(--surface-base)/0.6)] sm:p-6 sm:text-center sm:backdrop-blur-sm',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] sm:mx-auto sm:mb-3 sm:size-11 sm:rounded-xl">
                <Icon className="size-[1.125rem] sm:size-5" aria-hidden="true" />
              </span>
              <span className="block min-w-0">
                <span className="block text-sm font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
                  {t(valueKey, value)}
                </span>
                <span className="block text-xs text-[hsl(var(--fg-tertiary))] sm:mt-1 sm:text-sm">
                  {t(labelKey, label)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
