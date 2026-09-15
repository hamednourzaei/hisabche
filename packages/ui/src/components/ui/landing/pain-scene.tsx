// packages/ui/src/components/ui/landing/pain-scene.tsx
'use client'

import { formatNumber } from '@hisabche/formatting'
import { useSceneObserver } from './use-scene-observer'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { cn } from '../../../lib/utils'
import { Clock } from 'lucide-react'
import {
  ForwardArrow,
  LANDING_CONTAINER,
  LANDING_SECTION,
  LANDING_TYPE,
  SectionLabel,
} from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   PainScene v13 — Card grid (layout adapted from shadcn-dashboard-landing-template, MIT)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PainSceneProps {
  t: (key: string, fallback?: string) => string
}

interface PainItem {
  /** Translation key for the timeline chip; the literal below is the fa fallback. */
  timelineKey: string
  timelineLabel: string
  headlineKey: string
  headlineFallback: string
  descriptionKey: string
  descriptionFallback: string
  /** Carries the «hours lost» figure under its description. */
  showsTimeStat?: boolean
  climax?: boolean
}

const PAIN_POINTS: PainItem[] = [
  {
    timelineKey: 'landing.painTimeline1',
    timelineLabel: 'امروز صبح',
    headlineKey: 'landing.pain1Title',
    headlineFallback: 'دفتر گم می‌شود',
    descriptionKey: 'landing.pain1Desc',
    descriptionFallback:
      'تمام حساب‌هایت را در یک دفتر می‌نویسی. یک روز دفتر پاره، خیس یا گم می‌شود — سال‌ها اطلاعات در چند دقیقه از بین می‌رود.',
  },
  {
    timelineKey: 'landing.painTimeline2',
    timelineLabel: 'آخر شب',
    headlineKey: 'landing.pain2Title',
    headlineFallback: 'اشتباه‌های آخر شب',
    descriptionKey: 'landing.pain2Desc',
    descriptionFallback:
      'خسته‌ای، اما نیم ساعت جمع و تفریق می‌کنی. یک اشتباه کوچک یعنی سود امروز را اشتباه می‌بینی و تصمیم غلط می‌گیری.',
  },
  {
    timelineKey: 'landing.painTimeline3',
    timelineLabel: 'یک هفته بعد',
    headlineKey: 'landing.pain3Title',
    headlineFallback: 'نسیه‌هایی که فراموش می‌شوند',
    descriptionKey: 'landing.pain3Desc',
    descriptionFallback:
      'مشتری نسیه می‌برد، تو ثبت می‌کنی. یک هفته بعد نه تو به یاد می‌آوری، نه او. پولت در هوا می‌ماند.',
  },
  {
    timelineKey: 'landing.painTimeline4',
    timelineLabel: 'آخر ماه',
    headlineKey: 'landing.pain4Title',
    headlineFallback: 'سود واقعی نامشخص است',
    descriptionKey: 'landing.pain4Desc',
    descriptionFallback:
      'فقط پول صندوق را می‌بینی. نمی‌دانی چه مقدار از فروش واقعاً سود بوده و کجا ضرر کرده‌ای.',
  },
  {
    timelineKey: 'landing.painTimeline5',
    timelineLabel: 'وسط هفته',
    headlineKey: 'landing.pain5Title',
    headlineFallback: 'موجودی ناگهان تمام می‌شود',
    descriptionKey: 'landing.pain5Desc',
    descriptionFallback:
      'مشتری جنس می‌خواهد، ولی همان لحظه می‌فهمی کالا تمام شده. فروش از دست می‌رود، اعتبارت خدشه‌دار می‌شود.',
  },
  {
    timelineKey: 'landing.painTimeline6',
    timelineLabel: 'هر روز',
    headlineKey: 'landing.pain6Title',
    headlineFallback: 'کارمندها شفاهی گزارش می‌دهند',
    descriptionKey: 'landing.pain6Desc',
    descriptionFallback:
      'هیچ ثبت دقیقی نیست. نمی‌دانی چه کسی چه فروخته، چه مبلغی گرفته، یا چه چیزی کم شده است.',
  },
  {
    showsTimeStat: true,
    timelineKey: 'landing.painTimeline7',
    timelineLabel: 'هر روز',
    headlineKey: 'landing.pain7Title',
    headlineFallback: 'ساعت‌ها صرف نوشتن می‌شود',
    descriptionKey: 'landing.pain7Desc',
    descriptionFallback:
      'به جای فروش بیشتر، وقتت تلف نوشتن، جمع زدن و جستجوی اطلاعات می‌شود. روزانه ۲ ساعت، سالانه ۷۳۰ ساعت.',
  },
  {
    timelineKey: 'landing.painTimeline8',
    timelineLabel: 'همیشه در نگرانی',
    headlineKey: 'landing.pain8Title',
    headlineFallback: 'ترس از نابودی همه اطلاعات',
    descriptionKey: 'landing.pain8Desc',
    descriptionFallback:
      'خراب شدن گوشی، گم شدن دفتر، یا پاک شدن فایل اکسل می‌تواند کل کسب‌وکارت را نابود کند.',
    climax: true,
  },
]

export default function PainScene({ t }: PainSceneProps) {
  // Digits follow the reader's language: «۱» in fa/af, «1» in en.
  const locale = useIntlLocale()
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({ threshold: 0.3, narrativeState: 'confusion' })

  const scrollToSolution = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="pain" ref={ref} data-narrative="confusion" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        {/* MOBILE FIRST: heading → list → conclusion, one column. From `lg`
            the template's About layout: heading and conclusion share the
            narrow column, the list takes the wide one across both rows. */}
        {/* `lg:grid-rows-[auto_1fr]`: the list spans both rows, and without
            it the grid shared the list's height between them — the heading row
            grew as tall as the cards and pushed the conclusion far below the
            title. Now row 1 hugs the heading, row 2 takes the rest, and the
            conclusion sits 8px under the title. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-2">
          <div className="lg:col-start-1 lg:row-start-1">
            <SectionLabel>{t('landing.painLabel', 'دنیای بدون حسابچه')}</SectionLabel>
            <h2
              className={cn(
                'mt-3 text-balance font-bold tracking-tight text-[hsl(var(--fg-primary))] sm:mt-4',
                LANDING_TYPE.h2,
              )}
            >
              {t('landing.painTitle', 'هر روز که می‌گذرد، کنترل کمتری داری')}
            </h2>
          </div>

          {/* One grouped list of compact rows on phones (a card per item was
              1634px of scrolling); separate cards in two columns from `sm`. */}
          <ol
            className={cn(
              'divide-y divide-[hsl(var(--border-default)/0.7)] overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)]',
              'sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:border-0 sm:bg-transparent',
              'lg:col-start-2 lg:row-span-2 lg:row-start-1',
            )}
          >
            {PAIN_POINTS.map((item, index) => (
              <li
                key={item.headlineKey}
                className={cn(
                  'flex gap-3 px-4 py-4',
                  'sm:flex-col sm:gap-0 sm:rounded-xl sm:border sm:p-6',
                  item.climax
                    ? 'bg-[hsl(var(--color-primary)/0.06)] sm:border-[hsl(var(--color-primary)/0.35)]'
                    : 'sm:border-[hsl(var(--border-default))] sm:bg-[hsl(var(--surface-elevated)/0.6)]',
                )}
              >
                <div className="sm:mb-4 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums sm:size-9',
                      item.climax
                        ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]'
                        : 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]',
                    )}
                  >
                    {formatNumber(index + 1, locale)}
                  </span>
                  <span className="hidden text-xs text-[hsl(var(--fg-tertiary))] sm:inline">
                    {t(item.timelineKey, item.timelineLabel)}
                  </span>
                </div>
                <div className="min-w-0 sm:flex sm:flex-1 sm:flex-col">
                  {/* On phones the timeline chip rides above the headline. */}
                  <p className="text-xs text-[hsl(var(--fg-tertiary))] sm:hidden">
                    {t(item.timelineKey, item.timelineLabel)}
                  </p>
                  <h3 className="mb-1 text-[0.9375rem] font-semibold text-[hsl(var(--fg-primary))] sm:mb-2 sm:text-base">
                    {t(item.headlineKey, item.headlineFallback)}
                  </h3>
                  <p className={cn('text-[hsl(var(--fg-secondary))]', LANDING_TYPE.body)}>
                    {t(item.descriptionKey, item.descriptionFallback)}
                  </p>
                  {item.showsTimeStat && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[hsl(var(--fg-tertiary))] sm:mt-auto sm:pt-4">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {t('landing.pain7Stat', '۲ ساعت در روز · ۷۳۰ ساعت در سال')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            <p className="mb-2 text-base font-semibold text-[hsl(var(--fg-primary))] sm:mb-3 sm:text-lg">
              {t('landing.painClimaxTitle', 'دیگر ادامه دادن این روش اشتباه است')}
            </p>
            <p
              className={cn(
                'mb-5 text-pretty text-[hsl(var(--fg-secondary))] sm:mb-8',
                LANDING_TYPE.lead,
              )}
            >
              {t(
                'landing.painClimaxDesc',
                'تو هر روز بیشتر کار می‌کنی، اما هر روز کنترل کمتری روی کسب‌وکارت داری. وقت تغییر است.',
              )}
            </p>
            <button
              type="button"
              onClick={scrollToSolution}
              className="btn-secondary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm sm:w-auto"
            >
              {t('landing.painSeeSolution', 'حسابچه چطور کمک می‌کند')}
              <ForwardArrow />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
