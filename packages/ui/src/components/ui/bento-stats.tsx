// packages/ui/src/components/ui/bento-stats.tsx
// 🍱 Bento Grid — the dashboard's KPI row.
//
// ⚠️ THIS IS A LAYOUT, NOT A SECOND KPI CARD.
//
// Every cell is a `KpiCard` (the owner's instruction: one KPI card in the whole
// product). What lives here is only the asymmetric arrangement — on mobile the
// four cells merge into ONE bordered box with internal dividers, and become
// four separate cards from `sm` up. That is why the cells are rendered with
// `surface="desktop"`: a cell drawing its own border on mobile would put a
// border inside a border.
'use client'

import { KpiCard, fullAmount, type KpiCardProps } from './kpi-card'
import { STAT_PADDING } from './stat-surface'
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
}

interface BentoStatsProps {
  t: Translate
  stats: BentoStat[]
  className?: string
}

// چیدمان نامتقارن: بالا ۷/۵ — پایین ۵/۷
const SPANS = ['col-span-7', 'col-span-5', 'col-span-5', 'col-span-7'] as const
const INNER_BORDERS = ['border-b border-e', 'border-b', 'border-e', ''] as const

// ============================================================
// 🎨 Component
// ============================================================

export function BentoStats({ t: _t, stats, className }: BentoStatsProps) {
  return (
    <div
      className={cn(
        // موبایل: یک باکس یکپارچه‌ی نامتقارن
        'grid grid-cols-12 overflow-hidden rounded-2xl',
        'border border-[hsl(var(--border-default))]',
        'bg-[hsl(var(--surface-elevated))]',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)]',
        // دسکتاپ: کارت‌های مجزا
        'sm:grid-cols-4 sm:gap-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:overflow-visible',
        className,
      )}
    >
      {stats.slice(0, 4).map((stat, i) => {
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
            invertDelta={stat.invertDelta ?? false}
            surface="desktop"
            className={cn(
              STAT_PADDING,
              SPANS[i],
              INNER_BORDERS[i],
              'border-[hsl(var(--border-default))]',
              'sm:col-span-1',
            )}
          />
        )
      })}
    </div>
  )
}
