import { z } from 'zod'
import {
  uuidSchema,
  currencyCodeSchema,
  transactionTypeSchema,
  positiveNumberSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

export const transactionSchema = z.object({
  id: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  type: transactionTypeSchema,
  amount: positiveNumberSchema,
  // ⚠️ NO DEFAULT. A document that names no currency is in the currency the
  // business keeps its books in, and only the server knows which that is
  // (services/base-currency.ts). A default here stamped 'AFN' on the body
  // before the service ever saw that none had been chosen.
  currency: currencyCodeSchema.optional(),
  description: optionalStringSchema,
  reference: optionalStringSchema,
  date: isoDateSchema,
  createdAt: isoDateSchema.optional(),
  syncedAt: isoDateSchema.optional(),
})

export type Transaction = z.infer<typeof transactionSchema>

export const createTransactionSchema = transactionSchema.omit({
  id: true,
  createdAt: true,
  syncedAt: true,
})

export type CreateTransaction = z.infer<typeof createTransactionSchema>

// ============================================
// Transaction Filters — اضافه کردن cursor
// ============================================

export const transactionFiltersSchema = z.object({
  search: z.string().optional(),
  type: transactionTypeSchema.optional(),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  currency: currencyCodeSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  page: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .optional(),
  limit: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .default(20),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  // ✅ اضافه شد
  cursor: z.string().optional(),
})

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>
export const ledgerSummarySchema = z.object({
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  openingBalance: z.number(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  closingBalance: z.number(),
})

export type LedgerSummary = z.infer<typeof ledgerSummarySchema>
