'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/exchange-rate-dialog.tsx
//
// «تبادل نرخ» in a dialog — ONE form for every page that records a rate
// (owner, 18 Oct 2026: the warehouse's «+» is «exactly the dashboard form»).
// The dashboard and the warehouse value chips both mount this; neither keeps
// a rate form of its own.
//
// It saves through the same two writes as always: a currency → `exchange_rates`
// (`useSetExchangeRate`), a unit the business named → `custom_unit_rates`
// (`useSetCustomUnit`).
// ============================================

import {
  useCustomUnits,
  useSetCustomUnit,
  useSetExchangeRate,
  type CustomUnitQuote,
} from '@hisabche/api'
import { CURRENCY_PICK_ORDER } from '@hisabche/validation'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../dialog'
import { ExchangeRateForm } from './display-basis-picker'

/** The units the business named, each at its latest worth (newest first from the server). */
export function useLatestCustomUnits(): { ready: boolean; units: CustomUnitQuote[] } {
  const list = useCustomUnits().data
  const units: CustomUnitQuote[] = []
  if (list?.configured) {
    for (const unit of list.units) {
      if (!units.some((seen) => seen.name === unit.name)) units.push(unit)
    }
  }
  return { ready: list?.configured === true, units }
}

export function ExchangeRateDialog({
  t,
  open,
  title,
  base,
  initialCurrency,
  onClose,
  onSaved,
}: {
  t: (key: string, fallback?: string) => string
  open: boolean
  title: string
  /** The books' currency. */
  base: string
  /** Start the pair on this code (`unit:<name>` for a named unit). */
  initialCurrency?: string | undefined
  onClose: () => void
  /** A currency rate was saved: books-currency units per one of `currency`. */
  onSaved?: ((saved: { currency: string; rate: number }) => void) | undefined
}) {
  const setRate = useSetExchangeRate()
  const setUnit = useSetCustomUnit()
  const units = useLatestCustomUnits()

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent
        data-exchange-rate-dialog=""
        className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-x-hidden overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open ? (
          <ExchangeRateForm
            // Remount per opening so the pair starts on the right code.
            key={initialCurrency ?? 'new'}
            t={t}
            base={base}
            initialCurrency={initialCurrency}
            // The base is excluded: it is 1 against itself by definition.
            currencies={CURRENCY_PICK_ORDER.filter((code) => code !== base)}
            isSaving={setRate.isPending || setUnit.isPending}
            error={setRate.error ? String((setRate.error as Error).message) : null}
            onSave={(input) =>
              setRate.mutate(input, {
                onSuccess: () => {
                  onSaved?.({ currency: input.currency, rate: input.rate })
                  onClose()
                },
              })
            }
            customUnits={units.units.map((unit) => unit.name)}
            onSaveUnit={
              units.ready ? (input) => setUnit.mutate(input, { onSuccess: onClose }) : undefined
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
