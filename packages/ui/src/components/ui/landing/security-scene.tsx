// packages/ui/src/components/ui/landing/security-scene.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'
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
  const ref = useRef<HTMLDivElement>(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="security"
      ref={ref}
      data-narrative="trust"
      className="py-12 sm:py-16 lg:py-20 bg-[hsl(var(--surface-muted)/0.2)]"
    >
      <div className="container-narrow max-w-6xl px-4 sm:px-6">
        <div
          className={cn(
            'text-center mb-10 sm:mb-12 lg:mb-16',
            'transition-all duration-700 motion-reduce:transition-none',
            animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
          )}
        >
          <p className="text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t('landing.securityLabel', 'امنیت داده')}
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight mb-2 sm:mb-3 lg:mb-4 px-4 sm:px-0">
            {t('landing.securityTitle', 'اطلاعات کسب‌وکارت همیشه امن است')}
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed px-4 sm:px-0">
            {t(
              'landing.securityDesc',
              'چه اینترنت داشته باشی چه نداشته باشی، اطلاعاتت ذخیره می‌شود، همگام‌سازی می‌شود، نسخه پشتیبان دارد و فقط افراد مجاز به آن دسترسی خواهند داشت.',
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {PILLARS.map(({ icon: Icon, key, title, bullets }, i) => (
            <div
              key={key}
              className={cn(
                'group relative p-3.5 sm:p-4 lg:p-6 rounded-[var(--radius-xl)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
                'transition-all duration-500 motion-reduce:transition-none',
                'hover:border-[hsl(var(--color-primary)/0.3)] hover:shadow-lg hover:-translate-y-1',
                'motion-reduce:hover:translate-y-0',
                animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
              )}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] mb-2.5 sm:mb-3 lg:mb-4 group-hover:scale-105 transition-transform">
                <Icon className="size-4 sm:size-4.5 lg:size-5" aria-hidden="true" />
              </div>

              <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-[hsl(var(--fg-primary))] mb-2 sm:mb-2.5 lg:mb-3 leading-snug">
                {t(`landing.security.${key}.title`, title)}
              </h3>

              <ul className="space-y-1.5 sm:space-y-2">
                {bullets.map((bullet, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-sm text-[hsl(var(--fg-secondary))]"
                  >
                    <CheckCircle2
                      className="size-3 sm:size-3.5 mt-0.5 shrink-0 text-[hsl(var(--color-success))]"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">
                      {t(`landing.security.${key}.bullet${j + 1}`, bullet)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
