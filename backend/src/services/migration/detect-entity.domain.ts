// ============================================
// backend/src/services/migration/detect-entity.domain.ts
//
// «What is in this file?» — answered from the file, so the person does not
// have to say whether they are importing customers, products or invoices.
//
// ---------------------------------------------------------------------------
// HOW IT DECIDES
//
// Two kinds of evidence, both written down in the answer:
//
//   • what the columns are CALLED (in Persian, Dari and English), and
//   • what the columns HOLD — a column of phone numbers is a list of people
//     whatever its header says, and a column of dates beside a column of
//     amounts is a list of documents.
//
// ---------------------------------------------------------------------------
// WHEN IT DOES NOT KNOW, IT SAYS SO
//
// A guess that is wrong imports four thousand customers as products. So the
// answer carries a confidence, and below `medium` the entity is `null`: the
// caller asks the person instead. A second kind close behind the first also
// lowers the confidence — «could be either» is not «is the first one».
//
// Pure: headers and sample rows in, a verdict out.
// ============================================

import { comparisonKey, normalizePhone, parseDateIso, parseMoneyMinor } from './migration.domain'

export const DETECTABLE_ENTITIES = ['customer', 'product', 'invoice'] as const
export type DetectableEntity = (typeof DETECTABLE_ENTITIES)[number]

export interface EntityDetection {
  /** null = not sure enough to choose; the person is asked. */
  entity: DetectableEntity | null
  confidence: 'high' | 'medium' | 'low'
  scores: Record<DetectableEntity, number>
  /** The headers (as written in the file) that counted, per kind. */
  evidence: Record<DetectableEntity, string[]>
}

interface Signal {
  entity: DetectableEntity
  weight: number
  /** Matched against the normalised header: equal to it, or contained in it. */
  words: string[]
}

// Weights: 3 = says it outright, 2 = strong, 1 = fits but proves little.
const SIGNALS: Signal[] = [
  // ── A document ──
  {
    entity: 'invoice',
    weight: 3,
    words: [
      'شماره فاکتور',
      'شماره فاکتور فروش',
      'شماره سند',
      'شماره بل',
      'نمبر بل',
      'نمبر فاکتور',
      'invoice number',
      'invoice no',
      'invoice #',
      'invoice id',
      'bill number',
      'bill no',
      'receipt no',
    ],
  },
  {
    entity: 'invoice',
    weight: 2,
    words: [
      'تاریخ فاکتور',
      'تاریخ فروش',
      'تاریخ خرید',
      'تاریخ سررسید',
      'invoice date',
      'due date',
      'مبلغ کل',
      'جمع کل',
      'مجموع',
      'قابل پرداخت',
      'پرداخت شده',
      'مبلغ پرداختی',
      'باقی مانده',
      'grand total',
      'total amount',
      'amount paid',
      'amount due',
      'subtotal',
    ],
  },
  {
    entity: 'invoice',
    weight: 1,
    words: ['تخفیف', 'مالیات', 'فی', 'نرخ', 'discount', 'tax', 'vat', 'unit price', 'rate'],
  },

  // ── A person or a company ──
  {
    entity: 'customer',
    weight: 3,
    words: [
      'نام مشتری',
      'نام و نام خانوادگی',
      'نام خانوادگی',
      'نام طرف حساب',
      'تخلص',
      'customer name',
      'full name',
      'first name',
      'last name',
      'contact name',
    ],
  },
  {
    entity: 'customer',
    weight: 2,
    words: [
      'تلفن',
      'موبایل',
      'همراه',
      'شماره تماس',
      'نمبر تماس',
      'شماره تلفن',
      'ایمیل',
      'آدرس',
      'نشانی',
      'phone',
      'mobile',
      'email',
      'e-mail',
      'address',
    ],
  },
  {
    entity: 'customer',
    weight: 1,
    words: ['مانده حساب', 'بدهی', 'طلب', 'شهر', 'opening balance', 'balance', 'city'],
  },

  // ── A thing on a shelf ──
  {
    entity: 'product',
    weight: 3,
    words: [
      'نام کالا',
      'نام محصول',
      'نام جنس',
      'کد کالا',
      'بارکد',
      'barcode',
      'sku',
      'product name',
      'item name',
      'item code',
    ],
  },
  {
    entity: 'product',
    weight: 2,
    words: [
      'موجودی',
      'قیمت خرید',
      'قیمت فروش',
      'قیمت عمده',
      'حداقل موجودی',
      'دسته بندی',
      'stock',
      'on hand',
      'buy price',
      'cost price',
      'sell price',
      'sale price',
      'wholesale price',
      'category',
    ],
  },
  { entity: 'product', weight: 1, words: ['واحد', 'برند', 'unit', 'brand'] },
]

const KEYED = SIGNALS.map((signal) => ({
  ...signal,
  keys: signal.words.map(comparisonKey),
}))

/** Whole-word containment, so «unit» does not match «community». */
function names(header: string, word: string): boolean {
  if (header === word) return true
  return ` ${header} `.includes(` ${word} `)
}

/** The share of a column's non-empty sample cells that pass a test. */
function share(
  rows: readonly (readonly string[])[],
  column: number,
  test: (cell: string) => boolean,
) {
  let filled = 0
  let passed = 0
  for (const row of rows) {
    const cell = (row[column] ?? '').trim()
    if (cell === '') continue
    filled++
    if (test(cell)) passed++
  }
  return filled >= 3 ? passed / filled : 0
}

const looksLikePhone = (cell: string): boolean => {
  const digits = normalizePhone(cell).replace(/\D/g, '')
  return /^[+0-9۰-۹٠-٩\s()-]+$/.test(cell) && digits.length >= 9 && digits.length <= 13
}
const looksLikeEmail = (cell: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)
const looksLikeDate = (cell: string): boolean => {
  const parsed = parseDateIso(cell)
  return parsed.ok || parsed.reason === 'AMBIGUOUS_ORDER'
}
const looksLikeMoney = (cell: string): boolean => parseMoneyMinor(cell).ok === true

/** Rows looked at for what the columns hold. Enough to see a pattern; cheap. */
const SAMPLE = 50

export function detectEntity(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): EntityDetection {
  const scores: Record<DetectableEntity, number> = { customer: 0, product: 0, invoice: 0 }
  const evidence: Record<DetectableEntity, string[]> = { customer: [], product: [], invoice: [] }
  const add = (entity: DetectableEntity, weight: number, header: string) => {
    scores[entity] += weight
    if (!evidence[entity].includes(header)) evidence[entity].push(header)
  }

  // ── What the columns are called ──
  for (const header of headers) {
    const key = comparisonKey(header)
    if (key === '') continue
    for (const kind of DETECTABLE_ENTITIES) {
      // The strongest signal a header gives for a kind counts once.
      const best = KEYED.filter(
        (signal) => signal.entity === kind && signal.keys.some((word) => names(key, word)),
      ).reduce((max, signal) => Math.max(max, signal.weight), 0)
      if (best > 0) add(kind, best, header)
    }
  }

  // ── What the columns hold ──
  const sample = rows.slice(0, SAMPLE)
  let dateColumn = false
  let moneyColumn = false
  for (let column = 0; column < headers.length; column++) {
    const header = headers[column] ?? ''
    if (share(sample, column, looksLikePhone) >= 0.8) add('customer', 2, header)
    else if (share(sample, column, looksLikeEmail) >= 0.8) add('customer', 2, header)
    else if (share(sample, column, looksLikeDate) >= 0.8) dateColumn = true
    else if (share(sample, column, looksLikeMoney) >= 0.8) moneyColumn = true
  }
  // A date beside an amount is what a list of documents looks like. A date on
  // its own is not: customers have a «joined on», products an expiry.
  if (dateColumn && moneyColumn) {
    scores.invoice += 2
    evidence.invoice.push('date + amount columns')
  }

  const ranked = [...DETECTABLE_ENTITIES].sort((a, b) => scores[b] - scores[a])
  const first = ranked[0] as DetectableEntity
  const top = scores[first]
  const gap = top - scores[ranked[1] as DetectableEntity]

  const confidence: EntityDetection['confidence'] =
    top >= 5 && gap >= 3 ? 'high' : top >= 3 && gap >= 2 ? 'medium' : 'low'

  return { entity: confidence === 'low' ? null : first, confidence, scores, evidence }
}
