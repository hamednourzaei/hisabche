// packages/ui/src/components/ui/notification-bell.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Bell,
  X,
  ChevronDown,
  CheckCheck,
  Inbox,
  ArrowLeft,
  FileText,
  User,
  DollarSign,
  Clock,
  Package,
  Users,
  Receipt,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { routeForEntityOrList } from '../../lib/entity-route'
import { useCurrency } from '../../hooks/use-currency'
import { useIntlLocale } from '../../hooks/use-intl-locale'
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@hisabche/api'
import type { Notification } from '@hisabche/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationGroup {
  key: string
  entityId: string
  entityType: 'invoice' | 'customer' | 'product' | 'payment' | 'supplier' | 'inventory'
  entityLabel: string
  entityUrl: string
  items: Notification[]
  hasUnread: boolean
  unreadCount: number
  latestAt: string
  invoiceNumber?: string | undefined
  customerName?: string | undefined
  total?: number | undefined
  currency?: string | undefined
  status?: string | undefined
  summary?: {
    title: string
    icon: any
    color: string
  }
}

interface NotificationBellProps {
  className?: string
}

// ─── Per-entity type config ──────────────────────────────────────────────────

const entityConfig: Record<
  NotificationGroup['entityType'],
  { icon: any; color: string; bg: string }
> = {
  invoice: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  customer: { icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  product: { icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  payment: { icon: Receipt, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  supplier: { icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  inventory: { icon: Package, color: 'text-rose-500', bg: 'bg-rose-500/10' },
}

const statusColors: Record<string, string> = {
  pending: 'text-amber-500 bg-amber-500/10',
  paid: 'text-emerald-500 bg-emerald-500/10',
  completed: 'text-emerald-500 bg-emerald-500/10',
  cancelled: 'text-red-500 bg-red-500/10',
  partial: 'text-blue-500 bg-blue-500/10',
  overdue: 'text-rose-500 bg-rose-500/10',
  draft: 'text-gray-500 bg-gray-500/10',
}

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت شده',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
  partial: 'بخشی پرداخت',
  overdue: 'سررسید شده',
  draft: 'پیش‌نویس',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string, t: (key: string) => string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return t('time.justNow')
  if (m < 60) return t('time.minutesAgo')
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.hoursAgo')
  const d2 = Math.floor(h / 24)
  if (d2 < 7) return t('time.daysAgo')
  const w = Math.floor(d2 / 7)
  if (w < 4) return t('time.weeksAgo')
  return t('time.monthsAgo')
}

// ✅ FIX: قبلاً فقط ۴ نوع entity شناخته می‌شد و بقیه (project، workflow،
// purchase_order، ...) بی‌صدا به "/dashboard" سقوط می‌کردند. همچنین
// "customer" و "payment" به route هایی اشاره داشتند که اصلاً در اپ
// وجود ندارند (صفحه‌ی مشتریان route جزئیات جدا ندارد، "/payments"
// هم هیچ‌وقت ساخته نشده) — یعنی همیشه ۴۰۴ می‌دادند.
function resolveEntityUrl(n: Notification): string {
  if (n.action_url) return n.action_url

  // H6 — the SHARED mapper, not a copy.
  //
  // This switch was that copy, and it went stale: it kept pointing employees
  // at `/human-resources/:id` after G1 moved that route, and nothing caught it
  // because a second mapping has nothing to disagree with until someone taps.
  //
  // `OrList` because a notification must always land somewhere: the person
  // already tapped it, so an unknown type going to the activity feed beats
  // going nowhere.
  return routeForEntityOrList(n.entity_type ?? '', n.entity_id)
}

// The locale was pinned to 'fa-AF' and a missing currency fell back to the
// literal 'AFN'. Digits now follow the reader's language and the fallback is
// the currency the user actually chose — see money-display.ts.
function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

// ─── Group Notifications by Entity ─────────────────────────────────────────

function groupNotifications(list: Notification[]): NotificationGroup[] {
  if (!list || !Array.isArray(list) || list.length === 0) return []

  const map = new Map<string, Notification[]>()
  for (const n of list) {
    const key = n.entity_type && n.entity_id ? `${n.entity_type}:${n.entity_id}` : n.id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }

  return Array.from(map.entries())
    .map(([key, items]) => {
      const sorted = items.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      const latest = sorted[0]
      const metadata = latest?.metadata || {}

      if (!latest) {
        return {
          key,
          entityId: '',
          entityType: 'invoice' as const,
          entityLabel: 'بدون عنوان',
          entityUrl: '/dashboard',
          items: sorted,
          hasUnread: sorted.some((i) => !i.is_read),
          unreadCount: sorted.filter((i) => !i.is_read).length,
          latestAt: '',
        }
      }

      const entityType = (latest.entity_type as NotificationGroup['entityType']) || 'invoice'
      const config = entityConfig[entityType] || entityConfig.invoice

      return {
        key,
        entityId: latest.entity_id || '',
        entityType,
        entityLabel: metadata?.invoice_number
          ? `فاکتور #${metadata.invoice_number}`
          : latest.title || 'بدون عنوان',
        entityUrl: resolveEntityUrl(latest),
        items: sorted,
        hasUnread: sorted.some((i) => !i.is_read),
        unreadCount: sorted.filter((i) => !i.is_read).length,
        latestAt: latest.created_at || '',
        invoiceNumber: metadata?.invoice_number,
        customerName: metadata?.customer_name,
        total: metadata?.total,
        currency: metadata?.currency,
        status: metadata?.status,
        summary: {
          title: latest.title || 'فعالیت جدید',
          icon: config.icon,
          color: config.color,
        },
      }
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const EntityIcon = memo(function EntityIcon({
  type,
  size = 'md',
}: {
  type: NotificationGroup['entityType']
  size?: 'sm' | 'md'
}) {
  const config = entityConfig[type] || entityConfig.invoice
  const Icon = config.icon
  const dim = size === 'md' ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6 md:w-8 md:h-8'
  const iconDim = size === 'md' ? 'w-4 h-4 md:w-5 md:h-5' : 'w-3 h-3 md:w-4 md:h-4'

  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full', dim, config.bg)}>
      <Icon className={cn(iconDim, config.color)} aria-hidden="true" />
    </div>
  )
})
EntityIcon.displayName = 'EntityIcon'

// ─── Timeline Item ──────────────────────────────────────────────────────────

const TimelineItem = memo(function TimelineItem({
  notification,
  isLast,
}: {
  notification: Notification
  isLast: boolean
}) {
  const t = useTranslations()
  const config =
    entityConfig[notification.entity_type as NotificationGroup['entityType']] ||
    entityConfig.invoice
  const Icon = config.icon

  return (
    <div className="flex items-start gap-2 md:gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center',
            config.bg,
          )}
        >
          <Icon className={cn('w-3 h-3 md:w-3.5 md:h-3.5', config.color)} aria-hidden="true" />
        </div>
        {!isLast && <div className="w-px h-3 md:h-4 bg-[hsl(var(--border-default))]" />}
      </div>
      <div className="flex-1 pb-2 md:pb-3">
        <p className="text-xs md:text-sm text-[hsl(var(--fg-primary))] line-clamp-2">
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-[10px] md:text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-[9px] md:text-[10px] text-[hsl(var(--fg-tertiary))] mt-1">
          {timeAgo(notification.created_at, t)}
        </p>
      </div>
    </div>
  )
})
TimelineItem.displayName = 'TimelineItem'

// ─── Group Card ─────────────────────────────────────────────────────────────

const GroupCard = memo(function GroupCard({
  group,
  isOpen,
  onToggle,
  onItemClick,
}: {
  group: NotificationGroup
  isOpen: boolean
  onToggle: () => void
  onItemClick: (n: Notification) => void
}) {
  const t = useTranslations()
  const locale = useIntlLocale()
  const { currency: userCurrency } = useCurrency()
  const statusColor = group.status ? statusColors[group.status] || '' : ''
  const statusLabel = group.status ? statusLabels[group.status] || group.status : ''
  const config = entityConfig[group.entityType] || entityConfig.invoice
  const Icon = config.icon

  return (
    <div
      className={cn(
        'rounded-xl border border-[hsl(var(--border-default))] overflow-hidden transition-all duration-200',
        group.hasUnread && 'border-[hsl(var(--color-primary)/0.3)] shadow-sm',
      )}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full text-start p-2 md:p-3 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
      >
        <div className="flex items-start gap-2 md:gap-3">
          <EntityIcon type={group.entityType} size="md" />

          <div className="flex-1 min-w-0">
            {/* Entity Label */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-xs md:text-sm font-semibold text-[hsl(var(--fg-primary))] truncate">
                {group.entityLabel}
              </span>
              {group.hasUnread && (
                <span className="shrink-0 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[hsl(var(--color-destructive))]" />
              )}
            </div>

            {/* Customer & Amount */}
            <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 flex-wrap">
              {group.customerName && (
                <span className="text-[10px] md:text-xs text-[hsl(var(--fg-secondary))] flex items-center gap-1">
                  <User className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
                  <span className="truncate max-w-[100px] md:max-w-none">{group.customerName}</span>
                </span>
              )}
              {group.total !== undefined && (
                <span className="text-[10px] md:text-xs font-semibold text-[hsl(var(--fg-primary))] flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
                  {formatCurrency(group.total, group.currency || userCurrency, locale)}
                </span>
              )}
            </div>

            {/* Status & Count */}
            <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 flex-wrap">
              {group.status && (
                <span
                  className={cn(
                    'text-[8px] md:text-[10px] font-medium px-1 md:px-1.5 py-0.5 rounded',
                    statusColor,
                  )}
                >
                  {statusLabel}
                </span>
              )}
              <span className="text-[8px] md:text-[10px] text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
                {group.items.length} {t('notifications.activities')} • {timeAgo(group.latestAt, t)}
              </span>
            </div>
          </div>

          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-200 mt-1',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </button>

      {/* ─── Timeline ───────────────────────────────────────── */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-2 md:px-3 pb-2 md:pb-3 pt-1 border-t border-[hsl(var(--border-default)/0.5)]">
            <div className="space-y-1 md:space-y-2">
              {group.items.map((n, index) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className="w-full text-start focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] rounded"
                >
                  <TimelineItem notification={n} isLast={index === group.items.length - 1} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
GroupCard.displayName = 'GroupCard'

// ─── Skeleton ───────────────────────────────────────────────────────────────

const BellSkeleton = memo(function BellSkeleton() {
  return (
    <div
      className="space-y-1.5 md:space-y-2 p-1.5 md:p-2"
      role="status"
      aria-label="در حال بارگذاری اعلان‌ها"
    >
      {[0, 1].map((i) => (
        <div key={i} className="p-2 md:p-3 border border-[hsl(var(--border-default))] rounded-xl">
          <div className="flex items-start gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[hsl(var(--surface-muted))] animate-pulse" />
            <div className="flex-1 space-y-1.5 md:space-y-2">
              <div className="h-3 md:h-4 bg-[hsl(var(--surface-muted))] rounded w-3/4 animate-pulse" />
              <div className="h-2.5 md:h-3 bg-[hsl(var(--surface-muted))] rounded w-1/2 animate-pulse" />
              <div className="h-2.5 md:h-3 bg-[hsl(var(--surface-muted))] rounded w-1/3 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})
BellSkeleton.displayName = 'BellSkeleton'

// ─── Empty State ────────────────────────────────────────────────────────────

const BellEmptyState = memo(function BellEmptyState() {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-12 px-3 md:px-4 text-center">
      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center mb-3 md:mb-4">
        <Inbox
          className="w-6 h-6 md:w-8 md:h-8 text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
      </div>
      <h4 className="text-xs md:text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('notifications.empty')}
      </h4>
      <p className="text-xs md:text-sm text-[hsl(var(--fg-tertiary))] mt-0.5 md:mt-1">
        {t('notifications.emptyHint')}
      </p>
    </div>
  )
})
BellEmptyState.displayName = 'BellEmptyState'

// ─── Main Component ─────────────────────────────────────────────────────────

export const NotificationBell = memo(function NotificationBell({
  className,
}: NotificationBellProps) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // ─── Detect mobile ─────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadCount()
  const { mutate: markAsRead } = useMarkAsRead()
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead()

  const groups = useMemo(() => groupNotifications(notifications), [notifications])

  const [tog, setTog] = useState<Record<string, boolean>>({})

  const isOpenGroup = useCallback((g: NotificationGroup) => tog[g.key] ?? g.hasUnread, [tog])

  const toggleGroup = useCallback(
    (g: NotificationGroup) => setTog((p) => ({ ...p, [g.key]: !isOpenGroup(g) })),
    [isOpenGroup],
  )

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) close()
    }
    const timeout = setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('mousedown', h)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, close])

  const click = useCallback(
    (n: Notification) => {
      if (!n.is_read) {
        markAsRead([n.id])
      }
      setOpen(false)
      router.push(resolveEntityUrl(n))
    },
    [markAsRead, router],
  )

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead()
  }, [markAllAsRead])

  const handleViewAll = useCallback(() => {
    setOpen(false)
    router.push('/activities')
  }, [router])

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative p-2 rounded-xl text-[hsl(var(--fg-secondary))]',
          'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
          'transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] focus-visible:outline-none',
        )}
        aria-label={t('notifications.bell')}
        aria-expanded={open}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)]">
            {unreadCount > 99 ? '۹۹+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop - فقط برای موبایل */}
          {isMobile && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
              aria-hidden="true"
              onClick={close}
            />
          )}

          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('notifications.title')}
            className={cn(
              'z-50 flex flex-col',
              'border border-[hsl(var(--border-default))]',
              'bg-[hsl(var(--surface-elevated))] shadow-2xl shadow-black/20',

              // Mobile: fixed position, full width with margin
              isMobile
                ? 'fixed left-4 right-4 top-16 max-h-[calc(100dvh-80px)] rounded-2xl'
                : 'absolute end-0 top-full mt-2 w-[400px] max-h-[480px] rounded-2xl',

              'animate-in fade-in-0 slide-in-from-top-2 duration-200',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 border-b border-[hsl(var(--border-default))] shrink-0">
              <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                <h3 className="text-xs md:text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {t('notifications.title')}
                </h3>
                {unreadCount > 0 && (
                  <span className="shrink-0 text-[8px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={isMarkingAll}
                    className={cn(
                      'flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-1 rounded-lg',
                      'text-[9px] md:text-[11px] font-medium',
                      'text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)]',
                      'transition-colors disabled:opacity-40',
                      'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]',
                      'min-h-[28px] md:min-h-[32px]',
                    )}
                    aria-label={t('notifications.markAllRead')}
                  >
                    <CheckCheck className="size-3 md:size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('notifications.markAllRead')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  aria-label={t('action.close')}
                >
                  <X className="size-3.5 md:size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-2 md:p-3">
              {isLoading ? (
                <BellSkeleton />
              ) : groups.length === 0 ? (
                <BellEmptyState />
              ) : (
                <div className="space-y-1.5 md:space-y-2">
                  {groups.map((g) => (
                    <GroupCard
                      key={g.key}
                      group={g}
                      isOpen={isOpenGroup(g)}
                      onToggle={() => toggleGroup(g)}
                      onItemClick={click}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {groups.length > 0 && (
              <button
                type="button"
                onClick={handleViewAll}
                className={cn(
                  'flex items-center justify-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-medium',
                  'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--color-primary))]',
                  'border-t border-[hsl(var(--border-default))]',
                  'hover:bg-[hsl(var(--surface-muted))] transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]',
                  'min-h-[36px] md:min-h-[44px] shrink-0',
                )}
                aria-label={t('notifications.viewAll')}
              >
                {t('notifications.viewAll')}
                <ArrowLeft className="size-3 md:size-3.5 rtl:rotate-180" aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
})

NotificationBell.displayName = 'NotificationBell'
