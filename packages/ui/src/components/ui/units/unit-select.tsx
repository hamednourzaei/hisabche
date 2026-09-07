'use client'

// ============================================
// packages/ui/src/components/ui/units/unit-select.tsx
//
// T2 — ONE unit picker, fed by the `units` table.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES, AND WHY IT MATTERED
//
// Three independent hardcoded lists:
//
//   validation unitSchema          9 codes
//   add-product-modal UnitType     5 codes  piece kg liter meter box
//   warehouse-detail validUnits    5 codes  + toUnitType()
//
// `toUnitType` was the dangerous one. It read:
//
//     if (UNIT_OPTIONS.some(o => o.value === unit)) return unit
//     return 'piece'
//
// — so opening a product measured in grams in the warehouse detail view showed
// «عدد», and SAVING that form wrote 'piece' over the real unit. A silent
// coercion that changes stored data, structurally the same defect as the
// currency picker falling back to AFN in T1.
//
// ---------------------------------------------------------------------------
// ⚠️ THIS COMPONENT NEVER COERCES
//
// A value it does not recognise is RENDERED AS ITSELF, marked as unknown. The
// user sees that something is off instead of the product quietly changing
// units. `unknownUnitLabel` exists for exactly that case.
// ============================================

import * as React from 'react'

import { useUnits, type Unit, type UnitDimension } from '@hisabche/api'
import { unitSchema } from '@hisabche/validation'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../select'

/**
 * Shown before the request resolves and if the server is unreachable.
 *
 * ⚠️ This is a LOADING placeholder, not a second source of truth. It is the
 * four base units only — deliberately too short to be mistaken for the real
 * list, so nobody is tempted to maintain it in parallel.
 */
// `id: null` — these are a LOADING placeholder, not rows from the table, so
// there is no id to carry. Anything needing one (the product-units form)
// treats a null id as «not selectable yet».
const BASE_UNITS: Unit[] = [
  {
    id: null,
    code: 'piece',
    name: 'Piece',
    nameFa: 'عدد',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'gram',
    name: 'Gram',
    nameFa: 'گرم',
    symbol: 'g',
    dimension: 'weight',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'meter',
    name: 'Metre',
    nameFa: 'متر',
    symbol: 'm',
    dimension: 'length',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'liter',
    name: 'Litre',
    nameFa: 'لیتر',
    symbol: 'L',
    dimension: 'volume',
    conversionFactor: 1,
    isBase: true,
  },
]

const DIMENSION_LABEL: Record<UnitDimension, string> = {
  weight: 'وزن',
  length: 'طول',
  volume: 'حجم',
  count: 'تعداد',
}

const DIMENSION_ORDER: UnitDimension[] = ['count', 'weight', 'volume', 'length']

export interface UnitSelectProps {
  value: string | null | undefined
  onChange: (unit: string) => void
  /** Offer only this dimension — a gold product should not be offered litres. */
  dimension?: UnitDimension
  disabled?: boolean
  className?: string
  placeholder?: string
  /** Optional translator; falls back to the Persian label on the row. */
  t?: (key: string, fallback?: string) => string
}

export function unitLabel(unit: Unit, t?: UnitSelectProps['t']): string {
  const fallback = unit.nameFa ?? unit.name
  const label = t ? t(`warehouse.units.${unit.code}`, fallback) : fallback
  return unit.symbol ? `${label} (${unit.symbol})` : label
}

export function UnitSelect({
  value,
  onChange,
  dimension,
  disabled,
  className,
  placeholder = 'واحد',
  t,
}: UnitSelectProps) {
  const { data, isLoading } = useUnits()

  const units = React.useMemo(() => {
    const all = data?.units ?? BASE_UNITS
    return dimension ? all.filter((u) => u.dimension === dimension) : all
  }, [data, dimension])

  // ⚠️ The no-coercion rule, in one expression. A stored unit the list does
  // not contain is added to the list so the Select can display it, rather than
  // resolving to nothing and letting the trigger fall back to a placeholder —
  // which is how the old code lost the value on the next save.
  const unknown = value && !units.some((u) => u.code === value)

  const grouped = React.useMemo(() => {
    const map = new Map<UnitDimension, Unit[]>()
    for (const unit of units) {
      const list = map.get(unit.dimension) ?? []
      list.push(unit)
      map.set(unit.dimension, list)
    }
    return DIMENSION_ORDER.filter((d) => map.has(d)).map((d) => [d, map.get(d)!] as const)
  }, [units])

  return (
    // `exactOptionalPropertyTypes`: the prop must be ABSENT for «nothing
    // chosen», not present-and-undefined, or Radix treats it as controlled
    // with an empty value and the placeholder never shows.
    <Select {...(value ? { value } : {})} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {unknown ? (
          // Rendered as itself and labelled, never silently replaced.
          <SelectItem value={value!}>
            {value} — {t ? t('warehouse.units.unknown', 'واحد ناشناخته') : 'واحد ناشناخته'}
          </SelectItem>
        ) : null}

        {grouped.length === 1
          ? grouped[0]![1].map((unit) => (
              <SelectItem key={unit.code} value={unit.code}>
                {unitLabel(unit, t)}
              </SelectItem>
            ))
          : grouped.map(([dim, list]) => (
              <SelectGroup key={dim}>
                <SelectLabel>
                  {t ? t(`warehouse.dimension.${dim}`, DIMENSION_LABEL[dim]) : DIMENSION_LABEL[dim]}
                </SelectLabel>
                {list.map((unit) => (
                  <SelectItem key={unit.code} value={unit.code}>
                    {unitLabel(unit, t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
      </SelectContent>
    </Select>
  )
}

export default UnitSelect

/** What a write is allowed to carry — the zod enum, not a widened string. */
export type ValidUnit = ReturnType<typeof unitSchema.parse>

/**
 * The BOUNDARY between «display anything» and «store only what validates».
 *
 * The picker deliberately renders an unrecognised unit as itself, because
 * silently swapping it is the T2 defect. But a SAVE must not push an
 * unvalidatable code at the API, so every write site funnels through here.
 *
 * ⚠️ Returns null rather than a default. Returning 'piece' would be exactly
 * the coercion this whole change removes — the caller must decide, and the
 * honest decision is to refuse the save and tell the user.
 */
export function toValidUnit(unit: string | null | undefined): ValidUnit | null {
  const parsed = unitSchema.safeParse(unit)
  return parsed.success ? parsed.data : null
}
