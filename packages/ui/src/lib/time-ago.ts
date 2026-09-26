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
  if (minutes < 60) return t('time.minutesAgo', { m: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { h: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('time.daysAgo', { d: days })
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return t('time.weeksAgo', { w: weeks })
  const months = Math.floor(days / 30)
  if (months < 12) return t('time.monthsAgo', { mo: Math.max(months, 1) })
  return t('time.yearsAgo', { y: Math.floor(days / 365) })
}
