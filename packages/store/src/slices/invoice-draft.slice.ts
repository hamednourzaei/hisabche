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
  /**
   * Everyone on this invoice. The FIRST is the invoice's own customer — the
   * one `customers.id` points at and the one the receivable belongs to. The
   * rest ride along as named parties. See `customer-panel.tsx` for why.
   */
  customers: InvoiceDraftCustomer[]
  transactionType: 'sale' | 'purchase'
  /** ISO date the invoice is dated. */
  date: string
  dueDate: string | null
  /**
   * Multi-warehouse: where this invoice's goods leave/arrive. Kept across
   * invoices (a counter usually sells from one warehouse); null = the server
   * uses the only warehouse, or none.
   */
  warehouseId: string | null
  /** The branch this invoice is written in; null = the business as a whole. */
  branchId: string | null
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
  removeLastRow: () => void
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
  addCustomer: (customer: InvoiceDraftCustomer) => void
  removeCustomer: (id: string) => void
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
    customers: [],
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
      warehouseId: null,
      branchId: null,
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

      // The summary's item-count arrows call this. It drops the last row, and
      // never the only one — the grid always has something to type into.
      removeLastRow: () =>
        set((state) => {
          if (state.rows.length <= 1) return state
          return { rows: state.rows.slice(0, -1) }
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
      addCustomer: (customer) =>
        set((state) =>
          state.customers.some((c) => c.id === customer.id)
            ? state
            : { customers: [...state.customers, customer] },
        ),

      removeCustomer: (id) =>
        set((state) => ({ customers: state.customers.filter((c) => c.id !== id) })),
      setField: (key, value) => set({ [key]: value } as Pick<InvoiceDraftState, typeof key>),
      setRate: (currency, value) =>
        set((state) => ({ rates: { ...state.rates, [currency]: value } })),

      clearDraft: () => set(blankDraft(get().columns)),
    }),
    {
      name: 'hisabche-invoice-draft',
      /**
       * Bump whenever the persisted SHAPE changes.
       *
       * A draft written by an older build is still sitting in the user's
       * localStorage when the new one loads, and zustand's default merge is
       * shallow — a renamed key arrives as the old name and the new one is
       * simply absent, which is how `customers.length` crashed the panel on a
       * draft saved minutes earlier.
       */
      version: 2,
      migrate: (persisted, from) => {
        const state = (persisted ?? {}) as Record<string, unknown>

        // v1 → v2: a single `customer` became an ordered `customers` list.
        if (from < 2) {
          const legacy = state.customer as InvoiceDraftCustomer | null | undefined
          state.customers = legacy ? [legacy] : []
          delete state.customer
        }

        return state
      },
      /**
       * Belt and braces for a draft that predates versioning, which has no
       * version stamp and so never reaches `migrate`. Every array and object
       * the UI indexes into is guaranteed here.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<InvoiceDraftState> & {
          customer?: InvoiceDraftCustomer | null
        }

        // ⚠️ A PRISTINE DRAFT'S DATE IS TODAY, NOT THE DAY IT WAS PERSISTED.
        //
        // `blankDraft()` stamps `date: new Date()` at the moment it runs — and
        // it runs in `clearDraft()`, right after the PREVIOUS invoice is saved.
        // That stamp is then persisted. So an invoice started three days later,
        // with the date field never touched, was saved dated three days ago:
        // outside the dashboard's 7-day chart window, and wrong on the
        // document itself.
        //
        // Only a draft with nothing typed into it is refreshed. A draft with
        // content keeps its date, because someone may have set it on purpose.
        const savedRows = Array.isArray(saved.rows) ? saved.rows : []
        const pristine = savedRows.every((row) =>
          Object.values(row?.values ?? {}).every((value) => !String(value ?? '').trim()),
        )

        return {
          ...current,
          ...saved,
          ...(pristine ? { date: new Date().toISOString() } : {}),
          columns:
            Array.isArray(saved.columns) && saved.columns.length ? saved.columns : current.columns,
          rows: Array.isArray(saved.rows) && saved.rows.length ? saved.rows : current.rows,
          customers: Array.isArray(saved.customers)
            ? saved.customers
            : saved.customer
              ? [saved.customer]
              : [],
          rates: saved.rates ?? {},
        }
      },
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
          return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
      partialize: (state) => ({
        columns: state.columns,
        columnsInitialised: state.columnsInitialised,
        rows: state.rows,
        customers: state.customers,
        transactionType: state.transactionType,
        date: state.date,
        dueDate: state.dueDate,
        warehouseId: state.warehouseId,
        branchId: state.branchId,
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
