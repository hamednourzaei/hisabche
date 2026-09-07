// packages/ui/src/components/ui/landing/social-scene.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { Marquee } from '../marquee'
import { cn } from '../../../lib/utils'
import { Check } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   SocialScene v10 — what the product does, stated by the product.

   ─────────────────────────────────────────────────────────────────────────
   ⚠️ WHAT WAS HERE BEFORE, AND WHY IT WAS REMOVED

   Eight testimonials attributed to named people with roles and cities —
   «احمد رضایی، صاحب سوپرمارکت، کابل» — each with a five-star rating, plus a
   header claiming «۴.۹ · ۳۴۰+ کسب‌وکار فعال».

   None of it came from anywhere. There is no reviews table, no rating source,
   no count of active businesses in the codebase. They were written as
   placeholder copy and shipped to a live commercial site, where they read as
   real customers vouching for a real product.

   That is fabricated social proof. It is not a UI defect and it does not get
   fixed by restyling: a visitor deciding whether to trust their books to this
   software is being shown evidence that does not exist.

   ─────────────────────────────────────────────────────────────────────────
   WHAT REPLACED IT

   The same marquee, the same layout, the same weight on the page — carrying
   CAPABILITY STATEMENTS instead of attributed quotes. Every line below is
   something the product actually does and can be checked against the app:

     offline → the sync queue and conflict resolution are real (see /conflicts)
     ledger  → double-entry with balance enforced inside the posting function
     stock   → stock_movements is the source of truth (Phase C)

   No name, no face, no star, no number. Nothing to disprove.

   ─────────────────────────────────────────────────────────────────────────
   WHEN REAL TESTIMONIALS EXIST

   Put them back in this shape — but only with the customer's written consent,
   their real words, and a way to verify. A `Review` interface is intentionally
   NOT left behind here: an empty shape invites being filled with placeholder
   text again, which is exactly how the previous version happened.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SocialSceneProps {
  t: (key: string, fallback?: string) => string
}

interface Capability {
  key: string
  /** What it does, in the user's words — not a claim about anybody. */
  claim: string
  /** Where in the product it is true. Keeps the statement checkable. */
  where: string
}

/**
 * ⚠️ EVERY LINE HERE MUST BE TRUE OF THE SHIPPED PRODUCT.
 *
 * Adding one that is not turns this back into the thing it replaced. If a
 * capability is planned but not built, it does not belong on the landing page.
 */
const CAPABILITIES: Capability[] = [
  {
    key: 'c1',
    claim: 'بدون اینترنت هم کار می‌کند و بعد خودش همگام می‌شود',
    where: 'صف آفلاین و حل تعارض',
  },
  {
    key: 'c2',
    claim: 'هر فروش، خرید و پرداخت سند حسابداری دوطرفه می‌زند',
    where: 'دفتر کل',
  },
  {
    key: 'c3',
    claim: 'موجودی از روی حرکت‌های واقعی انبار محاسبه می‌شود، نه دستی',
    where: 'انبار',
  },
  {
    key: 'c4',
    claim: 'بدهی هر مشتری از روی پرداخت‌های تخصیص‌یافته حساب می‌شود',
    where: 'مشتریان',
  },
  {
    key: 'c5',
    claim: 'هر عددی که می‌بینید تا سند اصلی‌اش قابل دنبال‌کردن است',
    where: 'گزارش‌ها',
  },
  {
    key: 'c6',
    claim: 'چند شعبه، با گزارش تفکیک‌شده یا تجمیعی',
    where: 'حسابداری',
  },
  {
    key: 'c7',
    claim: 'دسترسی هر کارمند دقیقاً همان چیزی است که تعیین کرده‌اید',
    where: 'ماتریس دسترسی',
  },
  {
    key: 'c8',
    claim: 'پشتیبان کامل داده‌ها، هر وقت خواستید',
    where: 'تنظیمات',
  },
]

function CapabilityCard({ item }: { item: Capability }) {
  return (
    <figure
      className={cn(
        'w-56 sm:w-60 lg:w-72 shrink-0 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5',
        'border border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-elevated)/0.75)] backdrop-blur-sm',
        'shadow-[var(--shadow-premium)]',
        'transition-colors duration-300',
        'hover:border-[hsl(var(--color-primary)/0.3)]',
      )}
    >
      {/* A tick, not five stars. A star is a RATING, and there is no rating
          source in this product — inventing one is the defect this file was
          rewritten to remove. */}
      <div className="mb-2 sm:mb-2.5">
        <span className="inline-flex items-center justify-center size-5 sm:size-6 rounded-full bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]">
          <Check className="size-3 sm:size-3.5" aria-hidden="true" />
        </span>
      </div>

      <blockquote className="text-[11px] sm:text-xs lg:text-sm text-[hsl(var(--fg-primary))] leading-relaxed mb-2.5 sm:mb-3 lg:mb-4">
        {item.claim}
      </blockquote>

      <figcaption className="text-[9px] sm:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))] truncate">
        {item.where}
      </figcaption>
    </figure>
  )
}

export default function SocialScene({ t }: SocialSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: 'trust',
  })
  const animated = state === 'animated'

  const items = CAPABILITIES.map((item) => ({
    ...item,
    claim: t(`landing.capability.${item.key}.claim`, item.claim),
    where: t(`landing.capability.${item.key}.where`, item.where),
  }))

  const rowA = items.slice(0, 4)
  const rowB = items.slice(4, 8)

  return (
    <section
      id="testimonials"
      ref={ref}
      data-narrative="trust"
      className="py-12 sm:py-16 lg:py-20 border-y border-[hsl(var(--border-default))] overflow-hidden"
    >
      <div className="container-narrow px-4 sm:px-6">
        {/* ── Header ── */}
        <div
          className={cn(
            'text-center mb-8 sm:mb-10 lg:mb-14 min-h-[100px] sm:min-h-[120px] lg:min-h-[140px]',
            'transition-all duration-700 motion-reduce:transition-none',
            animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
          )}
        >
          {/*
            ⚠️ THE RATING BADGE IS GONE.

            It read «۴.۹ · ۳۴۰+ کسب‌وکار فعال» — a rating with no rating source
            and a user count with no counter. Both were invented.

            What replaced it says something true and unfalsifiable: this is
            what the software does, not how many people like it.
          */}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs lg:text-sm mb-3 sm:mb-4 lg:mb-6',
              'rounded-full',
              'border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-muted))]',
              'text-[hsl(var(--fg-secondary))]',
            )}
          >
            {t('landing.builtFor', 'ساخته‌شده برای کسب‌وکارهای افغانستان')}
          </div>

          <h2 className="text-lg sm:text-2xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight px-4 sm:px-0">
            {t('landing.capabilitiesTitle', 'چه کاری برایتان انجام می‌دهد')}
          </h2>
          <p className="mt-2 sm:mt-3 lg:mt-4 text-sm sm:text-base lg:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed px-4 sm:px-0">
            {t('landing.capabilitiesDesc', 'هر مورد را می‌توانید همین حالا امتحان کنید')}
          </p>
        </div>

        {/* ── Two-row horizontal marquee (all breakpoints) ── */}
        <div
          className={cn(
            'relative space-y-2 sm:space-y-3 lg:space-y-4',
            'transition-opacity duration-700 motion-reduce:transition-none',
            animated ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Marquee pauseOnHover repeat={4} className="[--duration:32s]">
            {rowA.map((item) => (
              <CapabilityCard key={item.key} item={item} />
            ))}
          </Marquee>

          <Marquee reverse pauseOnHover repeat={4} className="[--duration:36s]">
            {rowB.map((item) => (
              <CapabilityCard key={item.key} item={item} />
            ))}
          </Marquee>

          {/* Edge fades, so cards enter and leave rather than being clipped. */}
          <div className="pointer-events-none absolute inset-y-0 start-0 w-12 sm:w-20 bg-gradient-to-r from-[hsl(var(--surface-base))] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 end-0 w-12 sm:w-20 bg-gradient-to-l from-[hsl(var(--surface-base))] to-transparent" />
        </div>
      </div>
    </section>
  )
}
