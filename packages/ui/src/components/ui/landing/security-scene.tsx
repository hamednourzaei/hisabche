// packages/ui/src/components/ui/landing/security-scene.tsx
'use client'

import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'
import type { LucideIcon } from 'lucide-react'
import {
  WifiOff,
  RefreshCw,
  DatabaseBackup,
  ShieldCheck,
  UsersRound,
  History,
  CheckCircle2,
} from 'lucide-react'

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

const PILLARS: TrustPillar[] = [
  {
    icon: WifiOff,
    key: 'offline',
    title: 'آفلاین واقعی',
    bullets: ['بدون اینترنت کار می‌کند', 'ذخیره محلی امن', 'ادامه کار بدون قطعی'],
  },
  {
    icon: RefreshCw,
    key: 'sync',
    title: 'همگام‌سازی خودکار',
    bullets: ['همگام‌سازی پس از اتصال', 'بدون نیاز به اقدام شما', 'همیشه به‌روز'],
  },
  {
    icon: DatabaseBackup,
    key: 'backup',
    title: 'بک‌آپ خودکار',
    bullets: ['نسخه پشتیبان خودکار', 'بازیابی آسان اطلاعات', 'جلوگیری از حذف داده'],
  },
  {
    icon: ShieldCheck,
    key: 'encryption',
    title: 'امنیت و رمزنگاری',
    bullets: ['رمزنگاری داده‌ها', 'ارتباط امن', 'محافظت از اطلاعات'],
  },
  {
    icon: UsersRound,
    key: 'access',
    title: 'کنترل دسترسی',
    bullets: ['چند کاربره', 'نقش‌ها و مجوزها', 'سطح دسترسی مشخص'],
  },
  {
    icon: History,
    key: 'audit',
    title: 'ثبت رویدادها',
    bullets: ['ثبت فعالیت‌ها', 'تاریخچه تغییرات', 'قابلیت پیگیری'],
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

        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, key, title, bullets }) => (
            <li key={key} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="mb-2 text-base font-semibold text-[hsl(var(--fg-primary))]">
                  {t(`landing.security.${key}.title`, title)}
                </h3>
                <ul className="space-y-1.5">
                  {bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-[hsl(var(--fg-secondary))]"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-[hsl(var(--color-success))]"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">
                        {t(`landing.security.${key}.bullet${j + 1}`, bullet)}
                      </span>
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
