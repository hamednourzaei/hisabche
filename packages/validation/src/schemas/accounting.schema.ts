// ============================================
// packages/validation/src/schemas/accounting.schema.ts
// ============================================

import { z } from 'zod'
import { 
  uuidSchema, 
  nonEmptyStringSchema, 
  optionalStringSchema, 
  isoDateSchema,
  nonNegativeNumberSchema,
  positiveNumberSchema
} from './common.schema'

// ============================================
// Account (Chart of Accounts)
// ============================================

export const accountSchema = z.object({
  id: uuidSchema.optional(),
  code: z.string().min(1).max(20),
  name: nonEmptyStringSchema,
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentId: uuidSchema.optional(),
  isActive: z.boolean().default(true),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Account = z.infer<typeof accountSchema>

export const createAccountSchema = accountSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateAccount = z.infer<typeof createAccountSchema>

export const updateAccountSchema = accountSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateAccount = z.infer<typeof updateAccountSchema>

// ============================================
// Journal Entry
// ============================================

export const journalLineSchema = z.object({
  accountId: uuidSchema,
  debit: nonNegativeNumberSchema.default(0),
  credit: nonNegativeNumberSchema.default(0),
})

export type JournalLine = z.infer<typeof journalLineSchema>

export const journalEntrySchema = z.object({
  id: uuidSchema.optional(),
  date: isoDateSchema,
  description: optionalStringSchema,
  reference: optionalStringSchema,
  lines: z.array(journalLineSchema).min(1, 'At least one line is required'),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type JournalEntry = z.infer<typeof journalEntrySchema>

export const createJournalEntrySchema = journalEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateJournalEntry = z.infer<typeof createJournalEntrySchema>

// ============================================
// Financial Reports
// ============================================

export const trialBalanceSchema = z.object({
  accountId: uuidSchema,
  accountCode: z.string(),
  accountName: z.string(),
  debit: z.number(),
  credit: z.number(),
  balance: z.number(),
})

export type TrialBalance = z.infer<typeof trialBalanceSchema>

export const balanceSheetSchema = z.object({
  assets: z.array(z.any()),
  liabilities: z.array(z.any()),
  equity: z.array(z.any()),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  totalEquity: z.number(),
})

export type BalanceSheet = z.infer<typeof balanceSheetSchema>

export const incomeStatementSchema = z.object({
  revenue: z.array(z.any()),
  expenses: z.array(z.any()),
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  netIncome: z.number(),
})

export type IncomeStatement = z.infer<typeof incomeStatementSchema>