// «n minutes ago» from a timestamp — ONE implementation for every feed.
//
// ⚠️ Two private copies called `t('time.hoursAgo')` WITHOUT the number, so the
// screen read «{h} ساعت پیش» — the raw placeholder (reported on /activities).
// The message keys carry `{m}` `{h}` `{d}` `{w}` `{mo}` `{y}`; each is passed.

type Translate = (key: string, values?: Record<string, number>) => string

/** `now` is null until mounted (useNow): no clock is read during render. */
export function timeAgo(iso: string, now: number | null, t: Translate): string {
  if (now === null) return ''
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return t('time.justNow')
  if (minutes < 60)
    return minutes === 1 ? t('time.minuteAgo') : t('time.minutesAgo', { m: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? t('time.hourAgo') : t('time.hoursAgo', { h: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? t('time.dayAgo') : t('time.daysAgo', { d: days })
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return weeks === 1 ? t('time.weekAgo') : t('time.weeksAgo', { w: weeks })
  const months = Math.floor(days / 30)
  if (months < 12)
    return months === 1 ? t('time.monthAgo') : t('time.monthsAgo', { mo: Math.max(months, 1) })
  const years = Math.floor(days / 365)
  return years === 1 ? t('time.yearAgo') : t('time.yearsAgo', { y: Math.max(years, 1) })
}
