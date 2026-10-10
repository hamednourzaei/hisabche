// packages/ui/src/components/ui/landing/journey/landing-demo-data.ts
//
// ONE illustrative sale, and every number the landing scene may show about it.
//
// ⚠️ ILLUSTRATIVE. This is not a customer's record and not a statistic: it is a
// made-up sale used to show how one operation flows through the product. The
// page says so wherever a figure from it appears («نمونه»).
//
// The rule this file exists for: NO NUMBER IS TYPED TWICE. The inputs are the
// few literals in `DEMO_SALE`. Everything else — a total on a screen, a balance
// in a sentence, a journal line, a report figure — is derived here, so two
// stations can never disagree about the same sale.
//
// Amounts are integers in the story's own unit; `PRESENTATION` turns them into
// toman for Iran and afghani for the Afghan and English pages.

export type DemoLocale = 'fa' | 'af' | 'en'

export interface DemoItem {
  id: string
  quantity: number
  unitPrice: number
  stockBefore: number
}

export interface DemoSale {
  invoiceId: string
  items: readonly DemoItem[]
  /** Received in cash at the counter; the rest stays on the customer's account. */
  paid: number
  customerBalanceBefore: number
  drawerBefore: number
}

export const DEMO_SALE: DemoSale = {
  invoiceId: 'INV-1042',
  items: [
    { id: 'first', quantity: 2, unitPrice: 500_000, stockBefore: 24 },
    { id: 'second', quantity: 1, unitPrice: 300_000, stockBefore: 9 },
  ],
  paid: 800_000,
  customerBalanceBefore: 0,
  drawerBefore: 2_000_000,
}

export const lineTotal = (item: DemoItem): number => item.quantity * item.unitPrice
export const saleTotal = (): number =>
  DEMO_SALE.items.reduce((sum, item) => sum + lineTotal(item), 0)
export const saleRemaining = (): number => saleTotal() - DEMO_SALE.paid
export const paymentKind = (): 'cash' | 'credit' | 'partial' =>
  saleRemaining() === 0 ? 'cash' : DEMO_SALE.paid === 0 ? 'credit' : 'partial'
export const customerBalanceAfter = (): number => DEMO_SALE.customerBalanceBefore + saleRemaining()
export const drawerAfter = (): number => DEMO_SALE.drawerBefore + DEMO_SALE.paid
export const stockAfter = (item: DemoItem): number => item.stockBefore - item.quantity
export const unitsSold = (): number => DEMO_SALE.items.reduce((sum, item) => sum + item.quantity, 0)

export type JournalAccount = 'cash' | 'receivable' | 'salesRevenue'
export interface JournalLine {
  account: JournalAccount
  debit: number
  credit: number
}

/**
 * The double entry of this sale: cash for what was paid, a receivable for what
 * was not, revenue for the whole. A line with nothing on it is not written.
 */
export function journalLines(): JournalLine[] {
  const lines: JournalLine[] = [
    { account: 'cash', debit: DEMO_SALE.paid, credit: 0 },
    { account: 'receivable', debit: saleRemaining(), credit: 0 },
    { account: 'salesRevenue', debit: 0, credit: saleTotal() },
  ]
  return lines.filter((line) => line.debit !== 0 || line.credit !== 0)
}

/** What the day's report says once this sale is in it. */
export const reportFigures = () => ({
  sales: saleTotal(),
  received: DEMO_SALE.paid,
  receivables: customerBalanceAfter(),
  unitsSold: unitsSold(),
})

// One shop, told in two currencies. The same basket has to be a believable
// price in both: 130,000 toman in Iran, 13,000 afghani in Afghanistan. So the
// story's unit is divided by a different amount for each reader.
const PRESENTATION = {
  fa: { tag: 'fa-IR', divisor: 10, currency: 'toman' },
  af: { tag: 'fa-AF', divisor: 100, currency: 'afghani' },
  en: { tag: 'en', divisor: 100, currency: 'afghani' },
} as const

export const demoLocale = (locale: string): DemoLocale =>
  locale === 'af' || locale === 'en' ? locale : 'fa'

/** Which `landing.journey.currency.*` label goes beside an amount in this language. */
export const demoCurrency = (locale: string) => PRESENTATION[demoLocale(locale)].currency

/** An amount as this language's reader sees it: their digits, their unit. */
export function formatDemoAmount(base: number, locale: string): string {
  const { tag, divisor } = PRESENTATION[demoLocale(locale)]
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(base / divisor)
}

export function formatDemoCount(value: number, locale: string): string {
  return new Intl.NumberFormat(PRESENTATION[demoLocale(locale)].tag).format(value)
}
