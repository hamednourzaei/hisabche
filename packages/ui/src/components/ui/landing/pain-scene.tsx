// packages/ui/src/components/ui/landing/pain-scene.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { cn } from '../../../lib/utils'
import { ArrowLeft, Clock } from 'lucide-react'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   PainScene v13 — Card grid (layout adapted from shadcn-dashboard-landing-template, MIT)
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

export default function PainScene({ t }: PainSceneProps) {
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({ threshold: 0.3, narrativeState: 'confusion' })

  const scrollToSolution = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="pain" ref={ref} data-narrative="confusion" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.painLabel', 'دنیای بدون حسابچه')}
          title={t('landing.painTitle', 'هر روز که می‌گذرد، کنترل کمتری داری')}
        />

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAIN_POINTS.map((item) => (
            <li
              key={item.number}
              className={cn(
                'flex flex-col rounded-xl border p-5 sm:p-6',
                item.climax
                  ? 'border-[hsl(var(--color-primary)/0.35)] bg-[hsl(var(--color-primary)/0.06)]'
                  : 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)]',
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                    item.climax
                      ? 'bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]'
                      : 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]',
                  )}
                >
                  {item.number}
                </span>
                <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t(item.timelineKey, item.timelineLabel)}
                </span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[hsl(var(--fg-primary))]">
                {t(item.headlineKey, item.headlineFallback)}
              </h3>
              <p className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                {t(item.descriptionKey, item.descriptionFallback)}
              </p>
              {item.number === '۰۷' && (
                <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-[hsl(var(--fg-tertiary))]">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {t('landing.pain7Stat', '۲ ساعت در روز · ۷۳۰ ساعت در سال')}
                </p>
              )}
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-14 max-w-xl text-center">
          <p className="mb-3 text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
            {t('landing.painClimaxTitle', 'دیگر ادامه دادن این روش اشتباه است')}
          </p>
          <p className="mb-6 text-sm leading-relaxed text-[hsl(var(--fg-secondary))] sm:text-base">
            {t(
              'landing.painClimaxDesc',
              'تو هر روز بیشتر کار می‌کنی، اما هر روز کنترل کمتری روی کسب‌وکارت داری. وقت تغییر است.',
            )}
          </p>
          <button
            type="button"
            onClick={scrollToSolution}
            className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-6 text-sm"
          >
            {t('landing.painSeeSolution', 'حسابچه چطور کمک می‌کند')}
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
