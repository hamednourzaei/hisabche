// packages/ui/src/components/ui/landing/transform-scene.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { cn } from '../../../lib/utils'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Shield,
  Sparkles,
  Zap,
  Package,
  Wallet,
  UserCheck,
  Database,
  Cloud,
  FileText,
  Smile,
  X,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   TransformScene v21 — Cinematic Story · Only activates when visible
   ═══════════════════════════════════════════════════════════════════════════ */

import { useTranslations } from 'next-intl'

export interface TransformSceneProps {
  t?: ((key: string, fallback?: string) => string) | undefined
}

// ─── Story Steps ──────────────────────────────────────────────────────────

interface StoryStep {
  id: string
  icon: React.ElementType
  labelKey: string
  labelFallback: string
  descriptionKey: string
  descriptionFallback: string
  color: string
  beforeLabelKey: string
  beforeLabelFallback: string
}

const STORY_STEPS: StoryStep[] = [
  {
    id: 'sale',
    icon: Zap,
    labelKey: 'landing.transformStep.sale.label',
    labelFallback: 'ثبت فروش',
    descriptionKey: 'landing.transformStep.sale.desc',
    descriptionFallback: 'فروش را ثبت می‌کنی',
    color: 'text-[hsl(var(--color-info))]',
    beforeLabelKey: 'landing.transformStep.sale.before',
    beforeLabelFallback: 'ثبت دستی با کاغذ',
  },
  {
    id: 'invoice',
    icon: FileText,
    labelKey: 'landing.transformStep.invoice.label',
    labelFallback: 'فاکتور',
    descriptionKey: 'landing.transformStep.invoice.desc',
    descriptionFallback: 'فاکتور خودکار ساخته می‌شود',
    color: 'text-emerald-400',
    beforeLabelKey: 'landing.transformStep.invoice.before',
    beforeLabelFallback: 'نوشتن فاکتور دستی',
  },
  {
    id: 'inventory',
    icon: Package,
    labelKey: 'landing.transformStep.inventory.label',
    labelFallback: 'انبار',
    descriptionKey: 'landing.transformStep.inventory.desc',
    descriptionFallback: 'موجودی به‌روز می‌شود',
    color: 'text-amber-400',
    beforeLabelKey: 'landing.transformStep.inventory.before',
    beforeLabelFallback: 'حدس موجودی',
  },
  {
    id: 'accounting',
    icon: Wallet,
    labelKey: 'landing.transformStep.accounting.label',
    labelFallback: 'حسابداری',
    descriptionKey: 'landing.transformStep.accounting.desc',
    descriptionFallback: 'سود لحظه‌ای محاسبه می‌شود',
    color: 'text-purple-400',
    beforeLabelKey: 'landing.transformStep.accounting.before',
    beforeLabelFallback: 'محاسبه با ماشین حساب',
  },
  {
    id: 'debt',
    icon: UserCheck,
    labelKey: 'landing.transformStep.debt.label',
    labelFallback: 'نسیه',
    descriptionKey: 'landing.transformStep.debt.desc',
    descriptionFallback: 'بدهی مشتری ثبت می‌شود',
    color: 'text-rose-400',
    beforeLabelKey: 'landing.transformStep.debt.before',
    beforeLabelFallback: 'نسیه در دفترچه',
  },
  {
    id: 'backup',
    icon: Database,
    labelKey: 'landing.transformStep.backup.label',
    labelFallback: 'بک‌آپ',
    descriptionKey: 'landing.transformStep.backup.desc',
    descriptionFallback: 'نسخه پشتیبان گرفته می‌شود',
    color: 'text-cyan-400',
    beforeLabelKey: 'landing.transformStep.backup.before',
    beforeLabelFallback: 'ترس از گم شدن داده',
  },
  {
    id: 'sync',
    icon: Cloud,
    labelKey: 'landing.transformStep.sync.label',
    labelFallback: 'همگام‌سازی',
    descriptionKey: 'landing.transformStep.sync.desc',
    descriptionFallback: 'همه دستگاه‌ها هماهنگ می‌شوند',
    color: 'text-indigo-400',
    beforeLabelKey: 'landing.transformStep.sync.before',
    beforeLabelFallback: 'داده‌های پراکنده',
  },
  {
    id: 'smile',
    icon: Smile,
    labelKey: 'landing.transformStep.smile.label',
    labelFallback: 'آرامش',
    descriptionKey: 'landing.transformStep.smile.desc',
    descriptionFallback: 'همه‌چیز تحت کنترل است',
    color: 'text-[hsl(var(--color-success))]',
    beforeLabelKey: 'landing.transformStep.smile.before',
    beforeLabelFallback: 'استرس و سردرگمی',
  },
]

// ─── Sleep helper ─────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Cinematic Story Component ──────────────────────────────────────────

function CinematicStory({ t }: { t: (key: string, fallback?: string) => string }) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [completed, setCompleted] = useState<number[]>([])
  const [showBefore, setShowBefore] = useState(true)
  const [phase, setPhase] = useState<'before' | 'transition' | 'after'>('before')
  const [showAlert, setShowAlert] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasPlayed = useRef(false)
  const isPlaying = useRef(false)

  const playStory = useCallback(async () => {
    if (isPlaying.current) return
    isPlaying.current = true
    hasPlayed.current = true

    setPhase('before')
    setShowBefore(true)
    setCompleted([])
    setActiveIndex(-1)
    setShowAlert(true)

    await sleep(3000)

    setPhase('transition')
    setShowBefore(false)

    for (let i = 0; i < STORY_STEPS.length; i++) {
      setActiveIndex(i)
      await sleep(300)
      setCompleted((prev) => [...prev, i])
      setActiveIndex(-1)
    }

    await sleep(300)
    setPhase('after')
    isPlaying.current = false
  }, [])

  const resetStory = useCallback(() => {
    hasPlayed.current = false
    isPlaying.current = false
    setPhase('before')
    setShowBefore(true)
    setCompleted([])
    setActiveIndex(-1)
    setShowAlert(true)
  }, [])

  const handleCloseAlert = useCallback(() => {
    setShowAlert(false)
    setPhase('transition')
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return

        if (!entry.isIntersecting) {
          resetStory()
          return
        }

        if (hasPlayed.current) return
        playStory()
      },
      { threshold: 0.4 },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
      resetStory()
    }
  }, [playStory, resetStory])

  return (
    <div ref={containerRef} className="relative min-h-[420px] sm:min-h-[480px] lg:min-h-[520px]">
      {/* ── Before State ── */}
      {showBefore && phase === 'before' && (
        <div className="absolute inset-0 z-10 bg-[hsl(var(--surface-elevated))] rounded-2xl flex items-center justify-center p-6 sm:p-8 animate-[fade-in_0.5s_ease-out]">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-3">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[hsl(var(--color-destructive)/0.08)] border-4 border-[hsl(var(--color-destructive)/0.15)] flex items-center justify-center">
                  <XCircle className="size-8 sm:size-10 text-[hsl(var(--color-destructive))]" />
                </div>
                <div className="absolute -top-2 -end-2 w-7 h-7 rounded-full bg-[hsl(var(--color-destructive))] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
              </div>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-[hsl(var(--fg-primary))] mb-1.5">
              {t('landing.transformBeforeTitle', 'قبل از حسابچه')}
            </h3>
            <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
              {t(
                'landing.transformBeforeDesc',
                'همه کارها را دستی انجام می‌دادی. وقتت تلف می‌شد، اشتباه می‌کردی، استرس داشتی.',
              )}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-[hsl(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
                {t('landing.transformBeforeLoading', 'در حال تحول...')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline with Blur ── */}
      <div
        className={cn(
          'relative py-3 sm:py-4 px-3 sm:px-4',
          'transition-all duration-700 ease-out',
          phase === 'after' && showAlert
            ? 'blur-[6px] scale-[0.96] opacity-40 pointer-events-none'
            : 'blur-0 scale-100 opacity-100 pointer-events-auto',
        )}
      >
        {/* Vertical line */}
        <div className="absolute start-4 sm:start-1/2 top-0 bottom-0 w-0.5 bg-[hsl(var(--border-default))] -translate-x-1/2 hidden sm:block" />
        <div className="absolute start-4 top-0 bottom-0 w-0.5 bg-[hsl(var(--border-default))] sm:hidden" />

        <div className="space-y-2 sm:space-y-3 lg:space-y-3.5">
          {STORY_STEPS.map((step, index) => {
            const isCompleted = completed.includes(index)
            const isActive = activeIndex === index
            const isWaiting =
              phase === 'before' || (!isCompleted && !isActive && phase === 'transition')

            return (
              <div
                key={step.id}
                className={cn(
                  'relative flex items-start sm:items-center gap-2.5 sm:gap-3',
                  'transition-all duration-500',
                  isCompleted && 'opacity-100',
                  isActive && 'opacity-100 scale-[1.01]',
                  isWaiting && 'opacity-30',
                  phase === 'after' && 'opacity-100',
                )}
              >
                {/* Node */}
                <div className="shrink-0 relative z-10">
                  <div
                    className={cn(
                      'w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                      isCompleted
                        ? 'bg-[hsl(var(--color-success)/0.12)] border-[hsl(var(--color-success))] text-[hsl(var(--color-success))]'
                        : isActive
                          ? 'bg-[hsl(var(--color-primary)/0.12)] border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))] animate-pulse'
                          : phase === 'after'
                            ? 'bg-[hsl(var(--color-success)/0.08)] border-[hsl(var(--color-success)/0.3)] text-[hsl(var(--color-success))]'
                            : 'bg-[hsl(var(--surface-muted))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-tertiary))]',
                    )}
                  >
                    {isCompleted || phase === 'after' ? (
                      <CheckCircle2 className="size-3.5 sm:size-4" />
                    ) : isActive ? (
                      <step.icon className={cn('size-3.5 sm:size-4', step.color)} />
                    ) : (
                      <step.icon className="size-3.5 sm:size-4 text-[hsl(var(--fg-tertiary))]" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1.5">
                    <span
                      className={cn(
                        'text-[10px] sm:text-xs lg:text-sm font-semibold transition-colors duration-300 leading-tight',
                        isCompleted || phase === 'after'
                          ? 'text-[hsl(var(--fg-primary))]'
                          : isActive
                            ? 'text-[hsl(var(--color-primary))]'
                            : 'text-[hsl(var(--fg-tertiary))]',
                      )}
                    >
                      {t(step.labelKey, step.labelFallback)}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-[hsl(var(--fg-tertiary))] hidden sm:inline">
                      ·
                    </span>
                    <span
                      className={cn(
                        'text-[8px] sm:text-[9px] lg:text-xs transition-colors duration-300 leading-tight',
                        isCompleted || phase === 'after'
                          ? 'text-[hsl(var(--fg-secondary))]'
                          : isActive
                            ? 'text-[hsl(var(--fg-secondary))]'
                            : 'text-[hsl(var(--fg-tertiary))]',
                      )}
                    >
                      {t(step.descriptionKey, step.descriptionFallback)}
                    </span>
                  </div>

                  {isActive && (
                    <div className="mt-0.5 flex items-center gap-1 text-[8px] text-[hsl(var(--fg-tertiary))]">
                      <XCircle className="size-2" />
                      <span className="line-through">
                        {t(step.beforeLabelKey, step.beforeLabelFallback)}
                      </span>
                      <ArrowRight className="size-2" />
                      <span className="text-[hsl(var(--color-success))]">
                        ✓ {t('landing.transformAuto', 'خودکار')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0 hidden sm:block">
                  {isCompleted ? (
                    <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] font-semibold">
                      ✓ {t('landing.transformStatusDone', 'انجام شد')}
                    </span>
                  ) : isActive ? (
                    <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-semibold animate-pulse">
                      {t('landing.transformStatusRunning', 'در حال اجرا...')}
                    </span>
                  ) : phase === 'after' ? (
                    <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--color-success)/0.08)] text-[hsl(var(--color-success))] font-semibold">
                      ✓ {t('landing.transformStatusAuto', 'خودکار')}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── After State - Glass Alert Overlay ── */}
      {phase === 'after' && showAlert && (
        <div
          className={cn(
            'absolute inset-0 z-30',
            'flex items-center justify-center',
            'rounded-2xl',
            'bg-[hsl(var(--surface-base)/0.3)]',
            'backdrop-blur-md',
            'animate-[fade-in_0.6s_ease-out]',
          )}
        >
          <div
            className={cn(
              'max-w-sm w-full mx-3 relative',
              'rounded-2xl',
              'border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-elevated)/0.95)]',
              'backdrop-blur-xl',
              'shadow-[0_20px_60px_rgba(0,0,0,0.18)]',
              'p-5 sm:p-6',
              'text-center',
              'animate-[scale-in_0.5s_ease-out]',
            )}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseAlert}
              className={cn(
                'absolute top-2 end-2 sm:top-3 sm:end-3',
                'p-1 rounded-full',
                'text-[hsl(var(--fg-tertiary))]',
                'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                'transition-colors duration-200',
              )}
              aria-label={t('landing.transformClose', 'بستن')}
            >
              <X className="size-4 sm:size-5" />
            </button>

            <div className="flex justify-center mb-3">
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[hsl(var(--color-success)/0.12)] border-4 border-[hsl(var(--color-success)/0.3)] flex items-center justify-center">
                  <CheckCircle2 className="size-7 sm:size-8 text-[hsl(var(--color-success))]" />
                </div>
                <div className="absolute -top-1.5 -end-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[hsl(var(--color-success))] flex items-center justify-center shadow-lg">
                  <Sparkles className="size-3 sm:size-3.5 text-white" />
                </div>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--fg-primary))] mb-1.5">
              {t('landing.transformCompleteTitle', 'همه چیز خودکار شد')}
            </h3>

            <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
              {t(
                'landing.transformCompleteDesc',
                'حسابچه همه کارها را برایت انجام می‌دهد. تو فقط به کسب‌وکارت می‌رسی.',
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] font-semibold text-[hsl(var(--color-success))] bg-[hsl(var(--color-success)/0.08)] px-2.5 py-0.5 rounded-full">
                ✓ {t('landing.transformBadge1', '۸ عملیات در ۵ ثانیه')}
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] px-2.5 py-0.5 rounded-full">
                ✓ {t('landing.transformBadge2', 'کاملاً خودکار')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' })}
              className={cn(
                'mt-4 w-full',
                'inline-flex items-center justify-center gap-2',
                'px-4 py-2 sm:py-2.5 rounded-xl',
                'bg-[image:var(--gradient-brand)] text-white font-semibold text-xs sm:text-sm',
                'shadow-[0_4px_16px_hsl(var(--color-primary)/0.25)]',
                'hover:shadow-[0_8px_24px_hsl(var(--color-primary)/0.60)] hover:-translate-y-0.5',
                'transition-all duration-200',
              )}
            >
              {t('landing.transformStartNow', 'شروع کن')}
              <ArrowRight className="size-3.5 sm:size-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function TransformScene({ t: externalT }: TransformSceneProps = {}) {
  const intlT = useTranslations()
  const t =
    externalT ??
    ((key: string, fallback?: string) => {
      try {
        const res = intlT(key as any)
        return typeof res === 'string' && res !== key ? res : (fallback ?? key)
      } catch {
        return fallback ?? key
      }
    })

  const { ref, state } = useSceneObserver<HTMLDivElement>({
    // افزایش threshold برای فعال‌سازی دیرتر - فقط وقتی 35٪ از بخش دیده شد
    threshold: 0.6,
    // افزایش rootMargin منفی برای اطمینان از فعال‌سازی درست
    rootMargin: '0px 0px -60px 0px',
    narrativeState: 'clarity',
    // افزایش تاخیر mount
    mountDelayMs: 200,
  })

  const animated = state === 'animated'

  return (
    <section
      id="transform"
      ref={ref}
      data-narrative="clarity"
      className="py-8 sm:py-12 lg:py-16 bg-[hsl(var(--surface-base))] overflow-hidden"
    >
      <div className="container-narrow max-w-6xl px-4 sm:px-6">
        {/* بلوک هدر (transformBadge / transformTitle / transformHighlight /
            transformBridge) طبق درخواست حذف شد. */}

        {/* ── Cinematic Story ── */}
        <div
          className={cn(
            'relative',
            'transition-all duration-700 delay-100 motion-reduce:transition-none',
            animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
          )}
        >
          <div className="bg-[hsl(var(--surface-elevated))] rounded-2xl sm:rounded-3xl border border-[hsl(var(--border-default))] shadow-[var(--shadow-premium)] overflow-hidden">
            <div className="absolute -top-24 -start-24 w-48 h-48 bg-[hsl(var(--color-primary)/0.03)] rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-24 -end-24 w-48 h-48 bg-[hsl(var(--color-primary)/0.03)] rounded-full blur-2xl pointer-events-none" />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
                <div>
                  <h3 className="text-[10px] sm:text-xs lg:text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {t('landing.transformStoryTitle', 'پشت صحنه‌ی هر فروش')}
                  </h3>
                  <p className="text-[8px] sm:text-[9px] lg:text-[10px] text-[hsl(var(--fg-tertiary))] mt-0.5">
                    {t('landing.transformStorySub', '۸ عملیات خودکار در کمتر از ۵ ثانیه')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[hsl(var(--color-success))] animate-pulse" />
                  <span className="text-[7px] sm:text-[8px] lg:text-[10px] text-[hsl(var(--fg-tertiary))]">
                    {t('landing.transformLive', 'زنده')}
                  </span>
                </div>
              </div>

              {/* Story */}
              <CinematicStory t={t} />

              {/* Footer */}
              <div className="px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 pt-1 sm:pt-2 border-t border-[hsl(var(--border-default))]">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 sm:gap-3 text-[7px] sm:text-[8px] lg:text-[10px] text-[hsl(var(--fg-tertiary))]">
                    <span className="flex items-center gap-0.5">
                      <CheckCircle2 className="size-2.5 sm:size-3 text-[hsl(var(--color-success))]" />
                      {t('landing.transformFooter1', 'همه عملیات خودکار')}
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="flex items-center gap-0.5">
                      <Cloud className="size-2.5 sm:size-3 text-[hsl(var(--color-primary))]" />
                      {t('landing.transformFooter2', 'همگام‌سازی آنی')}
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="flex items-center gap-0.5">
                      <Shield className="size-2.5 sm:size-3 text-[hsl(var(--color-success))]" />
                      {t('landing.transformFooter3', 'بک‌آپ امن')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
