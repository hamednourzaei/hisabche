export type DataLocale = 'fa' | 'af' | 'en'

export type TranslationMap = Partial<Record<DataLocale, string>>

export function resolveLocalizedName(
  originalName: string,
  translations: TranslationMap | null | undefined,
  locale: DataLocale,
): string {
  const localized = translations?.[locale]?.trim()
  if (localized) return localized
  return originalName
}

export function matchesLocalizedSearch(
  originalName: string,
  translations: TranslationMap | null | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (originalName.toLowerCase().includes(q)) return true
  if (!translations) return false
  return Object.values(translations).some(
    (v) => typeof v === 'string' && v.toLowerCase().includes(q),
  )
}

export const SENSITIVE_FIELD_CAPABILITIES: Record<string, string> = {
  buy_price: 'inventory.cost.read',
  margin: 'report.financial.read',
  margin_percent: 'report.financial.read',
  salary: 'payroll.read',
  supplier_price: 'inventory.cost.read',
}

export function redactSensitiveFields<T extends Record<string, unknown>>(
  rows: readonly T[],
  grantedCapabilities: ReadonlySet<string>,
): { rows: Array<Record<string, unknown>>; hidden: string[] } {
  const hiddenSet = new Set<string>()
  for (const [field, cap] of Object.entries(SENSITIVE_FIELD_CAPABILITIES)) {
    if (!grantedCapabilities.has(cap)) {
      hiddenSet.add(field)
    }
  }
  const hidden = Array.from(hiddenSet)
  if (hidden.length === 0) {
    return { rows: rows.map((r) => ({ ...r })), hidden: [] }
  }
  const sanitized = rows.map((row) => {
    const copy: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!hiddenSet.has(k)) copy[k] = v
    }
    return copy
  })
  return { rows: sanitized, hidden }
}

export function filterCsvColumnsForHiddenFields(
  columns: readonly string[],
  hidden: readonly string[],
): string[] {
  const hiddenSet = new Set(hidden)
  return columns.filter((c) => !hiddenSet.has(c))
}
