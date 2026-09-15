// packages/ui/src/components/ui/landing/social-scene.tsx

// SERVER COMPONENT — no hooks, no handlers. Rendered to HTML on the server and
// never hydrated: every client component on the landing is JavaScript a slow
// phone has to run before it can respond (PageSpeed mobile TBT was 6.9 s).
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
    <figure className="flex h-full gap-3 px-4 py-4 sm:flex-col sm:gap-0 sm:rounded-xl sm:border sm:border-[hsl(var(--border-default))] sm:bg-[hsl(var(--surface-elevated)/0.6)] sm:p-6">
      {/* A tick, not five stars. A star is a RATING, and there is no rating
          source in this product — inventing one is the defect this file was
          rewritten to remove. */}
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] sm:mb-4 sm:size-8">
        <Check className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <blockquote className="mb-1 text-sm leading-relaxed text-[hsl(var(--fg-primary))] sm:mb-4 sm:text-base">
          {item.claim}
        </blockquote>
        <figcaption className="text-xs text-[hsl(var(--fg-tertiary))] sm:mt-auto sm:border-t sm:border-[hsl(var(--border-default)/0.7)] sm:pt-3">
          {item.where}
        </figcaption>
      </div>
    </figure>
  )
}

export default function SocialScene({ t }: SocialSceneProps) {
  const items = CAPABILITIES.map((item) => ({
    ...item,
    claim: t(`landing.capability.${item.key}.claim`, item.claim),
    where: t(`landing.capability.${item.key}.where`, item.where),
  }))

  return (
    <section id="testimonials" data-narrative="trust" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        {/* ⚠️ No rating badge: «۴.۹ · ۳۴۰+ کسب‌وکار فعال» had no rating source
            and no counter. The label says what is true instead. */}
        <SectionHeader
          label={t('landing.builtFor', 'ساخته‌شده برای کسب‌وکارهای ایران و افغانستان')}
          title={t('landing.capabilitiesTitle', 'چه کاری برایتان انجام می‌دهد')}
          description={t('landing.capabilitiesDesc', 'هر مورد را می‌توانید همین حالا امتحان کنید')}
        />
        {/* Grouped compact rows on phones (eight stacked cards were 1511px);
            cards in a grid from `sm`. */}
        <ul className="divide-y divide-[hsl(var(--border-default)/0.7)] overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:border-0 sm:bg-transparent lg:grid-cols-4">
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
