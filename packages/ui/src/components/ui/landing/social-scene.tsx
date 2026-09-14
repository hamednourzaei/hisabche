// packages/ui/src/components/ui/landing/social-scene.tsx
'use client'

import { useSceneObserver } from './use-scene-observer'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
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
    <figure className="flex h-full flex-col rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-5 sm:p-6">
      {/* A tick, not five stars. A star is a RATING, and there is no rating
          source in this product — inventing one is the defect this file was
          rewritten to remove. */}
      <span className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]">
        <Check className="size-4" aria-hidden="true" />
      </span>
      <blockquote className="mb-4 text-sm leading-relaxed text-[hsl(var(--fg-primary))] sm:text-base">
        {item.claim}
      </blockquote>
      <figcaption className="mt-auto border-t border-[hsl(var(--border-default)/0.7)] pt-3 text-xs text-[hsl(var(--fg-tertiary))]">
        {item.where}
      </figcaption>
    </figure>
  )
}

export default function SocialScene({ t }: SocialSceneProps) {
  // Kept for the section navigator (it reads which scene is in view).
  const { ref } = useSceneObserver<HTMLDivElement>({ threshold: 0.3, narrativeState: 'trust' })

  const items = CAPABILITIES.map((item) => ({
    ...item,
    claim: t(`landing.capability.${item.key}.claim`, item.claim),
    where: t(`landing.capability.${item.key}.where`, item.where),
  }))

  return (
    <section id="testimonials" ref={ref} data-narrative="trust" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        {/* ⚠️ No rating badge: «۴.۹ · ۳۴۰+ کسب‌وکار فعال» had no rating source
            and no counter. The label says what is true instead. */}
        <SectionHeader
          label={t('landing.builtFor', 'ساخته‌شده برای کسب‌وکارهای افغانستان')}
          title={t('landing.capabilitiesTitle', 'چه کاری برایتان انجام می‌دهد')}
          description={t('landing.capabilitiesDesc', 'هر مورد را می‌توانید همین حالا امتحان کنید')}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.key}>
              <CapabilityCard item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
