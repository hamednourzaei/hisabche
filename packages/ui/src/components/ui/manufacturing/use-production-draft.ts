'use client'

// ============================================
// The state of one production form: the component grid (the invoice grid's own
// columns and rows), the other costs, the labour, the quantity, the override
// and the inventory choice — and the cost derived from them.
//
// Local state, not a persisted store: a half-typed production is not a draft
// the business keeps, and two editors open at once (the manufacturing page and
// a product page) must not write into each other.
//
// ⚠️ THE COST SHOWN HERE IS A PREVIEW. It is computed with
// `computeProductionCost` — the same function the server runs on the same rows
// — and the server's answer is the one that is stored.
// ============================================

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  COLUMN,
  asProductionColumns,
  computeProductionCost,
  emptyRow,
  moveColumn,
  parseCellNumber,
  productionColumns,
  productionMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
  type ProductionCost,
} from '@hisabche/validation'
import type { CurrencyCode } from '@hisabche/store'
import type { ProductionDefinition } from '@hisabche/api'

export interface OtherCostDraft {
  id: string
  label: string
  amount: string
}

export interface LaborDraft {
  workers: string
  hours: string
  hourlyRate: string
  /** '' = derive from workers × hours × rate. */
  cost: string
}

const EMPTY_LABOR: LaborDraft = { workers: '', hours: '', hourlyRate: '', cost: '' }

/** '' → null (not recorded); anything else → the number typed. */
function optionalNumber(raw: string): number | null {
  return raw.trim() === '' ? null : Math.max(0, parseCellNumber(raw))
}

export function useProductionDraft(initialCurrency: CurrencyCode) {
  const sequence = useRef(0)
  const nextId = useCallback((prefix: string) => {
    sequence.current += 1
    return `${prefix}-${sequence.current}`
  }, [])

  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency)
  const [columns, setColumns] = useState<InvoiceColumn[]>(() => productionColumns(initialCurrency))
  const [rows, setRows] = useState<InvoiceGridRow[]>(() => [
    emptyRow('row-0', productionColumns(initialCurrency)),
  ])
  const [rates, setRates] = useState<Partial<Record<CurrencyCode, string>>>({})
  const [otherCosts, setOtherCosts] = useState<OtherCostDraft[]>([])
  const [labor, setLabor] = useState<LaborDraft>(EMPTY_LABOR)
  const [quantity, setQuantity] = useState('1')
  const [overrideOn, setOverrideOn] = useState(false)
  const [overrideTotal, setOverrideTotal] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [notes, setNotes] = useState('')
  const [bomId, setBomId] = useState<string | null>(null)

  // ─── Grid ────────────────────────────────────────────────────────────────

  const setCell = useCallback((rowId: string, columnId: string, value: string) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const next: InvoiceGridRow = { ...row, values: { ...row.values, [columnId]: value } }
        // Retyping the name of a picked product makes it a different thing: a
        // row that still pointed at the old product would consume THAT product
        // from stock under a name that no longer says so.
        if (columnId === COLUMN.description && row.productId) delete next.productId
        return next
      }),
    )
  }, [])

  const pickProduct = useCallback(
    (rowId: string, product: { id: string; name: string; price: string; unit: string }) => {
      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? {
                ...row,
                productId: product.id,
                values: {
                  ...row.values,
                  [COLUMN.description]: product.name,
                  [COLUMN.unitPrice]: product.price,
                  [COLUMN.unit]: product.unit || 'piece',
                  [COLUMN.quantity]: row.values[COLUMN.quantity] || '1',
                },
              }
            : row,
        ),
      )
    },
    [],
  )

  const addRow = useCallback(() => {
    setRows((current) => [...current, emptyRow(nextId('row'), columns)])
  }, [columns, nextId])

  const removeRow = useCallback(
    (rowId: string) => {
      setRows((current) => {
        const next = current.filter((row) => row.id !== rowId)
        // The grid always has a row to type in.
        return next.length > 0 ? next : [emptyRow(nextId('row'), columns)]
      })
    },
    [columns, nextId],
  )

  const duplicateRow = useCallback(
    (rowId: string) => {
      setRows((current) => {
        const index = current.findIndex((row) => row.id === rowId)
        const source = current[index]
        if (!source) return current
        const copy: InvoiceGridRow = { ...source, id: nextId('row'), values: { ...source.values } }
        return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]
      })
    },
    [nextId],
  )

  const addColumn = useCallback((column: InvoiceColumn) => {
    setColumns((current) => [...current, column])
  }, [])
  const replaceColumn = useCallback((column: InvoiceColumn) => {
    setColumns((current) => current.map((c) => (c.id === column.id ? column : c)))
  }, [])
  const updateColumn = useCallback((id: string, patch: Partial<InvoiceColumn>) => {
    setColumns((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])
  const removeColumn = useCallback((id: string) => {
    setColumns((current) => current.filter((c) => c.id !== id || c.system))
  }, [])
  const shiftColumn = useCallback((id: string, direction: -1 | 1) => {
    setColumns((current) => moveColumn(current, id, direction))
  }, [])
  const resetColumns = useCallback(() => setColumns(productionColumns(currency)), [currency])

  /**
   * Changing the production currency re-denominates the built-in money
   * columns. A column the user put in ANOTHER currency on purpose keeps it.
   */
  const setCurrency = useCallback(
    (next: CurrencyCode) => {
      setColumns((current) =>
        current.map((column) =>
          (column.id === COLUMN.unitPrice || column.id === COLUMN.lineTotal) &&
          column.currency === currency
            ? { ...column, currency: next }
            : column,
        ),
      )
      setCurrencyState(next)
    },
    [currency],
  )

  const setRate = useCallback((code: CurrencyCode, value: string) => {
    setRates((current) => ({ ...current, [code]: value }))
  }, [])

  // ─── Other costs ─────────────────────────────────────────────────────────

  const addOtherCost = useCallback(() => {
    setOtherCosts((current) => [...current, { id: nextId('cost'), label: '', amount: '' }])
  }, [nextId])
  const setOtherCost = useCallback((id: string, patch: Partial<Omit<OtherCostDraft, 'id'>>) => {
    setOtherCosts((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])
  const removeOtherCost = useCallback((id: string) => {
    setOtherCosts((current) => current.filter((c) => c.id !== id))
  }, [])

  const setLaborField = useCallback((field: keyof LaborDraft, value: string) => {
    setLabor((current) => ({ ...current, [field]: value }))
  }, [])

  // ─── Loading a saved definition ──────────────────────────────────────────

  const load = useCallback(
    (definition: ProductionDefinition, fallbackCurrency: CurrencyCode) => {
      const definitionCurrency = (definition.currency as CurrencyCode | null) ?? fallbackCurrency
      const savedColumns = asProductionColumns(
        definition.columns as Parameters<typeof asProductionColumns>[0],
      )
      const nextColumns =
        savedColumns.length > 0 ? savedColumns : productionColumns(definitionCurrency)
      setCurrencyState(definitionCurrency)
      setColumns(nextColumns)
      setRows(
        definition.rows.length > 0
          ? definition.rows.map((row) => ({
              id: row.id,
              ...(row.productId ? { productId: row.productId } : {}),
              values: { ...row.values },
            }))
          : [emptyRow(nextId('row'), nextColumns)],
      )
      setOtherCosts(
        definition.otherCosts.map((cost) => ({
          id: nextId('cost'),
          label: cost.label,
          amount: String(cost.amount),
        })),
      )
      const numberText = (value: number | null) => (value === null ? '' : String(value))
      setLabor({
        workers: numberText(definition.labor.workers),
        hours:
          definition.labor.minutes === null ? '' : String(Number(definition.labor.minutes) / 60),
        hourlyRate: numberText(definition.labor.hourlyRate),
        cost: numberText(definition.labor.cost),
      })
      setNotes(definition.notes)
      setBomId(definition.bomId)
    },
    [nextId],
  )

  const reset = useCallback(
    (nextCurrency: CurrencyCode) => {
      const fresh = productionColumns(nextCurrency)
      setCurrencyState(nextCurrency)
      setColumns(fresh)
      setRows([emptyRow(nextId('row'), fresh)])
      setRates({})
      setOtherCosts([])
      setLabor(EMPTY_LABOR)
      setOverrideOn(false)
      setOverrideTotal('')
      setOverrideReason('')
      setNotes('')
      setBomId(null)
    },
    [nextId],
  )

  // ─── What goes to the server, and what it will cost ──────────────────────

  const parsedRates = useMemo(() => {
    const out: Partial<Record<CurrencyCode, number>> = {}
    for (const [code, raw] of Object.entries(rates)) {
      const value = parseCellNumber(raw)
      // A blank or zero rate is not a rate: sending 0 would make every amount
      // in that currency worth nothing.
      if (value > 0) out[code as CurrencyCode] = value
    }
    return out
  }, [rates])

  const ctx = useMemo(() => productionMoneyContext(currency, parsedRates), [currency, parsedRates])

  const laborInput = useMemo(() => {
    const hours = optionalNumber(labor.hours)
    return {
      workers: optionalNumber(labor.workers),
      minutes: hours === null ? null : hours * 60,
      hourlyRate: optionalNumber(labor.hourlyRate),
      cost: optionalNumber(labor.cost),
    }
  }, [labor])

  const otherCostInput = useMemo(
    () =>
      otherCosts
        .map((cost) => ({
          label: cost.label.trim(),
          amount: Math.max(0, parseCellNumber(cost.amount)),
        }))
        .filter((cost) => cost.label !== '' || cost.amount > 0),
    [otherCosts],
  )

  const quantityValue = parseCellNumber(quantity)
  const overrideValue =
    overrideOn && overrideTotal.trim() !== '' ? Math.max(0, parseCellNumber(overrideTotal)) : null

  const cost: ProductionCost = useMemo(
    () =>
      computeProductionCost({
        currency,
        columns,
        rows,
        rates: parsedRates,
        otherCosts: otherCostInput,
        labor: laborInput,
        quantity: quantityValue,
        overrideTotal: overrideValue,
      }),
    [
      currency,
      columns,
      rows,
      parsedRates,
      otherCostInput,
      laborInput,
      quantityValue,
      overrideValue,
    ],
  )

  return {
    currency,
    setCurrency,
    columns,
    rows,
    ctx,
    rates,
    setRate,
    parsedRates,
    setCell,
    pickProduct,
    addRow,
    removeRow,
    duplicateRow,
    addColumn,
    replaceColumn,
    updateColumn,
    removeColumn,
    shiftColumn,
    resetColumns,
    otherCosts,
    otherCostInput,
    addOtherCost,
    setOtherCost,
    removeOtherCost,
    labor,
    laborInput,
    setLaborField,
    quantity,
    setQuantity,
    quantityValue,
    overrideOn,
    setOverrideOn,
    overrideTotal,
    setOverrideTotal,
    overrideValue,
    overrideReason,
    setOverrideReason,
    notes,
    setNotes,
    bomId,
    load,
    reset,
    cost,
  }
}

export type ProductionDraft = ReturnType<typeof useProductionDraft>
