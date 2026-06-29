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

/** Valid phone number (Afghanistan format) — اکنون اختیاری */
export const phoneSchema = z
  .string()
  .regex(/^(\+93|0)?[7]\d{8}$/, 'validation.phone')
  .transform((val) => val.replace(/^0/, '+93'))
  .optional() // ✅ اختیاری

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

/** Currency codes supported */
export const currencyCodeSchema = z.enum(['AFN', 'USD', 'PKR', 'IRR'])

/** Payment methods */
export const paymentMethodSchema = z.enum(['cash', 'credit', 'bank', 'mobile_money'])

/** Transaction types */
export const transactionTypeSchema = z.enum([
  'sale',
  'purchase',
  'payment',
  'receipt',
  'return',
])

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
export const unitSchema = z.enum(['piece', 'kg', 'meter', 'liter', 'box', 'pack'])

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