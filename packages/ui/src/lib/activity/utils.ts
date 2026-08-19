// packages/ui/src/lib/activity/utils.ts
import { entityRegistry } from './entity-registry'
import type { ActivityGroupDto } from '@hisabche/api'

// The locale was pinned to "fa-AF" and a missing currency silently became
// "AFN". Both now come from the caller: the reader's locale, and the currency
// the row actually carries (or the user's, via `useCurrency`).
export function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'همین الان'
  if (minutes < 60) return `${minutes} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ساعت پیش`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} روز پیش`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} هفته پیش`
  return `${Math.floor(days / 30)} ماه پیش`
}

export function getEntityConfig(type: ActivityGroupDto['entityType']) {
  return entityRegistry[type as keyof typeof entityRegistry] || entityRegistry.invoice
}

export function sortActivities(groups: ActivityGroupDto[]): ActivityGroupDto[] {
  return [...groups].sort((a, b) => {
    // ✅ اصلاح: حذف "critical" چون در تایپ‌ها وجود ندارد
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    }
    const aPriority = priorityOrder[a.priority] ?? 2
    const bPriority = priorityOrder[b.priority] ?? 2
    if (aPriority !== bPriority) return aPriority - bPriority

    if (a.unreadCount > 0 && b.unreadCount === 0) return -1
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1

    return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  })
}
