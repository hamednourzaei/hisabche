'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/product-units-panel.tsx
//
// T11 / L1 — «این کالا را به چه واحدهایی می‌فروشید».
//
// ---------------------------------------------------------------------------
// WHY THIS IS THE HEAVIEST ITEM IN T11
//
// `product_units` and the conversion domain shipped in phase L. Nothing could
// write the table, so it was empty everywhere and multi-unit selling did not
// exist in practice. This panel is the missing half.
//
// ---------------------------------------------------------------------------
// ⚠️ THE SET IS SAVED WHOLE, AND THAT IS NOT A UI SHORTCUT
//
// «Exactly one base», «the base factor is 1», «at most one default per side»
// are properties of the SET. Editing one row at a time passes through states
// that break them — and the database enforces them with partial unique
// indexes, so «make cartons the base instead of pieces» would fail at the
// moment two rows claimed it.
//
// So the panel edits a local draft and submits all of it.
//
// ---------------------------------------------------------------------------
// ⚠️ THE FACTOR IS PER PRODUCT, NOT PER UNIT
//
// `units.conversion_factor` converts within a dimension — a kilogram is a
// thousand grams for everyone. `conversion_factor_to_base` here answers «how
// many base units is one of these FOR THIS PRODUCT», which is the only place
// «a carton of this holds 24» can be true while a carton of something else
// holds 12. The wording below says so, because entering one where the other
// was meant produces a quantity wrong by whatever the factor is.
// ============================================

import * as React from 'react'

import { Plus, Trash2 } from 'lucide-react'

import { useUnits, type Unit } from '@hisabche/api'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { SelectField } from '../select-field'
import { cn } from '../../../lib/utils'

export interface ProductUnitDraft {
  key: string
  unitId: string
  conversionFactorToBase: string
  isBaseUnit: boolean
  isPurchaseDefault: boolean
  isSaleDefault: boolean
}

export interface ProductUnitsPanelProps {
  t?: ((key: string, fallback?: string) => string) | undefined
  rows: ProductUnitDraft[]
  onChange: (rows: ProductUnitDraft[]) => void
  onSave: () => void
  isSaving?: boolean | undefined
  /** Server refusal, shown verbatim — the codes are specific for a reason. */
  error?: string | null | undefined
  disabled?: boolean | undefined
}

let seq = 0
export const newUnitRow = (): ProductUnitDraft => ({
  key: `pu-${(seq += 1)}`,
  unitId: '',
  conversionFactorToBase: '',
  isBaseUnit: false,
  isPurchaseDefault: false,
  isSaleDefault: false,
})

/**
 * The problems with a draft, in the user's language.
 *
 * ⚠️ Mirrors `validateUnitSet` on the server deliberately. The server is still
 * the one that decides — this exists so the person finds out while typing
 * rather than after submitting, which matters when the rules are about the
 * set rather than about the field they are in.
 */
export function unitSetProblems(rows: ProductUnitDraft[]): string[] {
  if (rows.length === 0) return []
  const problems: string[] = []

  const bases = rows.filter((row) => row.isBaseUnit)
  if (bases.length === 0) problems.push('باید دقیقاً یک واحد پایه انتخاب شود')
  if (bases.length > 1) problems.push('فقط یک واحد می‌تواند پایه باشد')

  if (bases.some((row) => Number(row.conversionFactorToBase) !== 1)) {
    // Otherwise «convert to base» is lossy on the base itself.
    problems.push('ضریب واحد پایه باید دقیقاً ۱ باشد')
  }

  if (rows.some((row) => !(Number(row.conversionFactorToBase) > 0))) {
    problems.push('ضریب هر واحد باید بزرگ‌تر از صفر باشد')
  }

  if (rows.some((row) => !row.unitId)) problems.push('برای هر سطر یک واحد انتخاب کنید')

  const ids = rows.map((row) => row.unitId).filter(Boolean)
  if (new Set(ids).size !== ids.length) problems.push('هر واحد فقط یک بار می‌تواند بیاید')

  if (rows.filter((row) => row.isPurchaseDefault).length > 1) {
    problems.push('فقط یک واحد می‌تواند پیش‌فرض خرید باشد')
  }
  if (rows.filter((row) => row.isSaleDefault).length > 1) {
    problems.push('فقط یک واحد می‌تواند پیش‌فرض فروش باشد')
  }

  return problems
}

export function ProductUnitsPanel({
  t,
  rows,
  onChange,
  onSave,
  isSaving,
  error,
  disabled,
}: ProductUnitsPanelProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)
  const { data: unitsData } = useUnits()
  const units: Unit[] = unitsData?.units ?? []

  const problems = unitSetProblems(rows)
  const baseCode = units.find(
    (unit) => unit.id === rows.find((row) => row.isBaseUnit)?.unitId,
  )?.code

  const patch = (key: string, next: Partial<ProductUnitDraft>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...next } : row)))

  /**
   * Choosing a base clears the others.
   *
   * A checkbox group where two can be ticked lets the user build an invalid
   * set and only learn on submit. Exclusivity is the rule, so the control
   * enforces it.
   */
  const setBase = (key: string) =>
    onChange(
      rows.map((row) => ({
        ...row,
        isBaseUnit: row.key === key,
        // The base converts to itself, always.
        conversionFactorToBase: row.key === key ? '1' : row.conversionFactorToBase,
      })),
    )

  const setExclusive = (key: string, field: 'isPurchaseDefault' | 'isSaleDefault') =>
    onChange(rows.map((row) => ({ ...row, [field]: row.key === key })))

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {tr('productUnits.title', 'واحدهای این کالا')}
        </h3>
        <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
          {tr(
            'productUnits.hint',
            'اگر این کالا را با بیش از یک واحد می‌فروشید، اینجا تعریفشان کنید. خالی گذاشتن یعنی تک‌واحدی.',
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-xs text-[hsl(var(--fg-secondary))]">
          {tr(
            'productUnits.empty',
            'این کالا تک‌واحدی است — مقدارها همان‌طور که وارد می‌شوند ثبت می‌شوند.',
          )}
        </p>
      ) : null}

      {rows.map((row) => (
        <div
          key={row.key}
          className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>{tr('productUnits.unit', 'واحد')}</Label>
              <SelectField
                value={row.unitId}
                onChange={(unitId) => patch(row.key, { unitId })}
                // ⚠️ The VALUE is the unit's id, not its code. `product_units
                // .unit_id` is a foreign key to `units(id)` and the endpoint
                // validates it as a uuid — sending a code 400s every save.
                //
                // A unit with no id comes from the server's seeded fallback,
                // which means the `units` table is absent on that database.
                // It is offered but disabled: saying so is better than an
                // option that fails on submit.
                options={units.map((unit) => ({
                  value: unit.id ?? '',
                  label: `${unit.nameFa ?? unit.name}${unit.symbol ? ` (${unit.symbol})` : ''}`,
                  disabled: !unit.id,
                }))}
                disabled={Boolean(disabled)}
                placeholder={tr('productUnits.pickUnit', 'انتخاب واحد')}
              />
            </div>

            <div className="flex-1 space-y-1">
              <Label>
                {row.isBaseUnit
                  ? tr('productUnits.factorBase', 'ضریب (واحد پایه = ۱)')
                  : tr('productUnits.factor', 'چند واحد پایه؟')}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={row.conversionFactorToBase}
                // The base is 1 by definition; making it editable invites a
                // value the database will reject anyway.
                disabled={Boolean(disabled) || row.isBaseUnit}
                onChange={(event) => patch(row.key, { conversionFactorToBase: event.target.value })}
                placeholder={baseCode ? tr('productUnits.factorHint', 'مثلاً ۲۴') : ''}
              />
            </div>

            <button
              type="button"
              disabled={Boolean(disabled)}
              onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
              aria-label={tr('common.remove', 'حذف')}
              className="mb-1 rounded-lg p-2 text-[hsl(var(--fg-tertiary))] transition-colors hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 text-[hsl(var(--fg-secondary))]">
              <input
                type="radio"
                name="product-unit-base"
                checked={row.isBaseUnit}
                disabled={Boolean(disabled)}
                onChange={() => setBase(row.key)}
              />
              {tr('productUnits.isBase', 'واحد پایه')}
            </label>

            <label className="flex items-center gap-1.5 text-[hsl(var(--fg-secondary))]">
              <input
                type="radio"
                name="product-unit-purchase"
                checked={row.isPurchaseDefault}
                disabled={Boolean(disabled)}
                onChange={() => setExclusive(row.key, 'isPurchaseDefault')}
              />
              {tr('productUnits.purchaseDefault', 'پیش‌فرض خرید')}
            </label>

            <label className="flex items-center gap-1.5 text-[hsl(var(--fg-secondary))]">
              <input
                type="radio"
                name="product-unit-sale"
                checked={row.isSaleDefault}
                disabled={Boolean(disabled)}
                onChange={() => setExclusive(row.key, 'isSaleDefault')}
              />
              {tr('productUnits.saleDefault', 'پیش‌فرض فروش')}
            </label>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={Boolean(disabled)}
          onClick={() => onChange([...rows, newUnitRow()])}
          className="gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {tr('productUnits.add', 'افزودن واحد')}
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={Boolean(disabled) || Boolean(isSaving) || problems.length > 0}
          onClick={onSave}
        >
          {isSaving ? tr('common.saving', 'در حال ثبت…') : tr('common.save', 'ثبت')}
        </Button>
      </div>

      {problems.length > 0 ? (
        <ul className="space-y-1 text-[11px] text-[hsl(var(--color-warning))]">
          {problems.map((problem) => (
            <li key={problem}>• {problem}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className={cn('text-[11px] text-[hsl(var(--color-destructive))]')} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

export default ProductUnitsPanel
