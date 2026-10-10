// packages/ui/src/components/ui/landing/journey/journey-screens.ts
//
// What each station's board shows about the ONE sale.
//
// Every figure here comes from a selector in `landing-demo-data.ts`; this file
// only arranges them into rows. The words come in already translated (the
// server resolves them), so a model is plain data: it crosses from the server
// component to the client stage, and the scene draws it on a canvas.
//
// Each station names the product capability it stands for. The evidence is the
// catalogue (`docs/feature-audit/CATALOG.md`), checked on 10 Oct 2026:
//   pay    — «فاکتور»: settlement status follows payment allocations; the
//            customer's running balance (`runningLedger`, `netBalance`).
//   cash   — POS «Drawer Ledger»: what should be in the drawer.
//   stock  — «به‌روزرسانی خودکار موجودی کالا (Stock Movements)» from invoice items.
//   post   — «دفتر کل و حساب‌ها»: journal entries written with the invoice.
//   report — «گزارش‌های مالی» / «Operational & Profit Reports».

import { JOURNEY_STATIONS, type JourneyStationId } from './journey-machine'
import {
  DEMO_SALE,
  customerBalanceAfter,
  demoLocale,
  drawerAfter,
  formatDemoAmount,
  formatDemoCount,
  journalLines,
  reportFigures,
  saleRemaining,
  saleTotal,
  stockAfter,
  type JournalAccount,
} from './landing-demo-data'

export const STATION_FEATURE: Record<JourneyStationId, string> = {
  pay: 'invoices.settlement',
  cash: 'pos.drawer-ledger',
  stock: 'invoices.stock-movements',
  post: 'accounting.journal',
  report: 'accounting.reports',
}

export type ScreenTone = 'plain' | 'good' | 'warn'

export interface ScreenRow {
  label: string
  value: string
  /** A second figure, in its own column (a journal line's credit). */
  extra: string
  tone: ScreenTone
  strong: boolean
  /** 0 → 1: a bar under the row, as a share of the largest figure. Zero: no bar. */
  share: number
}

export interface ScreenModel {
  id: JourneyStationId
  title: string
  /** «نمونه» — the board says its figures are an example. */
  note: string
  /** Column headings, when the rows have two figures. */
  columns: [string, string] | null
  rows: ScreenRow[]
  /** The line under the rows once the station has recorded the sale. */
  foot: string
  /** The line there before that. */
  waiting: string
}

/** The translated words a board needs. Templates carry `{name}` placeholders. */
export interface ScreenLabels {
  titles: Record<JourneyStationId, string>
  note: string
  waiting: string
  /** `{amount} {unit}` in the reader's word order. */
  money: string
  units: { toman: string; afghani: string }
  /** `{before} → {after}`, the arrow pointing the way the language reads. */
  change: string
  /** `Invoice {id}`. */
  invoice: string
  total: string
  paid: string
  remaining: string
  customerBalance: string
  received: string
  drawerBefore: string
  drawerAfter: string
  items: Record<string, string>
  debit: string
  credit: string
  accounts: Record<JournalAccount, string>
  balanced: string
  sales: string
  receivables: string
  unitsSold: string
}

/** Put values into a `{name}` template. A name with no value stays as written. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole)
}

const row = (
  label: string,
  value: string,
  more: Partial<Pick<ScreenRow, 'extra' | 'tone' | 'strong' | 'share'>> = {},
): ScreenRow => ({
  label,
  value,
  extra: more.extra ?? '',
  tone: more.tone ?? 'plain',
  strong: more.strong ?? false,
  share: more.share ?? 0,
})

export function buildScreens(labels: ScreenLabels, locale: string): ScreenModel[] {
  const unit = demoLocale(locale) === 'fa' ? labels.units.toman : labels.units.afghani
  const money = (base: number) =>
    fill(labels.money, { amount: formatDemoAmount(base, locale), unit })
  const figure = (base: number) => formatDemoAmount(base, locale)
  const count = (value: number) => formatDemoCount(value, locale)
  const report = reportFigures()
  const invoice = fill(labels.invoice, { id: DEMO_SALE.invoiceId })

  const rows: Record<JourneyStationId, ScreenRow[]> = {
    pay: [
      row(labels.total, money(saleTotal()), { strong: true }),
      row(labels.paid, money(DEMO_SALE.paid), { tone: 'good' }),
      row(labels.remaining, money(saleRemaining()), { tone: 'warn' }),
      row(labels.customerBalance, money(customerBalanceAfter())),
    ],
    cash: [
      row(labels.drawerBefore, money(DEMO_SALE.drawerBefore)),
      row(labels.received, money(DEMO_SALE.paid), { tone: 'good' }),
      row(labels.drawerAfter, money(drawerAfter()), { strong: true }),
    ],
    stock: DEMO_SALE.items.map((item) =>
      row(
        labels.items[item.id] ?? item.id,
        fill(labels.change, {
          before: count(item.stockBefore),
          after: count(stockAfter(item)),
        }),
        { strong: true, share: stockAfter(item) / item.stockBefore },
      ),
    ),
    // A journal line has two figures; the empty side of a line is left empty.
    post: journalLines().map((line) =>
      row(labels.accounts[line.account], line.debit > 0 ? figure(line.debit) : '', {
        extra: line.credit > 0 ? figure(line.credit) : '',
      }),
    ),
    report: [
      row(labels.sales, money(report.sales), { strong: true, share: 1 }),
      row(labels.received, money(report.received), {
        tone: 'good',
        share: report.received / report.sales,
      }),
      row(labels.receivables, money(report.receivables), {
        tone: 'warn',
        share: report.receivables / report.sales,
      }),
      row(labels.unitsSold, count(report.unitsSold)),
    ],
  }
  const foot: Record<JourneyStationId, string> = {
    pay: invoice,
    cash: invoice,
    stock: invoice,
    post: labels.balanced,
    report: invoice,
  }

  return JOURNEY_STATIONS.map((id) => ({
    id,
    title: labels.titles[id],
    note: labels.note,
    columns: id === 'post' ? [labels.debit, labels.credit] : null,
    rows: rows[id],
    foot: foot[id],
    waiting: labels.waiting,
  }))
}
