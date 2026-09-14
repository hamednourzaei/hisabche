// packages/ui/src/components/ui/landing/cta-scene.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { DotPattern, LANDING_CONTAINER, LANDING_SECTION } from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   CTAScene v12 — Bordered band (layout adapted from shadcn-dashboard-landing-template, MIT)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CTASceneProps {
  t: (key: string, fallback?: string) => string
  onNavigateLogin: () => void
}

export default function CTAScene({ t, onNavigateLogin }: CTASceneProps) {
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({ threshold: 0.3, narrativeState: 'action' })

  return (
    <section id="cta" ref={ref} data-narrative="action" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--color-primary)/0.25)] bg-[hsl(var(--color-primary)/0.06)] px-6 py-14 text-center sm:px-12 sm:py-20">
          <DotPattern />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="mb-4 text-balance text-2xl font-bold leading-[1.35] tracking-tight text-[hsl(var(--fg-primary))] sm:text-4xl">
              {t('landing.ctaTitle', 'وقتی روز کاری‌ات تمام می‌شود، همه‌چیز باید از قبل مشخص باشد')}
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-pretty text-base leading-relaxed text-[hsl(var(--fg-secondary))] sm:text-lg">
              {t(
                'landing.ctaSubtitle',
                'با حسابچه، پایان روز یعنی مرور نتایج — نه ساعت‌ها جمع‌زدن و پیدا کردن اشتباه‌ها',
              )}
            </p>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-8 text-base"
            >
              {t('landing.ctaButton', 'شروع رایگان')}
              <span aria-hidden="true">←</span>
            </button>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
              <span>{t('landing.ctaReassurance1', '۳۰ ثانیه')}</span>
              <span
                className="size-1 rounded-full bg-[hsl(var(--border-default))]"
                aria-hidden="true"
              />
              <span>{t('landing.ctaReassurance2', 'بدون کارت بانکی')}</span>
              <span
                className="size-1 rounded-full bg-[hsl(var(--border-default))]"
                aria-hidden="true"
              />
              <span>{t('landing.ctaReassurance3', 'لغو هر زمان')}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
