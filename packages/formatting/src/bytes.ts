// ============================================
// A size in bytes, in the reader's language.
//
// The unit comes from ICU (`style: 'unit'`), so Persian and Dari read
// «۱٫۵ مگابایت» and English «1.5 MB» without a hand-kept table of unit names.
// Decimal units (1 kB = 1000 B), the same ones `navigator.storage.estimate()`
// and operating systems report.
// ============================================

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const

export function formatBytes(bytes: number, locale: string): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  let index = 0
  let scaled = value
  while (scaled >= 1000 && index < UNITS.length - 1) {
    scaled /= 1000
    index += 1
  }
  const unit = UNITS[index]!
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: index === 0 ? 0 : 1,
    }).format(scaled)
  } catch {
    return `${scaled.toFixed(index === 0 ? 0 : 1)} ${['B', 'kB', 'MB', 'GB', 'TB'][index]}`
  }
}
