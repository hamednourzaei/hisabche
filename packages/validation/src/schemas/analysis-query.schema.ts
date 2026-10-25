// ============================================
// packages/validation/src/schemas/analysis-query.schema.ts
//
// What the analysis endpoints accept in their query string — one schema for the
// server routes and the device, so a range or a currency means the same thing in
// both.
// ============================================

import { z } from 'zod'
import { currencyCodeSchema } from './common.schema'

export const analysisIsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const analysisRangeMessage = 'analysis.errors.range'

export const workingCapitalQuerySchema = z
  .object({ from: analysisIsoDay, to: analysisIsoDay, currency: currencyCodeSchema })
  .refine((value) => value.from <= value.to, { message: analysisRangeMessage })

export const breakEvenQuerySchema = z
  .object({
    from: analysisIsoDay,
    to: analysisIsoDay,
    currency: currencyCodeSchema,
    // Absent = not stated. The result is then a lower bound and says so; an
    // absent figure is never read as zero.
    otherFixedCosts: z.coerce.number().min(0).optional(),
  })
  .refine((value) => value.from <= value.to, { message: analysisRangeMessage })
