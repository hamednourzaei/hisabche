// packages/ui/src/components/ui/bento-stats.tsx
//
// A ROW OF KPI CARDS — the same row, on every screen that has one.
//
// ⚠️ THIS IS A LIST, NOT A CARD. Every cell is `KpiCard`. What lives here is
// only the `BentoStat` data shape, kept because four screens already pass it.
//
// ---------------------------------------------------------------------------
// ⚠️ THE ASYMMETRIC «BENTO» LAYOUT IS GONE, ON PURPOSE
//
// It drew a 7/5 · 5/7 grid that merged into ONE bordered box on mobile. That
// was a second visual language: `/dashboard` showed four separate cards in a
// plain row while `/invoices`, `/warehouse` and `/customers` showed a merged
// asymmetric block. Same component underneath after the last change — and the
// owner still read them as different cards, because on screen they were.
//
// One row now: `KpiGrid`, two across on mobile and four from `sm` up,
// identical on every page. The file keeps its name because four screens
// import it.
// ============================================
'use client'

import { KpiCard, KpiGrid, fullAmount, type KpiCardProps } from './kpi-card'
import { cn } from '../../lib/utils'
import { type LucideIcon } from 'lucide-react'

type Translate = (key: string, fallback?: string) => string

export { fullAmount }

/**
 * @deprecated Kept so existing imports keep compiling. Returns the full number;
 * abbreviation was removed deliberately — «۱۲ میلیون» hides the exact figure a
 * bookkeeper is checking.
 */
export function compactAmount(v: number, _t?: Translate, locale = 'fa-IR'): string {
  return fullAmount(v, locale)
}

// ============================================================
// 📦 Types
// ============================================================

export interface BentoStat {
  id: string
  icon: LucideIcon
  label: string
  /** مقدار عددی — قالب‌بندی، رنگِ علامت و اندازه‌ی فونت خودکار اعمال می‌شود */
  amount?: number
  /** مقدار متنی (مثلاً نام مشتری) — جایگزین amount */
  text?: string
  /** پسوند مقدار، مثلاً واحد پول */
  suffix?: string
  /** درصد تغییر؛ null یعنی داده‌ای برای مقایسه نیست */
  delta?: number | null
  /** برچسب بازه‌ی مقایسه، مثلاً «نسبت به ماه قبل» */
  deltaLabel?: string
  /** افزایش برای این شاخص منفی است (مثل بدهی) */
  invertDelta?: boolean
  /** کجا این عدد از آن آمده؛ کارت را به دکمه‌ی واقعی تبدیل می‌کند */
  onOpen?: (() => void) | undefined
  /** چه چیزی باز می‌شود — برای tooltip و صفحه‌خوان */
  openLabel?: string | undefined
}

interface BentoStatsProps {
  t: Translate
  stats: BentoStat[]
  className?: string
}

// ============================================================
// 🎨 Component
// ============================================================

export function BentoStats({ t: _t, stats, className }: BentoStatsProps) {
  // ⚠️ ONE CARD WITH A DELTA MAKES EVERY CARD RESERVE THE LINE, so the four
  // stay the same height and their baselines line up. The dash means «not
  // compared» — never «unchanged», which is why it is a dash and not «۰٪».
  const anyDelta = stats.slice(0, 4).some((stat) => stat.delta !== undefined && stat.delta !== null)

  return (
    <KpiGrid className={cn(className)}>
      {stats.slice(0, 4).map((stat) => {
        // `suffix` (the currency code) is deliberately not rendered: the user
        // picks their currency once during onboarding, so repeating it on every
        // card is noise that only costs horizontal room.
        //
        // A number goes through as a NUMBER, so the card formats it, colours it
        // by sign and sizes it. Text goes through as text and stays neutral.
        const value: KpiCardProps['value'] =
          stat.text ?? (stat.amount !== undefined ? stat.amount : '—')

        return (
          <KpiCard
            key={stat.id}
            label={stat.label}
            value={value}
            icon={stat.icon}
            {...(stat.delta !== undefined ? { delta: stat.delta } : {})}
            {...(stat.deltaLabel ? { deltaLabel: stat.deltaLabel } : {})}
            {...(stat.onOpen ? { onOpen: stat.onOpen } : {})}
            {...(stat.openLabel ? { openLabel: stat.openLabel } : {})}
            invertDelta={stat.invertDelta ?? false}
            showEmptyDelta={anyDelta}
          />
        )
      })}
    </KpiGrid>
  )
}
