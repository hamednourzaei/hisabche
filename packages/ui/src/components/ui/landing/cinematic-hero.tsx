// packages/ui/src/components/ui/landing/cinematic-hero.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { cn } from '../../../lib/utils'
import Image from 'next/image'

/* ═══════════════════════════════════════════════════════════════════════════
   CinematicHero v11 — Mobile-centred · Logo first on mobile
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CinematicHeroProps {
  t: (key: string, fallback?: string) => string
  onNavigateLogin: () => void
}

export default function CinematicHero({ t, onNavigateLogin }: CinematicHeroProps) {
  const { ref } = useSceneObserver<HTMLDivElement>({
    threshold: 0.1,
    narrativeState: 'frustration',
  })

  const scrollToDemo = () => {
    document.getElementById('dashboard-showcase')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-[100svh] lg:min-h-screen items-center overflow-hidden py-12 sm:py-16 lg:py-0"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center justify-items-center lg:justify-items-stretch gap-8 sm:gap-10 lg:gap-16">
          {/* ── Text content: order-2 on mobile, order-1 on desktop ── */}
          <div className="order-2 lg:order-1 flex flex-col items-center text-center lg:items-start lg:text-start w-full">
            {/* Value Pill: Offline */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 mb-4 sm:mb-6 lg:mb-8',
                'rounded-full mx-auto lg:mx-0',
                'bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.15)]',
                'text-[10px] sm:text-xs lg:text-sm font-medium text-[hsl(var(--color-primary))]',
                'opacity-0 animate-[fade-in-up_0.6s_ease-out_both]',
              )}
            >
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--color-primary))] opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[hsl(var(--color-primary))]" />
              </span>
              {t('landing.valuePill', 'بدون اینترنت هم کار می‌کند — همیشه، همه‌جا')}
            </div>

            {/* H1 */}
            <h1
              className={cn(
                'mb-3 sm:mb-4 lg:mb-6 max-w-lg mx-auto lg:mx-0',
                'text-[1.6rem] leading-[1.15] sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl',
                'font-bold tracking-tight text-center lg:text-start',
                'text-[hsl(var(--fg-primary))]',
                'opacity-0 animate-[fade-in-up_0.6s_ease-out_0.1s_both]',
              )}
            >
              {/* Fallbacks mirror the fa catalogue. The old pair — «هر روز با
                  خیال راحت» / «دکانت را ببند» — named no product category at
                  all, so the single most important on-page element gave a
                  crawler nothing, and «دکان» is Afghan/archaic in fa (Iranian
                  users say مغازه / فروشگاه). af keeps دوکان; that is correct
                  there and must not be normalised away. */}
              {t('landing.headline', 'نرم‌افزار حسابداری ساده برای')}{' '}
              <span className="text-[hsl(var(--color-primary))]">
                {t('landing.headlineHighlight', 'مغازه و فروشگاه شما')}
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className={cn(
                'mb-6 sm:mb-8 lg:mb-10 max-w-xl mx-auto lg:mx-0',
                'text-sm sm:text-base lg:text-xl text-center lg:text-start',
                'text-[hsl(var(--fg-secondary))] leading-relaxed',
                'opacity-0 animate-[fade-in-up_0.6s_ease-out_0.2s_both]',
              )}
            >
              {t(
                'landing.subtitle',
                'فروش، نسیه، موجودی و سود — خودکار حساب می‌شود. ساخته‌شده برای مغازه‌داران ایران و افغانستان.',
              )}
            </p>

            {/* CTAs + Micro Proof */}
            <div
              className={cn(
                'w-full space-y-3 sm:space-y-4',
                'opacity-0 animate-[fade-in-up_0.6s_ease-out_0.3s_both]',
              )}
            >
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center lg:justify-start items-center w-full">
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className={cn(
                    'btn-primary',
                    'rounded-xl px-5 sm:px-7 lg:px-8 py-3 sm:py-3.5 lg:py-4',
                    'min-h-[44px] sm:min-h-[48px] lg:min-h-[52px]',
                    'w-full sm:w-auto text-sm sm:text-base',
                  )}
                >
                  {t('landing.cta', 'شروع رایگان')}
                  <span className="text-base sm:text-lg" aria-hidden="true">
                    ←
                  </span>
                </button>

                <button
                  type="button"
                  onClick={scrollToDemo}
                  className={cn(
                    'btn-secondary',
                    'rounded-xl px-5 sm:px-7 lg:px-8 py-3 sm:py-3.5 lg:py-4',
                    'min-h-[44px] sm:min-h-[48px] lg:min-h-[52px]',
                    'w-full sm:w-auto text-sm sm:text-base',
                  )}
                >
                  {t('landing.ctaSecondary', 'مشاهده دموی محصول')}
                </button>
              </div>

              <p className="text-center lg:text-start text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))]">
                {t(
                  'landing.microProof',
                  'بدون نیاز به آموزش · فعال‌سازی در ۳۰ ثانیه · پشتیبانی فارسی',
                )}
              </p>
            </div>

            {/* Trust bar */}
            <div
              className={cn(
                'w-full mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 lg:pt-10',
                'border-t border-[hsl(var(--border-default))]',
                'opacity-0 animate-[fade-in-up_0.6s_ease-out_0.4s_both]',
              )}
            >
              {/*
                ⚠️ THESE WERE FOUR INVENTED METRICS, IN THE MOST PROMINENT
                PLACE ON THE SITE.

                    ۳۴۰+     کسب‌وکار فعال      no counter exists
                    ۱۲,۰۰۰+  تراکنش روزانه      no counter exists
                    ۱۰۰٪     آفلاین کار می‌کند   an uptime claim, unmeasured
                    ۴.۹      رضایت کاربران      no rating source exists

                A visitor reads these as measurements. They were placeholder
                copy. «۱۰۰٪ uptime» is the worst of the four: it is a promise
                about availability that nothing monitors, made to people
                deciding whether to trust their books to it.

                What replaces them are FACTS ABOUT THE SOFTWARE — each one
                checkable inside the product, none of them a number nobody
                counted. The layout, weight and animation are unchanged.
              */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                <div className="text-center lg:text-start">
                  <span className="block text-base sm:text-xl lg:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t('landing.factOffline', 'آفلاین')}
                  </span>
                  <span className="text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t('landing.factOfflineLabel', 'بدون اینترنت هم ثبت می‌کنید')}
                  </span>
                </div>
                <div className="text-center lg:text-start">
                  <span className="block text-base sm:text-xl lg:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t('landing.factLedger', 'دوطرفه')}
                  </span>
                  <span className="text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t('landing.factLedgerLabel', 'حسابداری استاندارد، نه دفترچه')}
                  </span>
                </div>
                <div className="text-center lg:text-start">
                  <span className="block text-base sm:text-xl lg:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t('landing.factMulti', 'چندشعبه')}
                  </span>
                  <span className="text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t('landing.factMultiLabel', 'تفکیک‌شده یا تجمیعی')}
                  </span>
                </div>
                <div className="text-center lg:text-start">
                  <span className="block text-base sm:text-xl lg:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t('landing.factRtl', 'فارسی/دری')}
                  </span>
                  <span className="text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t('landing.factRtlLabel', 'راست‌به‌چپ، با تقویم شمسی')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Visual: Desktop full rings ── */}
          <div
            className={cn(
              'hidden lg:flex items-center justify-center order-2',
              'opacity-0 animate-[fade-in-up_0.6s_ease-out_0.25s_both]',
            )}
          >
            <div className="relative w-72 h-72 xl:w-96 xl:h-96" aria-hidden="true">
              <div className="absolute inset-0 rounded-full border border-[hsl(var(--color-primary)/0.12)]" />
              <div className="absolute inset-8 rounded-full border border-[hsl(var(--color-primary)/0.18)]" />
              <div className="absolute inset-16 rounded-full border border-[hsl(var(--color-primary)/0.22)]" />

              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[hsl(var(--color-primary))] shadow-[0_0_12px_hsl(var(--color-primary))]" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-[hsl(var(--color-accent))] shadow-[0_0_10px_hsl(var(--color-accent))]" />
              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-primary-light))] shadow-[0_0_8px_hsl(var(--color-primary-light))]" />
              <div className="absolute right-0 top-1/3 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-primary))] shadow-[0_0_8px_hsl(var(--color-primary))]" />

              <div className="absolute inset-0 rounded-full border border-[hsl(var(--color-primary)/0.06)] animate-ping [animation-duration:3.5s]" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 blur-3xl bg-[hsl(var(--color-primary)/0.2)] rounded-full scale-150" />
                  <div className="relative animate-[logo-breathe_3s_ease-in-out_infinite]">
                    <Image
                      src="/logo-icon.png"
                      alt={t('landing.logoAlt', 'حسابچه')}
                      width={180}
                      height={120}
                      className="w-36 h-auto xl:w-52 drop-shadow-[0_0_40px_hsl(var(--color-primary)/0.5)]"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="absolute inset-0 -z-10 blur-[100px]"
              style={{
                background:
                  'radial-gradient(ellipse 50% 50% at 50% 50%, hsl(var(--color-primary)/0.12), transparent)',
              }}
              aria-hidden="true"
            />
          </div>

          {/* ── Mobile: small centred logo (order-1, first) ── */}
          <div
            className={cn(
              'lg:hidden flex items-center justify-center order-1',
              'opacity-0 animate-[fade-in-up_0.6s_ease-out_0.25s_both]',
            )}
          >
            <div className="relative animate-[logo-breathe_3s_ease-in-out_infinite]">
              <Image
                src="/logo-icon.png"
                alt={t('landing.logoAlt', 'حسابچه')}
                width={100}
                height={66}
                className="w-24 sm:w-28 h-auto drop-shadow-[0_0_30px_hsl(var(--color-primary)/0.4)]"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
