// ============================================
// packages/store/src/slices/invoice-draft.slice.ts
//
// The single source of truth for an in-progress invoice.
//
// It exists because the builder and the preview are two ROUTES, not two tabs
// of one component. Everything the preview draws — rows, the exact column
// layout, the customer, the rate — has to survive `/invoices/new` →
// `/invoices/new/preview` → back, and a browser refresh in between. Holding it
// in a persisted store rather than in a query string or a React ref is what
// makes «the preview shows exactly the configured columns» true rather than
// hopeful.
//
// The COLUMN LAYOUT is deliberately persisted separately from the draft: a
// shop's invoice shape is a lasting preference, so clearing a draft after
// creating an invoice must not throw away the columns they set up.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  COLUMN,
  defaultColumns,
  emptyRow,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '@hisabche/validation'

import type { CurrencyCode } from './currency.slice'

export interface InvoiceDraftCustomer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface InvoiceDraftState {
  /** Layout. Outlives any single draft — see the file header. */
  columns: InvoiceColumn[]
  /** Whether the layout has ever been initialised for a currency. */
  columnsInitialised: boolean

  rows: InvoiceGridRow[]
  customer: InvoiceDraftCustomer | null
  transactionType: 'sale' | 'purchase'
  /** ISO date the invoice is dated. */
  date: string
  dueDate: string | null
  notes: string
  paymentMethod: 'cash' | 'credit'
  isPaid: boolean
  paidNow: string
  discountValue: string
  discountType: 'fixed' | 'percentage'
  taxRate: string
  /**
   * How many units of the invoice currency one unit of a foreign currency is
   * worth. Typed by the user; absent means "no rate", and nothing converts.
   */
  rates: Partial<Record<CurrencyCode, string>>

  // ---- rows ----
  setRows: (rows: InvoiceGridRow[]) => void
  addRow: () => void
  duplicateRow: (id: string) => void
  removeRow: (id: string) => void
  setCell: (rowId: string, columnId: string, value: string) => void
  setRowProduct: (rowId: string, productId: string | undefined, name: string, price: string) => void

  // ---- columns ----
  initColumns: (currency: CurrencyCode) => void
  setColumns: (columns: InvoiceColumn[]) => void
  addColumn: (column: InvoiceColumn) => void
  updateColumn: (id: string, patch: Partial<InvoiceColumn>) => void
  removeColumn: (id: string) => void
  resetColumns: (currency: CurrencyCode) => void

  // ---- meta ----
  setCustomer: (customer: InvoiceDraftCustomer | null) => void
  setField: <K extends keyof InvoiceDraftState>(key: K, value: InvoiceDraftState[K]) => void
  setRate: (currency: CurrencyCode, value: string) => void

  /** Wipes the draft but keeps the column layout. */
  clearDraft: () => void
}

/** A new row id that is stable across a refresh and cannot collide. */
let rowCounter = 0
function nextRowId(): string {
  rowCounter += 1
  return `r${Date.now().toString(36)}${rowCounter.toString(36)}`
}

/** The grid always ends in one blank row, ready to be typed into. */
function withTrailingBlank(rows: InvoiceGridRow[], columns: InvoiceColumn[]): InvoiceGridRow[] {
  const last = rows[rows.length - 1]
  const lastIsBlank = last && Object.values(last.values).every((v) => !v.trim())
  return lastIsBlank ? rows : [...rows, emptyRow(nextRowId(), columns)]
}

/**
 * The layout the store starts with.
 *
 * Built eagerly rather than by an effect: a grid with zero columns is not a
 * valid state, and making the store depend on a component mounting to reach a
 * valid state is how it briefly rendered an empty table. The currency here is
 * only a starting point — `initColumns` re-keys it to the user's actual
 * currency on first mount, before anything is typed.
 */
const INITIAL_CURRENCY: CurrencyCode = 'AFN'

function blankDraft(columns: InvoiceColumn[]) {
  return {
    rows: [emptyRow(nextRowId(), columns)],
    customer: null,
    transactionType: 'sale' as const,
    date: new Date().toISOString(),
    dueDate: null,
    notes: '',
    paymentMethod: 'cash' as const,
    isPaid: true,
    paidNow: '',
    discountValue: '',
    discountType: 'fixed' as const,
    taxRate: '',
  }
}

export const useInvoiceDraftStore = create<InvoiceDraftState>()(
  persist(
    (set, get) => ({
      columns: defaultColumns(INITIAL_CURRENCY),
      columnsInitialised: false,
      rates: {},
      ...blankDraft(defaultColumns(INITIAL_CURRENCY)),

      // ---- rows ----
      setRows: (rows) => set({ rows: withTrailingBlank(rows, get().columns) }),

      addRow: () =>
        set((state) => ({ rows: [...state.rows, emptyRow(nextRowId(), state.columns)] })),

      duplicateRow: (id) =>
        set((state) => {
          const index = state.rows.findIndex((r) => r.id === id)
          const source = state.rows[index]
          if (!source) return state
          const copy: InvoiceGridRow = {
            id: nextRowId(),
            ...(source.productId ? { productId: source.productId } : {}),
            values: { ...source.values },
          }
          const rows = [...state.rows]
          rows.splice(index + 1, 0, copy)
          return { rows }
        }),

      removeRow: (id) =>
        set((state) => {
          const rows = state.rows.filter((r) => r.id !== id)
          // Never leave the grid with nothing to type into.
          return { rows: rows.length ? rows : [emptyRow(nextRowId(), state.columns)] }
        }),

      setCell: (rowId, columnId, value) =>
        set((state) => {
          const rows = state.rows.map((row) =>
            row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row,
          )
          return { rows: withTrailingBlank(rows, state.columns) }
        }),

      setRowProduct: (rowId, productId, name, price) =>
        set((state) => {
          const rows = state.rows.map((row) => {
            if (row.id !== rowId) return row
            const values: Record<string, string> = {
              ...row.values,
              [COLUMN.description]: name,
            }
            // Only seed the price when the user has not typed one — retyping
            // over a deliberate price would silently change the money.
            if (price && !values[COLUMN.unitPrice]?.trim()) values[COLUMN.unitPrice] = price
            if (!values[COLUMN.quantity]?.trim()) values[COLUMN.quantity] = '1'
            const next: InvoiceGridRow = { id: row.id, values }
            if (productId) next.productId = productId
            return next
          })
          return { rows: withTrailingBlank(rows, state.columns) }
        }),

      // ---- columns ----
      // Runs once, to re-key the starting layout to the user's real currency.
      // After that the layout is the user's and is never rewritten — adding
      // «وزن خالص» must survive every visit.
      initColumns: (currency) => {
        if (get().columnsInitialised) return
        const columns = defaultColumns(currency)
        set({
          columns,
          columnsInitialised: true,
          rows: get().rows.length ? get().rows : [emptyRow(nextRowId(), columns)],
        })
      },

      setColumns: (columns) => set({ columns }),

      addColumn: (column) =>
        set((state) => {
          // New columns land before the computed total so «مبلغ کل» stays the
          // last thing the eye reaches.
          const totalIndex = state.columns.findIndex((c) => c.id === COLUMN.lineTotal)
          const columns = [...state.columns]
          if (totalIndex < 0) columns.push(column)
          else columns.splice(totalIndex, 0, column)
          return { columns }
        }),

      updateColumn: (id, patch) =>
        set((state) => ({
          columns: state.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeColumn: (id) =>
        set((state) => {
          const column = state.columns.find((c) => c.id === id)
          // A system column carries a field the invoice cannot be saved
          // without. Guarded here as well as in the UI so no caller can
          // remove it by accident.
          if (!column || column.system) return state
          return {
            columns: state.columns.filter((c) => c.id !== id),
            // The values go with it — a deleted column must not keep
            // contributing to a total from an invisible cell.
            rows: state.rows.map((row) => {
              const values = { ...row.values }
              delete values[id]
              return { ...row, values }
            }),
          }
        }),

      resetColumns: (currency) =>
        set({ columns: defaultColumns(currency), columnsInitialised: true }),

      // ---- meta ----
      setCustomer: (customer) => set({ customer }),
      setField: (key, value) => set({ [key]: value } as Pick<InvoiceDraftState, typeof key>),
      setRate: (currency, value) =>
        set((state) => ({ rates: { ...state.rates, [currency]: value } })),

      clearDraft: () => set(blankDraft(get().columns)),
    }),
    {
      name: 'hisabche-invoice-draft',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
          return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
      partialize: (state) => ({
        columns: state.columns,
        columnsInitialised: state.columnsInitialised,
        rows: state.rows,
        customer: state.customer,
        transactionType: state.transactionType,
        date: state.date,
        dueDate: state.dueDate,
        notes: state.notes,
        paymentMethod: state.paymentMethod,
        isPaid: state.isPaid,
        paidNow: state.paidNow,
        discountValue: state.discountValue,
        discountType: state.discountType,
        taxRate: state.taxRate,
        rates: state.rates,
      }),
    },
  ),
)
