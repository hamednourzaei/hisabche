// packages/ui/src/components/ui/landing/security-scene.tsx

import { cn } from '../../../lib/utils'
import { CardAccent, LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
import type { LucideIcon } from 'lucide-react'
import { Lock, ShieldCheck, UsersRound, History } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   SecurityScene v4 — Trust Center · 4 pillars, each a ruled column of the
   same ledger the rest of the page is drawn on. Text is start-aligned: the
   centred card layout made a three-line bullet list look like a poem.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SecuritySceneProps {
  t: (key: string, fallback?: string) => string
  /** Chapter number of this section on the page (`05`). */
  index?: string | undefined
}

interface TrustPillar {
  icon: LucideIcon
  key: string
  title: string
  bullets: string[]
}

// ⚠️ TRUST CLAIMS ARE THE MOST EXPENSIVE ONES TO GET WRONG. Each pillar is
// backed by code: workspace isolation proven with RLS on the live database
// (.claude/STATE.md), server-side authorization capabilities, the
// segregation-of-duties domain + override log, /api/audit, the desktop SQLite
// store and the conflict review queue. Two-step login, "30-day restore" and
// "only you hold the key" used to be claimed here and nothing implements them.
// Never add a security claim without the code that makes it true.
const PILLARS: TrustPillar[] = [
  {
    icon: Lock,
    key: 'isolation',
    title: 'جداسازی داده‌ی هر کسب‌وکار',
    bullets: ['فضای کاری جدا', 'مرز امنیتی در خود دیتابیس', 'بدون دید بین حساب‌ها'],
  },
  {
    icon: UsersRound,
    key: 'access',
    title: 'نقش‌ها و مجوزها',
    bullets: ['نقش برای هر عضو تیم', 'مجوز روی سرور بررسی می‌شود', 'دکمه‌ی بی‌مجوز کاری نمی‌کند'],
  },
  {
    icon: ShieldCheck,
    key: 'sod',
    title: 'تفکیک وظایف',
    bullets: ['ثبت‌کننده و تأییدکننده جدا', 'گردش تأیید اسناد', 'هر استثنا ثبت می‌شود'],
  },
  {
    icon: History,
    key: 'audit',
    title: 'ردپای تغییرات',
    bullets: ['چه کسی، چه چیزی، چه وقت', 'تاریخچه‌ی هر سند', 'قابل مرور برای مدیر'],
  },
]

export default function SecurityScene({ t, index }: SecuritySceneProps) {
  return (
    <section
      id="security"
      data-narrative="trust"
      className={cn(LANDING_SECTION, 'bg-[hsl(var(--surface-muted)/0.25)]')}
    >
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          index={index}
          label={t('landing.securityLabel', 'امنیت داده')}
          title={t('landing.securityTitle', 'اطلاعات کسب‌وکارت همیشه امن است')}
          description={t(
            'landing.securityDesc',
            'چه اینترنت داشته باشی چه نداشته باشی، اطلاعاتت ذخیره می‌شود، همگام‌سازی می‌شود، نسخه پشتیبان دارد و فقط افراد مجاز به آن دسترسی خواهند داشت.',
          )}
        />

        <ul className="grid gap-px overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--border-default))] sm:grid-cols-2">
          {PILLARS.map(({ icon: Icon, key, title, bullets }, i) => (
            <li
              key={key}
              className="group relative bg-[hsl(var(--surface-base))] p-5 transition-colors duration-300 hover:bg-[hsl(var(--surface-elevated))] sm:p-7"
            >
              <CardAccent />

              <div className="flex items-center justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-4 text-base font-bold text-[hsl(var(--fg-primary))] sm:text-lg">
                {t(`landing.security.${key}.title`, title)}
              </h3>

              <ul className="mt-3 border-t border-[hsl(var(--border-default))] text-sm leading-6 text-[hsl(var(--fg-secondary))]">
                {bullets.map((bullet, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-2 border-b border-[hsl(var(--border-default)/0.6)] py-2 last:border-0 sm:before:font-bold sm:before:text-[hsl(var(--color-success))] sm:before:content-['✓']"
                  >
                    {t(`landing.security.${key}.bullet${j + 1}`, bullet)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
