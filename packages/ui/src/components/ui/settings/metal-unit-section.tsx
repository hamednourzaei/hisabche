// ============================================
// «واحد نمایش فلز» — gram, kilogram or tonne, for a business whose books are in a metal.
//
// The books keep grams whatever is chosen here; figures are shown and typed in
// the unit chosen, converted both ways (formatting/metal-unit.ts). Shown only
// when the books currency IS a metal — for an afghani business it has no
// meaning, and an unexplained setting is noise.
// ============================================
'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { Scale } from 'lucide-react'
import { usePreferencesStore } from '@hisabche/store'
import { isMetal, METAL_UNITS, type MetalUnit } from '@hisabche/formatting'

import { SegmentedControl } from '../segmented-control'
import { useBookCurrency } from '../../../hooks/use-book-currency'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

/** The control alone — the settings section and the offline first run both use it. */
export function MetalUnitPicker() {
  const t = useTranslations()
  const unit = usePreferencesStore((state) => state.metalUnit)
  const setUnit = usePreferencesStore((state) => state.setMetalUnit)
  return (
    <SegmentedControl<MetalUnit>
      label={t('settings.metalUnit.title')}
      options={METAL_UNITS.map((value) => ({
        value,
        label: t(`metalUnit.${value}`),
      }))}
      value={unit}
      onChange={setUnit}
    />
  )
}

export const MetalUnitSection = memo(function MetalUnitSection() {
  const t = useTranslations()
  const bookCurrency = useBookCurrency()
  if (!isMetal(bookCurrency)) return null

  return (
    <section className={`${card} p-5`} aria-labelledby="metal-unit-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]">
          <Scale className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2
              id="metal-unit-title"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('settings.metalUnit.title')}
            </h2>
            <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
              {t('settings.metalUnit.description')}
            </p>
          </div>
          <MetalUnitPicker />
        </div>
      </div>
    </section>
  )
})
