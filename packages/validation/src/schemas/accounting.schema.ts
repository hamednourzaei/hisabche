// ============================================
// packages/validation/src/schemas/accounting.schema.ts
//
// The shapes the ledger accepts from the outside. The RULES that make an entry
// postable (balance, one-sided lines, a postable account, an open period) live
// with the ledger itself in backend/src/services/accounting — a Zod schema
// cannot see the chart of accounts, and a rule that is only enforced at the
// edge is a rule the invoice poster can walk around.
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
  nonNegativeNumberSchema,
} from './common.schema'

// ============================================
// Account (Chart of Accounts)
// ============================================

/** Where the account sits in the statements. */
export const accountRootTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

/**
 * What the system may DO with the account.
 *
 * Root type places an account in the balance sheet or the P&L; the role is how
 * automatic posting finds it. Before this existed, the invoice poster looked
 * up the literal codes '1000', '1200', '2000', '4000' and '5000', so a
 * business that numbered its books differently silently got no entries at all.
 */
export const accountRoles = [
  'bank',
  'cash',
  'receivable',
  'payable',
  'tax',
  'inventory',
  'cogs',
  'sales',
  'purchase',
  'retained_earnings',
  'current_year_earnings',
] as const

export type AccountRole = (typeof accountRoles)[number]

export const accountSchema = z.object({
  id: uuidSchema.optional(),
  code: z.string().min(1).max(20),
  name: nonEmptyStringSchema,
  type: z.enum(accountRootTypes),
  role: z.enum(accountRoles).nullish(),
  parentId: uuidSchema.nullish(),
  /** A group organises the tree and can never carry a posting of its own. */
  isGroup: z.boolean().default(false),
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

/**
 * `draft` is invisible to every report; `posted` is the ledger and is
 * immutable; `reversed` is a posted entry that a later reversing entry has
 * cancelled out — it stays in the ledger, because history is not deleted;
 * `cancelled` is only ever a draft that was thrown away before posting.
 */
export const journalEntryStatuses = ['draft', 'posted', 'reversed', 'cancelled'] as const
export type JournalEntryStatus = (typeof journalEntryStatuses)[number]

export const journalLineSchema = z
  .object({
    accountId: uuidSchema,
    debit: nonNegativeNumberSchema.default(0),
    credit: nonNegativeNumberSchema.default(0),
    description: optionalStringSchema,
  })
  .refine((line) => line.debit > 0 !== line.credit > 0, {
    message: 'A line is either a debit or a credit, never both and never neither',
    path: ['debit'],
  })

export type JournalLine = z.infer<typeof journalLineSchema>

export const journalEntrySchema = z.object({
  id: uuidSchema.optional(),
  /** The ACCOUNTING date. Reports are cut by this, never by created_at. */
  date: isoDateSchema,
  description: optionalStringSchema,
  reference: optionalStringSchema,
  lines: z.array(journalLineSchema).min(2, 'A journal entry needs at least two lines'),
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

/** A posted entry is never edited. It is reversed, on a date of its own. */
export const reverseJournalEntrySchema = z.object({
  date: isoDateSchema.optional(),
  reason: z.string().min(1).max(500),
})

export type ReverseJournalEntry = z.infer<typeof reverseJournalEntrySchema>

/** Odoo's lock date, kept as one open boundary per workspace. */
export const periodLockSchema = z.object({
  lockedUntil: isoDateSchema,
  reason: optionalStringSchema,
})

export type PeriodLock = z.infer<typeof periodLockSchema>

// ============================================
// Financial Reports
// ============================================

export const trialBalanceRowSchema = z.object({
  accountId: uuidSchema,
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.enum(accountRootTypes),
  debit: z.number(),
  credit: z.number(),
  /** Signed on the account's natural side: positive means a normal balance. */
  balance: z.number(),
})

export type TrialBalanceRow = z.infer<typeof trialBalanceRowSchema>

/** Kept as an alias: `TrialBalance` was the row type before this file changed. */
export const trialBalanceSchema = trialBalanceRowSchema
export type TrialBalance = TrialBalanceRow

export const balanceSheetSchema = z.object({
  asOf: z.string(),
  assets: z.array(trialBalanceRowSchema),
  liabilities: z.array(trialBalanceRowSchema),
  equity: z.array(trialBalanceRowSchema),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  totalEquity: z.number(),
  /** Revenue less expenses for the period. Equity, not a balance sheet line. */
  currentYearEarnings: z.number(),
  /** assets − (liabilities + equity). Anything but 0 is a bug, not a figure. */
  outOfBalanceBy: z.number(),
})

export type BalanceSheet = z.infer<typeof balanceSheetSchema>

export const incomeStatementSchema = z.object({
  fromDate: z.string(),
  toDate: z.string(),
  revenue: z.array(trialBalanceRowSchema),
  expenses: z.array(trialBalanceRowSchema),
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  netIncome: z.number(),
})

export type IncomeStatement = z.infer<typeof incomeStatementSchema>
