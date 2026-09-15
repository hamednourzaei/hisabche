// packages/ui/src/components/ui/landing/security-scene.tsx

import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
import type { LucideIcon } from 'lucide-react'
import { Lock, ShieldCheck, UsersRound, History, CheckCircle2 } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   SecurityScene v3 — Trust Center · 6 pillars · Bullet scanning
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SecuritySceneProps {
  t: (key: string, fallback?: string) => string
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

export default function SecurityScene({ t }: SecuritySceneProps) {
  return (
    <section
      id="security"
      data-narrative="trust"
      className={cn(LANDING_SECTION, 'bg-[hsl(var(--surface-muted)/0.3)]')}
    >
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.securityLabel', 'امنیت داده')}
          title={t('landing.securityTitle', 'اطلاعات کسب‌وکارت همیشه امن است')}
          description={t(
            'landing.securityDesc',
            'چه اینترنت داشته باشی چه نداشته باشی، اطلاعاتت ذخیره می‌شود، همگام‌سازی می‌شود، نسخه پشتیبان دارد و فقط افراد مجاز به آن دسترسی خواهند داشت.',
          )}
        />

        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {PILLARS.map(({ icon: Icon, key, title, bullets }) => (
            <li
              key={key}
              className="flex gap-3 p-4 sm:gap-4 sm:p-5 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] transition-colors hover:border-[hsl(var(--color-primary)/0.35)]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] sm:size-11">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="mb-1 text-base font-semibold text-[hsl(var(--fg-primary))] sm:mb-2">
                  {t(`landing.security.${key}.title`, title)}
                </h3>
                {/* ONE list for every size. Phones show it as a single line
                    joined by « · » (CSS), wider screens as ticked rows — the
                    phone version used to be a second copy of the same text. */}
                <ul className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))] sm:space-y-1.5">
                  {bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="inline after:content-['_·_'] last:after:content-none sm:flex sm:items-start sm:gap-2 sm:after:content-none"
                    >
                      <CheckCircle2
                        className="mt-0.5 hidden size-4 shrink-0 text-[hsl(var(--color-success))] sm:block"
                        aria-hidden="true"
                      />
                      {t(`landing.security.${key}.bullet${j + 1}`, bullet)}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
