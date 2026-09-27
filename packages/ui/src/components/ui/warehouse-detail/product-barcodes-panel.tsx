'use client'

// ============================================
// A product's EXTRA barcodes (27 Sep 2026, docs/product-barcodes-migration.sql).
//
// The same goods under a second supplier's code, the carton's own code, a new
// packaging: each scans to this product. A code may name the unit it sells in
// (the carton's code adds a carton). One code belongs to one product — the
// server refuses a code any product already carries, main or extra, and the
// refusal is shown on the field, not as a toast.
//
// ⚠️ ONLINE ONLY: the device keeps each product's main barcode; extra codes
// are resolved by the server. The panel says so.
// ============================================

import { useState } from 'react'
import { Barcode, Trash2 } from 'lucide-react'
import {
  apiErrorMessage,
  useAddProductBarcode,
  useProductBarcodes,
  useRemoveProductBarcode,
} from '@hisabche/api'

import { Button } from '../button'
import { SelectField } from '../select-field'
import { barcodeTakenMessage } from '../../../lib/barcode/barcode-errors'

type T = (key: string, fallback?: string) => string

/**
 * The units a barcode commonly sells in, each with a label in fa/af/en
 * (`unit.*`). The server accepts any unit the product model knows; this is
 * the picker's list, not the rule.
 */
const BARCODE_UNITS = ['piece', 'box', 'pack', 'carton', 'kg', 'gram', 'liter', 'meter'] as const
type BarcodeUnit = (typeof BARCODE_UNITS)[number]
/** «The product's own unit» — an explicit value: the shared select has no empty one. */
const OWN_UNIT = 'own'

export function ProductBarcodesPanel({ t, productId }: { t: T; productId: string }) {
  const { data, isLoading, isError, refetch } = useProductBarcodes(productId)
  const add = useAddProductBarcode(productId)
  const remove = useRemoveProductBarcode(productId)
  const [code, setCode] = useState('')
  const [unit, setUnit] = useState<BarcodeUnit | typeof OWN_UNIT>(OWN_UNIT)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      await add.mutateAsync({ barcode: code, unit: unit === OWN_UNIT ? null : unit })
      setCode('')
      setUnit(OWN_UNIT)
    } catch (err) {
      setError(barcodeTakenMessage(err, t) ?? apiErrorMessage(err, t('barcode.extraAddFailed')))
    }
  }

  const rows = data ?? []

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-center gap-2">
        <Barcode className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{t('barcode.extraTitle')}</h3>
      </div>
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('barcode.extraHint')}</p>

      {/* §7.3: a failed read is an error, not «no extra codes». */}
      {isError ? (
        <div
          role="alert"
          className="flex items-center gap-2 text-xs text-[hsl(var(--color-destructive))]"
        >
          {t('barcode.extraLoadFailed')}
          <Button type="button" size="sm" variant="ghost" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : isLoading ? null : rows.length === 0 ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('barcode.extraEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border-default))]">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
              <span dir="ltr" className="font-mono tabular-nums">
                {row.barcode}
              </span>
              {row.unit ? (
                <span className="rounded bg-[hsl(var(--surface-muted))] px-1.5 text-xs">
                  {t(`unit.${row.unit}`, row.unit)}
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ms-auto"
                aria-label={t('barcode.extraRemove')}
                disabled={remove.isPending}
                onClick={() =>
                  void remove
                    .mutateAsync(row.id)
                    .catch((err) => setError(apiErrorMessage(err, t('barcode.extraRemoveFailed'))))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          {t('barcode.label')}
          <input
            name="barcode"
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="h-9 w-44 rounded-md border border-[hsl(var(--border-default))] bg-transparent px-2 font-mono"
          />
        </label>
        <div className="flex flex-col gap-1 text-xs" data-field="unit">
          {t('barcode.extraUnit')}
          <SelectField
            value={unit}
            onChange={(value) => setUnit(value as BarcodeUnit | typeof OWN_UNIT)}
            options={[
              { value: OWN_UNIT, label: t('barcode.extraUnitProduct') },
              ...BARCODE_UNITS.map((u) => ({ value: u, label: t(`unit.${u}`) })),
            ]}
            aria-label={t('barcode.extraUnit')}
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!code.trim() || add.isPending}
          onClick={() => void submit()}
        >
          {t('barcode.extraAdd')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
    </section>
  )
}
