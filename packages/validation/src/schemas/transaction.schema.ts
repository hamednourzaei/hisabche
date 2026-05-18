import { z } from 'zod'
import { uuidSchema, currencyCodeSchema, transactionTypeSchema, positiveNumberSchema, optionalStringSchema, isoDateSchema, paginationSchema } from './common.schema'

export const transactionSchema = z.object({
  id: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  type: transactionTypeSchema,
  amount: positiveNumberSchema,
  currency: currencyCodeSchema.default('AFN'),
  description: optionalStringSchema,
  reference: optionalStringSchema,
  date: isoDateSchema,
  createdAt: isoDateSchema.optional(),
  syncedAt: isoDateSchema.optional(),
})

export type Transaction = z.infer<typeof transactionSchema>

export const createTransactionSchema = transactionSchema.omit({ id: true, createdAt: true, syncedAt: true })
export type CreateTransaction = z.infer<typeof createTransactionSchema>

export const transactionFiltersSchema = z.object({
  search: z.string().optional(),
  type: transactionTypeSchema.optional(),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  currency: currencyCodeSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  ...paginationSchema.shape,
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