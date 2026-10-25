// packages/ui/src/components/ui/landing/cta-scene.tsx

// SERVER COMPONENT — no hooks, no handlers. Rendered to HTML on the server and
// never hydrated: every client component on the landing is JavaScript a slow
// phone has to run before it can respond (PageSpeed mobile TBT was 6.9 s).
//
// The one centred block on the page. Everything above it is a document read
// from the start edge; this is the last line, set wide, and it is the only
// place that asks for something.
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
   CTAScene v13 — the closing statement
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
        <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.55)] px-5 py-12 sm:px-12 sm:py-16 lg:py-24">
          <DotPattern fade="top" />

          <div className="relative mx-auto max-w-3xl text-center">
            {/* Product proof, not marketing claims: each is a property of the
                shipped software. No customer counts — none are measured. */}
            <ul className="flex flex-wrap justify-center gap-2">
              {PROOF.map((key) => (
                <li
                  key={key}
                  className="rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base)/0.7)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--fg-secondary))] sm:text-sm"
                >
                  {t(`landing.proof.${key}`)}
                </li>
              ))}
            </ul>

            <h2
              className={cn(
                'mt-6 text-balance font-black tracking-tight text-[hsl(var(--fg-primary))]',
                LANDING_TYPE.h2,
              )}
            >
              {t('landing.ctaTitle', 'وقتی روز کاری‌ات تمام می‌شود، همه‌چیز باید از قبل مشخص باشد')}
            </h2>

            <p
              className={cn(
                'mx-auto mt-4 max-w-xl text-pretty text-[hsl(var(--fg-secondary))]',
                LANDING_TYPE.lead,
              )}
            >
              {t(
                'landing.ctaSubtitle',
                'با حسابچه، پایان روز یعنی مرور نتایج — نه ساعت‌ها جمع‌زدن و پیدا کردن اشتباه‌ها',
              )}
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                prefetch={false}
                href={`/${locale}/signup`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--color-primary))] px-7 text-base font-bold text-[hsl(var(--color-primary-fg))] transition-colors hover:bg-[hsl(var(--color-primary-hover))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--color-primary))] sm:w-auto"
              >
                {t('landing.ctaButton', 'شروع رایگان')}
                <ForwardArrow />
              </Link>
            </div>

            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[hsl(var(--fg-tertiary))] sm:text-sm">
              <span>{t('landing.ctaReassurance1', '۳۰ ثانیه')}</span>
              <span
                className="size-1 rounded-full bg-[hsl(var(--border-strong))]"
                aria-hidden="true"
              />
              <span>{t('landing.ctaReassurance2', 'بدون کارت بانکی')}</span>
              <span
                className="size-1 rounded-full bg-[hsl(var(--border-strong))]"
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
