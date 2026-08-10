// packages/ui/src/components/ui/bento-stats.tsx
// 🍱 Bento Grid + Soft UI — KPI box (mobile: یک باکس نامتقارن ۲×۲ / دسکتاپ: کارت‌های مجزا)
'use client'

import { cn } from '../../lib/utils'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'

// ============================================================
// 🔢 قالب‌بندی عدد — کوتاه‌سازی میلیون/میلیارد + اندازه‌ی خودکار فونت
// ============================================================

type Translate = (key: string, fallback?: string) => string

function localeNumber(v: number, decimals = 0): string {
  try {
    return new Intl.NumberFormat('fa-AF', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v)
  } catch {
    return v.toFixed(decimals)
  }
}

/** عدد بزرگ را به «میلیون/میلیارد» کوتاه می‌کند */
export function compactAmount(v: number, t?: Translate): string {
  const tr = t ?? ((_k: string, f?: string) => f ?? '')
  const abs = Math.abs(v)

  if (abs >= 1e9) {
    return `${localeNumber(v / 1e9, abs >= 1e10 ? 0 : 1)} ${tr('common.billion', 'میلیارد')}`
  }
  if (abs >= 1e6) {
    return `${localeNumber(v / 1e6, abs >= 1e7 ? 0 : 1)} ${tr('common.million', 'میلیون')}`
  }
  return localeNumber(v)
}

/**
 * رنگ عدد بر اساس علامت آن. متن‌های غیرعددی (مثل نام پرخریدترین مشتری)
 * `amount` ندارند و خنثی می‌مانند.
 */
function amountTone(amount: number | undefined): string {
  if (amount === undefined || amount === 0) return 'text-[hsl(var(--fg-primary))]'
  return amount < 0 ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--color-success))]'
}

/** هرچه متن بلندتر، فونت کوچک‌تر — جلوگیری از سرریز در کارت */
function valueFontClass(text: string): string {
  const len = text.length
  if (len <= 7) return 'text-lg sm:text-2xl'
  if (len <= 11) return 'text-base sm:text-xl'
  if (len <= 16) return 'text-sm sm:text-lg'
  if (len <= 24) return 'text-xs sm:text-base'
  return 'text-[11px] sm:text-sm'
}

function formatPercent(delta: number): string {
  const abs = Math.abs(delta)
  return `${localeNumber(abs, abs < 10 ? 1 : 0)}٪`
}

// ============================================================
// 📦 Types
// ============================================================

export interface BentoStat {
  id: string
  icon: LucideIcon
  label: string
  /** مقدار عددی — کوتاه‌سازی و اندازه‌ی فونت خودکار اعمال می‌شود */
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
  /** واحد پول برای مقادیر عددی */
  className?: string
}

// چیدمان نامتقارن: بالا ۷/۵ — پایین ۵/۷
const SPANS = ['col-span-7', 'col-span-5', 'col-span-5', 'col-span-7'] as const
const INNER_BORDERS = ['border-b border-e', 'border-b', 'border-e', ''] as const

// ============================================================
// 🎨 Component
// ============================================================

export function BentoStats({ t, stats, className }: BentoStatsProps) {
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
        const raw = stat.text ?? (stat.amount !== undefined ? compactAmount(stat.amount, t) : '—')
        const value = stat.suffix ? `${raw} ${stat.suffix}` : raw
        const hasDelta = stat.delta !== undefined && stat.delta !== null
        const isUp = hasDelta && (stat.delta as number) >= 0
        const isGood = stat.invertDelta ? !isUp : isUp
        const TrendIcon = isUp ? TrendingUp : TrendingDown

        return (
          <div
            key={stat.id}
            className={cn(
              'min-w-0 p-3 sm:p-4',
              SPANS[i],
              INNER_BORDERS[i],
              'border-[hsl(var(--border-default))]',
              // دسکتاپ: هر خانه یک کارت مستقل
              'sm:col-span-1 sm:rounded-2xl sm:border',
              'sm:bg-[hsl(var(--surface-elevated))]',
              'sm:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.16)]',
              'transition-colors duration-150',
            )}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <stat.icon
                className="size-3.5 shrink-0 text-[hsl(var(--color-primary))] sm:size-4"
                aria-hidden="true"
              />
              <span className="truncate text-[10px] text-[hsl(var(--fg-secondary))] sm:text-xs">
                {stat.label}
              </span>
            </div>

            <p
              className={cn(
                'mt-1.5 truncate font-bold tabular-nums sm:mt-2',
                valueFontClass(value),
                // عدد منفی قرمز، مثبت سبز، صفر خنثی — کاربر باید بدون خواندن
                // علامت هم بفهمد وضعیت خوب است یا بد.
                amountTone(stat.amount),
              )}
              title={value}
            >
              {value}
            </p>

            {hasDelta && (
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    isGood
                      ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                      : 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
                  )}
                >
                  <TrendIcon className="size-3" aria-hidden="true" />
                  {formatPercent(stat.delta as number)}
                </span>
                {stat.deltaLabel && (
                  <span className="truncate text-[10px] text-[hsl(var(--fg-tertiary))]">
                    {stat.deltaLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
