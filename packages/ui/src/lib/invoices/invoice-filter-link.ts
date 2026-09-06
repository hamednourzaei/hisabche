// ============================================
// packages/ui/src/lib/invoices/invoice-filter-link.ts
//
// H1 — the link a dashboard card opens, and the filter the list applies,
// written ONCE so they cannot disagree.
//
// ---------------------------------------------------------------------------
// THE FAILURE THIS PREVENTS
//
// A KPI card that links to `/invoices?status=open&sort=outstanding` looks
// finished in a screenshot and does nothing: the invoice list read no query
// parameters at all, so every card would have landed on the same unfiltered
// table. The user sees a number, clicks it, and is shown a list that does not
// add up to it — with no error anywhere.
//
// `packages/ui/src/lib/invoices/invoices-types.ts` also carried `fromDate` and
// `toDate`, which NOTHING constructed and which the backend does not read — it
// reads `dateFrom`/`dateTo`. A date-filtered link built from that type would
// have returned the whole table, silently. Both are renamed below.
//
// ---------------------------------------------------------------------------
// HOW THIS AVOIDS REPEATING IT
//
// `INVOICE_FILTER_PARAMS` is the list of parameters the invoice list ACTUALLY
// honours. `buildInvoiceListHref` can only emit those keys, and
// `parseInvoiceFilters` reads exactly those keys. A card cannot link to a
// filter the list ignores, because the same table defines both directions and
// `invoice-filter-link.test.ts` round-trips every preset through it.
// ============================================

import type { InvoicesQueryParams } from './invoices-types'

/**
 * Every query parameter the invoice list honours, and how to read it.
 *
 * ⚠️ ADDING A KEY HERE IS NOT ENOUGH. The backend must read it too — see
 * `invoice.service.list()`. A key present here and absent there is exactly the
 * silent no-op this module exists to prevent, which is why the round-trip test
 * is paired with a backend filter test rather than standing alone.
 */
const READERS = {
  type: (raw: string) => (raw === 'sale' || raw === 'purchase' ? raw : undefined),

  status: (raw: string) =>
    (['pending', 'completed', 'cancelled', 'partial'] as const).find((s) => s === raw),

  // Affirmative spellings only. `?outstanding=false` must not switch the
  // filter on, which a plain truthiness check on a query string would do.
  outstanding: (raw: string) =>
    ['true', '1', 'yes'].includes(raw.toLowerCase()) ? true : undefined,

  // `dateFrom`/`dateTo` — the backend's own names. Validated rather than
  // trusted: a malformed date reaching `.gte('date', …)` is a 500, and the URL
  // is user-editable.
  dateFrom: (raw: string) => (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined),
  dateTo: (raw: string) => (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined),

  customerId: (raw: string) => (raw.length > 0 ? raw : undefined),
  search: (raw: string) => (raw.length > 0 ? raw : undefined),
} as const

export type InvoiceFilterParam = keyof typeof READERS

export const INVOICE_FILTER_PARAMS = Object.keys(READERS) as InvoiceFilterParam[]

/** A minimal `URLSearchParams`, so this works with Next's read-only object. */
export interface ReadableParams {
  get(key: string): string | null
}

/**
 * Read the filters the URL is asking for.
 *
 * Unknown keys and unparseable values are DROPPED rather than passed through.
 * Forwarding `?status=nonsense` to the API would return an empty table with no
 * explanation; ignoring it shows the unfiltered list, which is at least a
 * truthful answer to a question that was not valid.
 */
export function parseInvoiceFilters(params: ReadableParams | null): Partial<InvoicesQueryParams> {
  if (!params) return {}

  const out: Record<string, unknown> = {}
  for (const key of INVOICE_FILTER_PARAMS) {
    const raw = params.get(key)
    if (raw === null) continue
    const value = READERS[key](raw)
    if (value !== undefined) out[key] = value
  }
  return out as Partial<InvoicesQueryParams>
}

/** Today, as the backend's `date` column wants it. */
function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  // Local, not `toISOString()`. In Kabul (UTC+4:30) an invoice raised at 09:00
  // is still «yesterday» in UTC for the first four and a half hours of the
  // day, so a UTC date would open «today's sales» on the wrong day every
  // morning.
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * The destinations the dashboard cards link to.
 *
 * Functions, not constants, because `todaySales` has to be resolved when the
 * card is clicked — a preset frozen at module load would send someone to
 * yesterday on a tab left open overnight.
 *
 * Each one mirrors what its card actually COMPUTES, which is why there is no
 * preset for a card that does not exist. `warehouseValue` is absent
 * deliberately: it does not open the invoice list at all.
 */
export const INVOICE_LINK_PRESETS = {
  /** «فروش کل» — every sale invoice, which is exactly what the card sums. */
  totalSales: (): Partial<InvoicesQueryParams> => ({ type: 'sale' }),

  /** «فروش امروز» — sales dated today. */
  todaySales: (): Partial<InvoicesQueryParams> => {
    const d = today()
    return { type: 'sale', dateFrom: d, dateTo: d }
  },

  /**
   * «بدهی مشتریان» — sales with anything still owed.
   *
   * `outstanding`, not `status`: the card's rule is a NEGATION («anything but
   * fully paid») and no single status expresses it. The backend shares the
   * predicate with the KPI itself — see
   * `backend/src/services/invoices/outstanding.domain.ts`.
   */
  customerDebt: (): Partial<InvoicesQueryParams> => ({ type: 'sale', outstanding: true }),
} as const

export type InvoiceLinkPreset = keyof typeof INVOICE_LINK_PRESETS

/** `/invoices?…` for a preset. */
export function invoiceListHref(preset: InvoiceLinkPreset): string {
  const filters = INVOICE_LINK_PRESETS[preset]()
  const search = new URLSearchParams()

  for (const key of INVOICE_FILTER_PARAMS) {
    const value = (filters as Record<string, unknown>)[key]
    if (value === undefined) continue
    search.set(key, typeof value === 'boolean' ? String(value) : String(value))
  }

  const query = search.toString()
  return query ? `/invoices?${query}` : '/invoices'
}
