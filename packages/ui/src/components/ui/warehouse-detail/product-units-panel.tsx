'use client'

// ============================================
// «واحدهای این کالا» — pack ↔ bulk (QA report, Weighted Retail DNA; 10 Nov 2026).
//
// A nut seller buys a 10 kg sack and sells by the kilo; a grocer buys a box
// of 24 and sells singles. `PUT /products/:id/units` and its hooks existed
// with no screen (§7.1). Here the person lists the units this product is
// bought or sold in and how many BASE units each holds. The set is saved
// whole — «exactly one base, factor 1, at most one default per side» are
// rules of the set, checked here first and by the database again.
// ============================================

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  apiErrorMessage,
  useProductUnits,
  useSaveProductUnits,
  useUnits,
  type ProductUnitInput,
} from '@hisabche/api'

import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'

type Translate = (key: string, fallback?: string) => string

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

interface Row {
  key: string
  unitId: string
  factor: string
  isBaseUnit: boolean
  isPurchaseDefault: boolean
  isSaleDefault: boolean
}

let rowSeq = 0
const nextKey = () => `new-${(rowSeq += 1)}`

/** The rules of the set, in the order a person can fix them. null = fine. */
export function productUnitsProblem(rows: readonly Row[]): string | null {
  if (rows.length === 0) return null
  if (rows.some((row) => !row.unitId)) return 'productUnits.problems.pickUnit'
  if (new Set(rows.map((row) => row.unitId)).size !== rows.length)
    return 'productUnits.problems.duplicate'
  if (rows.filter((row) => row.isBaseUnit).length !== 1) return 'productUnits.problems.oneBase'
  for (const row of rows) {
    const factor = typedNumber(row.factor)
    if (factor === null || !(factor > 0)) return 'productUnits.problems.factor'
    if (row.isBaseUnit && factor !== 1) return 'productUnits.problems.baseIsOne'
  }
  if (rows.filter((row) => row.isPurchaseDefault).length > 1) return 'productUnits.problems.oneBuy'
  if (rows.filter((row) => row.isSaleDefault).length > 1) return 'productUnits.problems.oneSell'
  return null
}

export function ProductUnitsPanel({ t, productId }: { t: Translate; productId: string }) {
  const saved = useProductUnits(productId)
  const units = useUnits()
  const save = useSaveProductUnits(productId)
  const toast = useToast()
  // The saved set IS the form until the person edits it; after a save the
  // edits are dropped and the saved set shows again. Derived, not copied by
  // an effect.
  const savedRows = useMemo<Row[] | null>(
    () =>
      saved.data
        ? saved.data.map((unit) => ({
            key: `saved-${unit.unitId}`,
            unitId: unit.unitId,
            factor: String(unit.conversionFactorToBase),
            isBaseUnit: unit.isBaseUnit,
            isPurchaseDefault: unit.isPurchaseDefault,
            isSaleDefault: unit.isSaleDefault,
          }))
        : null,
    [saved.data],
  )
  const [edited, setEdited] = useState<Row[] | null>(null)
  const rows = edited ?? savedRows
  const setRows = (change: (current: Row[] | null) => Row[] | null) =>
    setEdited((current) => change(current ?? savedRows))

  const options = useMemo(
    () =>
      (units.data?.units ?? [])
        .filter((unit) => unit.id !== null)
        .map((unit) => ({ value: unit.id as string, label: unit.nameFa ?? unit.name })),
    [units.data],
  )

  const list = rows ?? []
  const problem = productUnitsProblem(list)
  // A seeded list has no ids to save against: said, not attempted.
  const seeded = units.data?.source === 'seed'

  const patch = (key: string, change: Partial<Row>) =>
    setRows((current) =>
      (current ?? []).map((row) => {
        if (row.key === key) return { ...row, ...change }
        // A flag that may be on for one row only moves, it is not doubled.
        return {
          ...row,
          ...(change.isBaseUnit ? { isBaseUnit: false } : {}),
          ...(change.isPurchaseDefault ? { isPurchaseDefault: false } : {}),
          ...(change.isSaleDefault ? { isSaleDefault: false } : {}),
        }
      }),
    )

  const submit = () => {
    if (problem || seeded) return
    const payload: ProductUnitInput[] = list.map((row) => ({
      unitId: row.unitId,
      conversionFactorToBase: typedNumber(row.factor) ?? 1,
      isBaseUnit: row.isBaseUnit,
      isPurchaseDefault: row.isPurchaseDefault,
      isSaleDefault: row.isSaleDefault,
    }))
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(t('productUnits.saved', 'واحدهای کالا ذخیره شد'))
        setEdited(null)
      },
      onError: (error) =>
        toast.error(apiErrorMessage(error, t('productUnits.failed', 'واحدها ذخیره نشد'))),
    })
  }

  if (saved.isError) {
    return (
      <section className={card}>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('productUnits.loadFailed', 'واحدهای این کالا خوانده نشد.')}
        </p>
      </section>
    )
  }

  return (
    <section className={card} data-guide="product-units">
      <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('productUnits.title', 'واحدهای خرید و فروش')}
      </h3>
      <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
        {t(
          'productUnits.hint',
          'مثلاً گونی ۱۰ کیلویی بخرید و کیلویی بفروشید: هر واحد می‌گوید چند واحد پایه در خود دارد.',
        )}
      </p>

      <div className="mt-3 space-y-2">
        {list.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-1 items-end gap-2 rounded-xl border border-[hsl(var(--border-default))] p-3 sm:grid-cols-[1fr_8rem_auto]"
          >
            <SelectField
              aria-label={t('productUnits.unit', 'واحد')}
              value={row.unitId}
              placeholder={t('productUnits.pickUnit', 'واحد را انتخاب کنید')}
              onChange={(value) => patch(row.key, { unitId: value })}
              options={options}
              searchable
            />
            <Input
              aria-label={t('productUnits.factor', 'چند واحد پایه')}
              inputMode="decimal"
              value={row.factor}
              disabled={row.isBaseUnit}
              onChange={(event) => patch(row.key, { factor: event.target.value })}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('productUnits.remove', 'حذف واحد')}
              onClick={() =>
                setRows((current) => (current ?? []).filter((item) => item.key !== row.key))
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
            <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--fg-secondary))] sm:col-span-3">
              {(
                [
                  ['isBaseUnit', t('productUnits.base', 'واحد پایه')],
                  ['isPurchaseDefault', t('productUnits.buyDefault', 'پیش‌فرض خرید')],
                  ['isSaleDefault', t('productUnits.sellDefault', 'پیش‌فرض فروش')],
                ] as const
              ).map(([flag, label]) => (
                <label key={flag} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={row[flag]}
                    onChange={(event) =>
                      patch(row.key, {
                        [flag]: event.target.checked,
                        ...(flag === 'isBaseUnit' && event.target.checked ? { factor: '1' } : {}),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {problem ? (
        <p className="mt-2 text-xs text-[hsl(var(--color-warning))]">{t(problem)}</p>
      ) : null}
      {seeded ? (
        <p className="mt-2 text-xs text-[hsl(var(--color-warning))]">
          {t('productUnits.seeded', 'فهرست واحدها روی سرور هنوز راه‌اندازی نشده؛ ذخیره ممکن نیست.')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setRows((current) => [
              ...(current ?? []),
              {
                key: nextKey(),
                unitId: '',
                factor: (current ?? []).length === 0 ? '1' : '',
                isBaseUnit: (current ?? []).length === 0,
                isPurchaseDefault: false,
                isSaleDefault: false,
              },
            ])
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('productUnits.add', 'افزودن واحد')}
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={Boolean(problem) || seeded || rows === null}
          loading={save.isPending}
        >
          {t('common.save', 'ذخیره')}
        </Button>
      </div>
    </section>
  )
}
