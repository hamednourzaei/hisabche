// ============================================
// packages/validation/src/schemas/budget-bodies.ts
//
// The request bodies and queries of the budgets endpoints — one definition for
// the server's routes (backend/src/routes/operations.routes.ts) and the offline
// engine's, so a body the server accepts is a body the device accepts.
// ============================================

import { z } from 'zod'
import { currencyCodeSchema } from './common.schema'

export const budgetBodySchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  dimensionValueId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  period: z.enum(['monthly', 'quarterly', 'yearly']),
  startsOn: z.string().min(8),
  amountMinor: z.number().int().min(0),
  action: z.enum(['block', 'warn', 'approval', 'track']),
  warnAtPercent: z.number().int().min(0).max(100).default(80),
  isActive: z.boolean().default(true),
  name: z.string().trim().max(120).nullable().optional(),
  type: z.enum(['expense', 'revenue']).default('expense'),
  /**
   * The currency the amount is entered in; converted to the books currency.
   * ⚠️ NO DEFAULT HERE: none named = the books currency, decided by whoever
   * saves (the server's, or the device's own). A default of one currency would
   * make every other business's omitted currency a foreign one.
   */
  currency: currencyCodeSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** Basis points per sub-period, summing to 10 000. */
  distributionWeightsBp: z.array(z.number().int().min(0).max(10_000)).max(12).nullable().optional(),
  /** Explicit minor units per sub-period, summing to amountMinor. */
  distributionMinor: z.array(z.number().int().min(0)).max(12).nullable().optional(),
})

export const reviseBudgetBodySchema = z.object({
  expectedVersion: z.number().int().min(1),
  amountMinor: z.number().int().min(0),
  distributionMinor: z.array(z.number().int().min(0)).max(12).nullable().optional(),
  action: z.enum(['block', 'warn', 'approval', 'track']).optional(),
  warnAtPercent: z.number().int().min(0).max(100).optional(),
  reason: z.string().trim().min(3).max(1000),
})

export const budgetReportQuerySchema = z.object({
  onDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: z.enum(['expense', 'revenue']).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'archived']).optional(),
  branchId: z.string().uuid().optional(),
})

export const checkBudgetSpendBodySchema = z.object({
  accountId: z.string().uuid(),
  dimensionValueId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int(),
  onDate: z.string().min(8),
})

export const approveBudgetBodySchema = z.object({
  override: z.object({ reason: z.string().trim().min(3).max(500) }).optional(),
})
