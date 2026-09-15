// packages/ui/src/components/ui/landing/cta-scene.tsx

// SERVER COMPONENT — no hooks, no handlers. Rendered to HTML on the server and
// never hydrated: every client component on the landing is JavaScript a slow
// phone has to run before it can respond (PageSpeed mobile TBT was 6.9 s).
import Link from 'next/link'
import { cn } from '../../../lib/utils'
import {
  DotPattern,
  ForwardArrow,
  LANDING_CONTAINER,
  LANDING_SECTION,
  LANDING_TYPE,
} from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   CTAScene v12 — Bordered band (layout adapted from shadcn-dashboard-landing-template, MIT)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CTASceneProps {
  t: (key: string, fallback?: string) => string
  /** Route locale segment (fa | af | en) for the signup link. */
  locale: string
}

// The hero proof bar carries the product facts; this closes on reach.
const PROOF = ['multiBusiness', 'platforms', 'languages'] as const

export default function CTAScene({ t, locale }: CTASceneProps) {
  return (
    <section id="cta" data-narrative="action" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--color-primary)/0.25)] bg-[hsl(var(--color-primary)/0.06)] px-5 py-10 text-center sm:px-12 sm:py-16 lg:py-20">
          <DotPattern />
          <div className="relative mx-auto max-w-2xl">
            {/* Product proof, not marketing claims: each is a property of the
                shipped software. No customer counts — none are measured. */}
            <ul className="mb-6 flex flex-wrap justify-center gap-2">
              {PROOF.map((key) => (
                <li
                  key={key}
                  className="rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-1 text-xs font-medium text-[hsl(var(--fg-secondary))] sm:text-sm"
                >
                  {t(`landing.proof.${key}`)}
                </li>
              ))}
            </ul>
            <h2
              className={cn(
                'mb-3 text-balance font-bold tracking-tight text-[hsl(var(--fg-primary))] sm:mb-4',
                LANDING_TYPE.h2,
              )}
            >
              {t('landing.ctaTitle', 'وقتی روز کاری‌ات تمام می‌شود، همه‌چیز باید از قبل مشخص باشد')}
            </h2>
            <p
              className={cn(
                'mx-auto mb-6 max-w-lg text-pretty text-[hsl(var(--fg-secondary))] sm:mb-8',
                LANDING_TYPE.lead,
              )}
            >
              {t(
                'landing.ctaSubtitle',
                'با حسابچه، پایان روز یعنی مرور نتایج — نه ساعت‌ها جمع‌زدن و پیدا کردن اشتباه‌ها',
              )}
            </p>
            <Link
              prefetch={false}
              href={`/${locale}/signup`}
              className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-8 text-base sm:w-auto"
            >
              {t('landing.ctaButton', 'شروع رایگان')}
              <ForwardArrow />
            </Link>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
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
