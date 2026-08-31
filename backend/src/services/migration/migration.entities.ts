// ============================================
// backend/src/services/migration/migration.entities.ts
//
// What a source column may become, how a source column is GUESSED, and what
// makes two rows the same business object.
//
// ---------------------------------------------------------------------------
// THE FIELD LIST IS NOT A WISHLIST
//
// Every target below exists on the real table that `customer.service.ts` and
// `product.service.ts` already write. The importer does not get its own
// column set, its own defaults, or its own idea of what a customer is —
// otherwise a customer created by import and one created by hand would be two
// different things, and every report downstream would have to know which.
//
// ---------------------------------------------------------------------------
// MAPPING IS A SUGGESTION; THE USER IS THE AUTHORITY
//
// `suggestMapping` scores; it never commits. Confidence is reported to the
// user and a low-confidence guess is shown as "needs review" rather than
// applied quietly. A wrong automatic mapping is worse than no mapping: it
// produces a clean-looking import of the wrong data.
// ============================================

import {
  comparisonKey,
  normalizeEmail,
  normalizePhone,
  type MigrationEntity,
} from './migration.domain'

export type FieldKind = 'text' | 'money' | 'number' | 'boolean' | 'phone' | 'email' | 'enum'

export interface FieldSpec {
  /** The name used in the mapping and in every report. */
  key: string
  kind: FieldKind
  required: boolean
  /** Header words that mean this field, already comparison-keyed. */
  aliases: string[]
  enumValues?: string[]
  maxLength?: number
}

/**
 * `type` on a customer decides whether an opening balance becomes a debt.
 * It is an enum rather than free text for exactly that reason — a typo of
 * "credit" would silently create a cash customer carrying a balance nobody
 * owes.
 */
const CUSTOMER_FIELDS: FieldSpec[] = [
  {
    key: 'fullName',
    kind: 'text',
    required: true,
    maxLength: 200,
    aliases: [
      'name',
      'fullname',
      'full name',
      'customer',
      'customer name',
      'client',
      'client name',
      'partner',
      'partner name',
      'نام',
      'نام مشتری',
      'مشتری',
      'اسم',
      'نام کامل',
    ],
  },
  {
    key: 'phone',
    kind: 'phone',
    required: false,
    maxLength: 40,
    aliases: [
      'phone',
      'mobile',
      'tel',
      'telephone',
      'phone number',
      'contact',
      'تلفن',
      'موبایل',
      'شماره',
      'شماره تماس',
    ],
  },
  {
    key: 'email',
    kind: 'email',
    required: false,
    maxLength: 200,
    aliases: ['email', 'e mail', 'mail', 'email address', 'ایمیل', 'پست الکترونیک'],
  },
  {
    key: 'address',
    kind: 'text',
    required: false,
    maxLength: 500,
    aliases: ['address', 'street', 'location', 'city', 'آدرس', 'نشانی', 'شهر'],
  },
  {
    key: 'notes',
    kind: 'text',
    required: false,
    maxLength: 1000,
    aliases: [
      'notes',
      'note',
      'comment',
      'comments',
      'remarks',
      'description',
      'یادداشت',
      'توضیحات',
    ],
  },
  {
    key: 'openingBalance',
    kind: 'money',
    required: false,
    aliases: [
      'opening balance',
      'balance',
      'due',
      'outstanding',
      'receivable',
      'debt',
      'مانده',
      'بدهی',
      'مانده اولیه',
      'باقیمانده',
    ],
  },
  {
    key: 'type',
    kind: 'enum',
    required: false,
    enumValues: ['cash', 'credit'],
    aliases: ['type', 'customer type', 'terms', 'نوع', 'نوع مشتری'],
  },
  {
    key: 'externalId',
    kind: 'text',
    required: false,
    maxLength: 120,
    aliases: [
      'id',
      'code',
      'ref',
      'reference',
      'customer code',
      'cust code',
      'external id',
      'کد',
      'کد مشتری',
      'شناسه',
    ],
  },
]

const PRODUCT_FIELDS: FieldSpec[] = [
  {
    key: 'name',
    kind: 'text',
    required: true,
    maxLength: 200,
    aliases: [
      'name',
      'product',
      'product name',
      'item',
      'item name',
      'title',
      'description',
      'نام',
      'نام کالا',
      'کالا',
      'محصول',
      'شرح کالا',
    ],
  },
  {
    key: 'sku',
    kind: 'text',
    required: false,
    maxLength: 120,
    aliases: ['sku', 'code', 'item code', 'product code', 'reference', 'ref', 'کد', 'کد کالا'],
  },
  {
    key: 'barcode',
    kind: 'text',
    required: false,
    maxLength: 120,
    aliases: ['barcode', 'ean', 'upc', 'gtin', 'بارکد'],
  },
  {
    key: 'category',
    kind: 'text',
    required: false,
    maxLength: 120,
    aliases: ['category', 'group', 'product group', 'type', 'دسته', 'گروه', 'دسته بندی'],
  },
  {
    key: 'unit',
    kind: 'text',
    required: false,
    maxLength: 40,
    aliases: ['unit', 'uom', 'unit of measure', 'measure', 'واحد'],
  },
  {
    key: 'quantity',
    kind: 'number',
    required: false,
    aliases: ['quantity', 'qty', 'stock', 'on hand', 'available', 'موجودی', 'تعداد', 'مقدار'],
  },
  {
    key: 'buyPrice',
    kind: 'money',
    required: false,
    aliases: [
      'buy price',
      'cost',
      'cost price',
      'purchase price',
      'unit cost',
      'قیمت خرید',
      'بهای تمام شده',
      'قیمت تمام شده',
    ],
  },
  {
    key: 'sellPrice',
    kind: 'money',
    required: false,
    aliases: [
      'sell price',
      'price',
      'sale price',
      'selling price',
      'unit price',
      'list price',
      'retail',
      'قیمت',
      'قیمت فروش',
    ],
  },
  {
    key: 'wholesalePrice',
    kind: 'money',
    required: false,
    aliases: ['wholesale', 'wholesale price', 'bulk price', 'قیمت عمده', 'عمده'],
  },
  {
    key: 'minStockLevel',
    kind: 'number',
    required: false,
    aliases: [
      'min stock',
      'minimum stock',
      'reorder level',
      'reorder point',
      'حداقل موجودی',
      'نقطه سفارش',
    ],
  },
  {
    key: 'externalId',
    kind: 'text',
    required: false,
    maxLength: 120,
    aliases: ['id', 'external id', 'source id', 'شناسه'],
  },
]

export const ENTITY_FIELDS: Record<MigrationEntity, FieldSpec[]> = {
  customer: CUSTOMER_FIELDS,
  product: PRODUCT_FIELDS,
}

/* ─── Guessing the mapping ────────────────────────────────────────────────── */

export type MappingStatus = 'matched' | 'needs_review' | 'unsupported'

export interface MappingSuggestion {
  sourceHeader: string
  /** null means "this column has no home", which is a legitimate answer. */
  targetField: string | null
  confidence: number
  status: MappingStatus
}

/**
 * Confidence is deliberately coarse: exact, contained, or nothing.
 *
 * A fuzzy edit-distance score would map `price` to `buyPrice` at 0.8 and look
 * authoritative while being wrong half the time. Two bands are honest about
 * how much a header name can actually tell you.
 *
 * `specificity` is the length of the alias that matched, and it settles ties.
 * Without it, a file with both `price` and `sell price` gives `sellPrice` to
 * whichever column happens to come first — so the more informative header
 * loses to the vaguer one purely by position.
 */
function scoreHeader(header: string, spec: FieldSpec): { score: number; specificity: number } {
  const key = comparisonKey(header)
  const none = { score: 0, specificity: 0 }
  if (key === '') return none

  const candidates = [comparisonKey(spec.key), ...spec.aliases.map(comparisonKey)]

  let best = none
  for (const alias of candidates) {
    if (alias === '') continue

    if (alias === key) {
      if (alias.length > best.specificity) best = { score: 1, specificity: alias.length }
      continue
    }

    // Containment must land on WORD boundaries. Plain `includes` lets the
    // alias `customer` claim `customer_phone_number`, which is how an
    // importer quietly files every phone number under the customer's name.
    const padded = ` ${key} `
    const contained = alias.length >= 3 && padded.includes(` ${alias} `)
    if (!contained) continue

    // Scored lower than an exact hit because it also fires on `old phone`,
    // which the user must confirm.
    if (best.score < 1 && alias.length > best.specificity) {
      best = { score: 0.6, specificity: alias.length }
    }
  }

  return best
}

export function suggestMapping(entity: MigrationEntity, headers: string[]): MappingSuggestion[] {
  const specs = ENTITY_FIELDS[entity]
  const taken = new Set<string>()
  const scored: Array<{ header: string; field: string; score: number; specificity: number }> = []

  for (const header of headers) {
    for (const spec of specs) {
      const hit = scoreHeader(header, spec)
      if (hit.score > 0) scored.push({ header, field: spec.key, ...hit })
    }
  }

  // Best score first, then the most specific alias, so `price` does not claim
  // `sellPrice` while an exact `sell price` column is still waiting for it.
  // One field, one column — and the vaguer header is left unmapped for the
  // user to decide rather than being given a field it may not mean.
  scored.sort((left, right) => right.score - left.score || right.specificity - left.specificity)

  const chosen = new Map<string, { field: string; score: number }>()
  for (const candidate of scored) {
    if (chosen.has(candidate.header) || taken.has(candidate.field)) continue
    chosen.set(candidate.header, { field: candidate.field, score: candidate.score })
    taken.add(candidate.field)
  }

  return headers.map((header) => {
    const hit = chosen.get(header)
    if (!hit) {
      return {
        sourceHeader: header,
        targetField: null,
        confidence: 0,
        status: 'unsupported' as const,
      }
    }
    return {
      sourceHeader: header,
      targetField: hit.field,
      confidence: hit.score,
      status: (hit.score >= 1 ? 'matched' : 'needs_review') as MappingStatus,
    }
  })
}

/* ─── Guessing where the file came from ───────────────────────────────────── */

export interface SourceGuess {
  system: 'odoo' | 'erpnext' | 'quickbooks' | 'generic_spreadsheet'
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

/**
 * Detection by FINGERPRINT COLUMNS, not by vibes.
 *
 * Each system writes header names no other system writes. When none of them
 * appear the answer is `generic_spreadsheet` at low confidence, which is the
 * truthful answer — the roadmap forbids claiming a source on weak evidence,
 * and the only cost of admitting ignorance is that the user picks a mapping
 * themselves.
 */
const FINGERPRINTS: Array<{ system: SourceGuess['system']; markers: string[] }> = [
  { system: 'odoo', markers: ['external id', 'display name', 'customer rank', 'x studio'] },
  { system: 'erpnext', markers: ['naming series', 'docstatus', 'idx', 'modified by'] },
  {
    system: 'quickbooks',
    markers: ['bill with parent', 'qb id', 'terms code', 'preferred delivery method'],
  },
]

export function detectSource(headers: string[]): SourceGuess {
  const keys = headers.map(comparisonKey)

  for (const print of FINGERPRINTS) {
    const evidence = print.markers.filter((marker) =>
      keys.some((key) => key === comparisonKey(marker) || key.includes(comparisonKey(marker))),
    )
    if (evidence.length >= 2) return { system: print.system, confidence: 'high', evidence }
    if (evidence.length === 1) return { system: print.system, confidence: 'medium', evidence }
  }

  return { system: 'generic_spreadsheet', confidence: 'low', evidence: [] }
}

/* ─── What makes two rows the same object ─────────────────────────────────── */

/**
 * Business keys, most specific first.
 *
 * An external id from the source is the strongest signal and the only one that
 * survives a re-run of the same file — that is what makes the import
 * idempotent. Phone is next: two customer rows with one phone number are one
 * shopkeeper's customer written twice. A normalised name alone is the weakest
 * and is reported as a CANDIDATE for the user, never merged automatically.
 */
export function businessKeys(
  entity: MigrationEntity,
  values: Record<string, string>,
): Array<{ kind: string; key: string; strength: 'strong' | 'weak' }> {
  const keys: Array<{ kind: string; key: string; strength: 'strong' | 'weak' }> = []
  const push = (kind: string, raw: string | undefined, strength: 'strong' | 'weak') => {
    const value = (raw ?? '').trim()
    if (value !== '') keys.push({ kind, key: `${kind}:${value}`, strength })
  }

  push('external', values['externalId'] ? comparisonKey(values['externalId']) : '', 'strong')

  if (entity === 'customer') {
    push('phone', normalizePhone(values['phone'] ?? ''), 'strong')
    push('email', normalizeEmail(values['email'] ?? ''), 'strong')
    push('name', comparisonKey(values['fullName'] ?? ''), 'weak')
  } else {
    push('sku', comparisonKey(values['sku'] ?? ''), 'strong')
    push('barcode', comparisonKey(values['barcode'] ?? ''), 'strong')
    push('name', comparisonKey(values['name'] ?? ''), 'weak')
  }

  return keys
}
