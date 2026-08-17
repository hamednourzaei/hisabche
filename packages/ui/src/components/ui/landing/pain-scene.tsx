// packages/ui/src/components/ui/landing/pain-scene.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { cn } from '../../../lib/utils'
import { ArrowLeft, Clock } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   PainScene v12 — Timeline preserved on mobile · Scaled, not redesigned
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PainSceneProps {
  t: (key: string, fallback?: string) => string
}

interface PainItem {
  number: string
  /** Translation key for the timeline chip; the literal below is the fa fallback. */
  timelineKey: string
  timelineLabel: string
  headlineKey: string
  headlineFallback: string
  descriptionKey: string
  descriptionFallback: string
  intensity: 1 | 2 | 3 | 4 | 5
  climax?: boolean
}

const PAIN_POINTS: PainItem[] = [
  {
    number: '۰۱',
    timelineKey: 'landing.painTimeline1',
    timelineLabel: 'امروز صبح',
    headlineKey: 'landing.pain1Title',
    headlineFallback: 'دفتر گم می‌شود',
    descriptionKey: 'landing.pain1Desc',
    descriptionFallback:
      'تمام حساب‌هایت را در یک دفتر می‌نویسی. یک روز دفتر پاره، خیس یا گم می‌شود — سال‌ها اطلاعات در چند دقیقه از بین می‌رود.',
    intensity: 1,
  },
  {
    number: '۰۲',
    timelineKey: 'landing.painTimeline2',
    timelineLabel: 'آخر شب',
    headlineKey: 'landing.pain2Title',
    headlineFallback: 'اشتباه‌های آخر شب',
    descriptionKey: 'landing.pain2Desc',
    descriptionFallback:
      'خسته‌ای، اما نیم ساعت جمع و تفریق می‌کنی. یک اشتباه کوچک یعنی سود امروز را اشتباه می‌بینی و تصمیم غلط می‌گیری.',
    intensity: 1,
  },
  {
    number: '۰۳',
    timelineKey: 'landing.painTimeline3',
    timelineLabel: 'یک هفته بعد',
    headlineKey: 'landing.pain3Title',
    headlineFallback: 'نسیه‌هایی که فراموش می‌شوند',
    descriptionKey: 'landing.pain3Desc',
    descriptionFallback:
      'مشتری نسیه می‌برد، تو ثبت می‌کنی. یک هفته بعد نه تو به یاد می‌آوری، نه او. پولت در هوا می‌ماند.',
    intensity: 2,
  },
  {
    number: '۰۴',
    timelineKey: 'landing.painTimeline4',
    timelineLabel: 'آخر ماه',
    headlineKey: 'landing.pain4Title',
    headlineFallback: 'سود واقعی نامشخص است',
    descriptionKey: 'landing.pain4Desc',
    descriptionFallback:
      'فقط پول صندوق را می‌بینی. نمی‌دانی چه مقدار از فروش واقعاً سود بوده و کجا ضرر کرده‌ای.',
    intensity: 3,
  },
  {
    number: '۰۵',
    timelineKey: 'landing.painTimeline5',
    timelineLabel: 'وسط هفته',
    headlineKey: 'landing.pain5Title',
    headlineFallback: 'موجودی ناگهان تمام می‌شود',
    descriptionKey: 'landing.pain5Desc',
    descriptionFallback:
      'مشتری جنس می‌خواهد، ولی همان لحظه می‌فهمی کالا تمام شده. فروش از دست می‌رود، اعتبارت خدشه‌دار می‌شود.',
    intensity: 3,
  },
  {
    number: '۰۶',
    timelineKey: 'landing.painTimeline6',
    timelineLabel: 'هر روز',
    headlineKey: 'landing.pain6Title',
    headlineFallback: 'کارمندها شفاهی گزارش می‌دهند',
    descriptionKey: 'landing.pain6Desc',
    descriptionFallback:
      'هیچ ثبت دقیقی نیست. نمی‌دانی چه کسی چه فروخته، چه مبلغی گرفته، یا چه چیزی کم شده است.',
    intensity: 3,
  },
  {
    number: '۰۷',
    timelineKey: 'landing.painTimeline7',
    timelineLabel: 'هر روز',
    headlineKey: 'landing.pain7Title',
    headlineFallback: 'ساعت‌ها صرف نوشتن می‌شود',
    descriptionKey: 'landing.pain7Desc',
    descriptionFallback:
      'به جای فروش بیشتر، وقتت تلف نوشتن، جمع زدن و جستجوی اطلاعات می‌شود. روزانه ۲ ساعت، سالانه ۷۳۰ ساعت.',
    intensity: 4,
  },
  {
    number: '۰۸',
    timelineKey: 'landing.painTimeline8',
    timelineLabel: 'همیشه در نگرانی',
    headlineKey: 'landing.pain8Title',
    headlineFallback: 'ترس از نابودی همه اطلاعات',
    descriptionKey: 'landing.pain8Desc',
    descriptionFallback:
      'خراب شدن گوشی، گم شدن دفتر، یا پاک شدن فایل اکسل می‌تواند کل کسب‌وکارت را نابود کند.',
    intensity: 5,
    climax: true,
  },
]

function intensityStyles(intensity: number) {
  const borderMap: Record<number, string> = {
    1: 'border-[hsl(var(--color-destructive)/0.08)]',
    2: 'border-[hsl(var(--color-destructive)/0.14)]',
    3: 'border-[hsl(var(--color-destructive)/0.22)]',
    4: 'border-[hsl(var(--color-destructive)/0.3)]',
    5: 'border-[hsl(var(--color-primary)/0.35)]',
  }
  const bgMap: Record<number, string> = {
    1: 'bg-[hsl(var(--surface-elevated)/0.2)]',
    2: 'bg-[hsl(var(--surface-elevated)/0.3)]',
    3: 'bg-[hsl(var(--surface-elevated)/0.4)]',
    4: 'bg-[hsl(var(--surface-elevated)/0.55)]',
    5: 'bg-[hsl(var(--color-primary)/0.04)]',
  }
  const nodeBgMap: Record<number, string> = {
    1: 'bg-[hsl(var(--surface-base))] border-[hsl(var(--color-destructive)/0.2)] text-[hsl(var(--fg-secondary))]',
    2: 'bg-[hsl(var(--surface-base))] border-[hsl(var(--color-destructive)/0.25)] text-[hsl(var(--fg-primary))]',
    3: 'bg-[hsl(var(--surface-base))] border-[hsl(var(--color-destructive)/0.3)] text-[hsl(var(--fg-primary))]',
    4: 'bg-[hsl(var(--surface-base))] border-[hsl(var(--color-destructive)/0.35)] text-[hsl(var(--fg-primary))]',
    5: 'bg-[hsl(var(--color-primary)/0.12)] border-[hsl(var(--color-primary)/0.5)] text-[hsl(var(--color-primary))]',
  }
  return {
    border: borderMap[intensity] || borderMap[1],
    bg: bgMap[intensity] || bgMap[1],
    node: nodeBgMap[intensity] || nodeBgMap[1],
  }
}

export default function PainScene({ t }: PainSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: 'confusion',
  })

  const animated = state === 'animated'

  const scrollToSolution = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="pain"
      ref={ref}
      data-narrative="confusion"
      className="py-12 sm:py-16 lg:py-20 relative"
    >
      <div className="container-narrow max-w-5xl px-4 sm:px-6">
        {/* ── Header ── */}
        <div
          className={cn(
            'text-center mb-10 sm:mb-16 lg:mb-24',
            'transition-all duration-700 motion-reduce:transition-none',
            animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
          )}
        >
          <p className="text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.25em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t('landing.painLabel', 'دنیای بدون حسابچه')}
          </p>
          <h2 className="text-lg sm:text-2xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight px-4 sm:px-0">
            {t('landing.painTitle', 'هر روز که می‌گذرد، کنترل کمتری داری')}
          </h2>
        </div>

        {/* ── Timeline ── */}
        <div className="relative">
          {/* Central line: always visible, shifts on mobile */}
          <div
            className="absolute left-4 sm:left-1/2 sm:-translate-x-1/2 top-0 bottom-0 w-px"
            style={{
              background:
                'linear-gradient(to bottom, hsl(var(--color-destructive)/0.15), hsl(var(--color-destructive)/0.25) 70%, hsl(var(--color-primary)/0.3))',
            }}
            aria-hidden="true"
          />

          <div className="space-y-4 sm:space-y-8 lg:space-y-14">
            {PAIN_POINTS.map((item, i) => {
              const isLeft = i % 2 === 1
              const styles = intensityStyles(item.intensity)
              const directionClass = isLeft ? 'sm:flex-row' : 'sm:flex-row-reverse'

              return (
                <div
                  key={item.headlineKey}
                  className={cn(
                    'group relative flex items-center',
                    directionClass,
                    'opacity-0 transition-all duration-700 ease-out motion-reduce:transition-none',
                    animated && 'opacity-100 translate-x-0',
                  )}
                  style={{
                    transitionDelay: `${i * 100}ms`,
                    transform: animated ? undefined : `translateX(${isLeft ? -40 : 40}px)`,
                  }}
                >
                  {/* Node: left-aligned on mobile, centred on desktop */}
                  <div className="absolute left-4 sm:left-1/2 sm:-translate-x-1/2 z-10 flex flex-col items-center gap-0.5 sm:gap-1">
                    <span className="hidden sm:block text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] text-[hsl(var(--fg-tertiary))] whitespace-nowrap leading-none">
                      {t(item.timelineKey, item.timelineLabel)}
                    </span>
                    <div
                      className={cn(
                        'w-6 h-6 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] lg:text-sm font-bold border-2 transition-all duration-300',
                        styles.node,
                        'group-hover:scale-110 group-hover:shadow-[0_0_16px_hsl(var(--color-primary)/0.3)]',
                        'motion-reduce:group-hover:scale-100',
                      )}
                    >
                      {item.number}
                    </div>
                  </div>

                  {/* Content card */}
                  <div
                    className={cn(
                      'w-full sm:w-[calc(50%-2.5rem)] relative ml-10 sm:ml-0 p-3 sm:p-4 lg:p-7 rounded-lg sm:rounded-xl lg:rounded-[var(--radius-lg)] transition-all duration-300',
                      styles.border,
                      styles.bg,
                      'group-hover:-translate-y-1 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
                      'motion-reduce:group-hover:translate-y-0',
                      item.climax && 'sm:p-5 lg:p-8 border-[hsl(var(--color-primary)/0.4)]',
                    )}
                  >
                    {/* Mobile timeline label */}
                    <div className="flex sm:hidden items-center gap-1.5 mb-1.5">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-full text-[8px] font-bold',
                          item.intensity < 5
                            ? 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]'
                            : 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]',
                        )}
                      >
                        {item.number}
                      </span>
                      <span className="text-[9px] font-medium text-[hsl(var(--fg-tertiary))] uppercase tracking-wider">
                        {t(item.timelineKey, item.timelineLabel)}
                      </span>
                    </div>

                    <h3
                      className={cn(
                        'text-xs sm:text-base lg:text-xl font-bold mb-1 sm:mb-1.5 lg:mb-2',
                        item.intensity >= 4
                          ? 'text-[hsl(var(--color-primary))]'
                          : 'text-[hsl(var(--fg-primary))]',
                      )}
                    >
                      {t(item.headlineKey, item.headlineFallback)}
                    </h3>
                    <p className="text-[11px] sm:text-xs lg:text-base text-[hsl(var(--fg-secondary))] leading-relaxed line-clamp-3 sm:line-clamp-none">
                      {t(item.descriptionKey, item.descriptionFallback)}
                    </p>

                    {/* Stat highlight for pain 07 */}
                    {item.number === '۰۷' && (
                      <div className="mt-2 sm:mt-3 lg:mt-4 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] lg:text-sm text-[hsl(var(--fg-tertiary))]">
                        <Clock className="size-2.5 sm:size-3 lg:size-3.5" />
                        <span>{t('landing.pain7Stat', '۲ ساعت در روز · ۷۳۰ ساعت در سال')}</span>
                      </div>
                    )}

                    {/* Connector line to centre (desktop only) */}
                    <div
                      className={cn(
                        'hidden sm:block absolute top-1/2 w-6 sm:w-8 h-px transition-colors duration-300',
                        item.intensity < 5
                          ? 'bg-[hsl(var(--color-destructive)/0.18)] group-hover:bg-[hsl(var(--color-destructive)/0.35)]'
                          : 'bg-[hsl(var(--color-primary)/0.3)] group-hover:bg-[hsl(var(--color-primary)/0.5)]',
                        isLeft ? 'right-0 translate-x-full' : 'left-0 -translate-x-full',
                      )}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Emotional climax + transition to solution ── */}
        <div
          className={cn(
            'mt-12 sm:mt-20 lg:mt-28 text-center relative',
            'transition-all duration-700 delay-500 motion-reduce:transition-none',
            animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
          )}
        >
          {/* Bridge node */}
          <div className="flex justify-center mb-4 sm:mb-5 lg:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-[hsl(var(--color-primary)/0.1)] border-2 border-[hsl(var(--color-primary)/0.4)] flex items-center justify-center animate-pulse [animation-duration:2.5s]">
              <span className="text-base sm:text-lg">⚡</span>
            </div>
          </div>

          <p className="text-base sm:text-lg lg:text-2xl font-bold text-[hsl(var(--fg-primary))] mb-2 sm:mb-3">
            {t('landing.painClimaxTitle', 'دیگر ادامه دادن این روش اشتباه است')}
          </p>
          <p className="text-xs sm:text-sm lg:text-base text-[hsl(var(--fg-secondary))] max-w-md mx-auto leading-relaxed mb-4 sm:mb-6 lg:mb-8 px-4 sm:px-0">
            {t(
              'landing.painClimaxDesc',
              'تو هر روز بیشتر کار می‌کنی، اما هر روز کنترل کمتری روی کسب‌وکارت داری. وقت تغییر است.',
            )}
          </p>

          <button
            type="button"
            onClick={scrollToSolution}
            className={cn(
              'inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-full',
              'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] font-semibold text-xs sm:text-sm lg:text-base',
              'hover:bg-[hsl(var(--color-primary-hover))] transition-colors duration-200',
              'shadow-[0_4px_20px_hsl(var(--color-primary)/0.25)]',
            )}
          >
            {t('landing.painSeeSolution', 'حسابچه چطور کمک می‌کند')}
            <ArrowLeft className="size-3 sm:size-3.5 lg:size-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </section>
  )
}
