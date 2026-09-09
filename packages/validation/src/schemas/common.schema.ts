// ============================================
// Common Schemas — Reusable Zod validators
// ============================================

import { z } from 'zod'

// ============================================
// Primitives
// ============================================

/** Valid UUID v4 */
export const uuidSchema = z.string().uuid()

/** Valid email */
export const emailSchema = z
  .string()
  .email('validation.email')
  .min(5, 'validation.minLength')
  .max(255, 'validation.maxLength')

/**
 * Valid phone number (international, loose format) — اختیاری و رشته خالی هم قبول می‌شود
 * فرمت قابل قبول: + اختیاری در ابتدا، سپس ۸ تا ۱۵ رقم
 * مقدار قبول‌شده: undefined، '' یا شماره معتبر
 */
export const phoneSchema = z
  .string()
  .optional()
  .refine((val) => !val || val === '' || /^[\d\s\-\+\(\)]{5,20}$/.test(val), {
    message: 'validation.phone',
  })

/** Positive number */
export const positiveNumberSchema = z.number().positive('validation.positiveNumber')

/** Non-negative number (includes zero) */
export const nonNegativeNumberSchema = z.number().min(0, 'validation.min')

/** Percentage (0-100) */
export const percentageSchema = z.number().min(0).max(100)

/** Valid date string (ISO) */
export const isoDateSchema = z.string().datetime()

/** Non-empty string */
export const nonEmptyStringSchema = z
  .string()
  .min(1, 'validation.required')
  .max(500, 'validation.maxLength')

/** Optional non-empty string */
export const optionalStringSchema = z
  .string()
  .max(500, 'validation.maxLength')
  .optional()
  .or(z.literal(''))

// ============================================
// Business-specific
// ============================================

/**
 * Currency codes supported.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THIS IS THE SINGLE SOURCE FOR THE LIST. `packages/store` imports it.
 *
 * It was four codes until the owner opened it (task T1). That was a deliberate
 * policy, not leftover hardcoding — `currency-policy.test.ts` pinned this exact
 * enum, and lesson 81 records why it held so long.
 *
 * It was opened because the business trades metals, `packages/ui-contract`
 * already catalogued 25 codes including the ISO 4217 metal codes, and
 * onboarding filtered all but four of them out. Rows added to the database
 * changed nothing: the filter was this list.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ADDING A CODE HERE IS NOT ENOUGH ON ITS OWN.
 *
 * `FRACTION_DIGITS` in @hisabche/formatting must gain it too, or money in that
 * currency formats with NO precision contract — §9 requires an unknown code to
 * resolve to `undefined` rather than borrow another currency's precision, so
 * the failure is a WRONG AMOUNT, not a missing option.
 *
 * `currency-policy.test.ts` enforces that the two lists agree. If it goes red
 * after a change here, extend the precision table — do not relax the test.
 */
export const CURRENCY_CODES = [
  // ─── Region ───
  'AFN',
  'IRT',
  'IRR',
  'PKR',
  'INR',
  'TRY',
  'AED',
  'SAR',
  'IQD',
  'TJS',
  'UZS',
  'TMT',
  'CNY',
  'RUB',
  // ─── Major ───
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  // ─── Precious metals (ISO 4217 X-codes), priced by weight ───
  'XAU',
  'XAG',
  'XPT',
  'XPD',
] as const

export const currencyCodeSchema = z.enum(CURRENCY_CODES)

/** Payment methods */
/**
 * How money moved.
 *
 * ⚠️ `'other'` CARRIES ITS LABEL IN A SIBLING FIELD — the same shape `unit`
 * uses for `'custom'`, and for the same reason. Making this free text would
 * mean «چک», «چک بانکی» and «Cheque» are three different payment methods to
 * every report that groups by it. Keeping the enum closed and putting the
 * typed name in `paymentMethodLabel` lets a shop write whatever it settles in
 * while «other» stays one bucket that can be counted.
 *
 * Safe to add without a migration: `invoices.payment_method` is a plain `text`
 * column with no CHECK constraint (see `docs/base-schema-migration.sql`).
 */
export const paymentMethodSchema = z.enum(['cash', 'credit', 'bank', 'mobile_money', 'other'])

export type PaymentMethod = z.infer<typeof paymentMethodSchema>

/**
 * What the shop calls an `'other'` payment method — «چک», «کارت به کارت».
 *
 * Ignored for every other method: a label on `cash` would be a second name for
 * a thing that already has one.
 */
export const paymentMethodLabelSchema = z.string().trim().max(40).optional()

/** Transaction types */
export const transactionTypeSchema = z.enum(['sale', 'purchase', 'payment', 'receipt', 'return'])

/** Product categories */
export const productCategorySchema = z.enum([
  'general',
  'food',
  'electronics',
  'clothing',
  'construction',
  'medicine',
])

/** Product units */
/**
 * ⚠️ THIS LIST MIRRORS THE `units` TABLE (`phase-l-01`). A guard test compares
 * them, and `GET /api/units` is what the UI actually renders.
 *
 * It was nine codes while the table held fourteen — so `ton`, `mg`, `cm`,
 * `km`, `ml` and `dozen` were seeded, ran, and were then rejected by
 * validation. A metals trader could not record a tonne, which is precisely
 * what L0.2 was asked for. Rows in the database changed nothing because the
 * filter was here (task T2 — the same shape as the currency defect in T1).
 *
 * ADDITIVE: every previously valid unit is still valid, so existing products
 * and invoices keep validating unchanged.
 *
 * ⚠️ ADDING A CODE HERE IS NOT ENOUGH. It must exist in `units` with a
 * dimension and a conversion factor, or L1 has nothing to convert by.
 */
export const unitSchema = z.enum([
  // ─── weight ───
  'mg',
  'gram',
  'kg',
  'ton',
  // ─── length ───
  'cm',
  'meter',
  'km',
  // ─── volume ───
  'ml',
  'liter',
  // ─── count ───
  'piece',
  'box',
  'pack',
  'carton',
  'dozen',
  /**
   * User-defined. The label the user typed lives in the sibling `unitLabel`
   * field. Kept as an enum member rather than making `unit` free text so
   * grouping, filtering and reporting by unit still work — every custom unit
   * aggregates under 'custom' and carries its own label for display.
   *
   * Deliberately NOT a row in `units`: it has no dimension and no conversion
   * factor, and inventing one would let the converter use it.
   */
  'custom',
])

/** Free-text label, only meaningful when `unit === 'custom'`. */
export const unitLabelSchema = z.string().trim().min(1).max(24)

/** Sort direction */
export const sortDirectionSchema = z.enum(['asc', 'desc'])

// ============================================
// Pagination
// ============================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortDirection: sortDirectionSchema.optional().default('desc'),
})

export type Pagination = z.infer<typeof paginationSchema>

// ============================================
// Address
// ============================================

export const addressSchema = z.object({
  street: optionalStringSchema,
  city: optionalStringSchema,
  province: optionalStringSchema,
  country: z.string().default('Afghanistan'),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
})

export type Address = z.infer<typeof addressSchema>
