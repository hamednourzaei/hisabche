// ============================================
// packages/validation/src/schemas/crm.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  isoDateSchema,
  nonNegativeNumberSchema,
} from './common.schema'

// ============================================
// Interaction (تعامل با مشتری)
// ============================================

export const interactionSchema = z.object({
  id: uuidSchema.optional(),
  customerId: uuidSchema,
  customerIds: z.array(uuidSchema).min(1).optional(),
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: optionalStringSchema,
  content: optionalStringSchema,
  interactionDate: isoDateSchema.default(() => new Date().toISOString()),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  employeeId: uuidSchema.optional(),
  employeeName: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
})

export type Interaction = z.infer<typeof interactionSchema>

export const createInteractionSchema = interactionSchema.omit({
  id: true,
  createdAt: true,
  status: true,
})

export type CreateInteraction = z.infer<typeof createInteractionSchema>

export const updateInteractionStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']),
  /**
   * Who the task belongs to from now on (request #98).
   *
   * Optional: «تغییر دستی وضعیت» is usually just a status. When the owner also
   * names somebody, the task moves to them in the same write — two requests
   * could leave the task reassigned with the old status, or the reverse.
   */
  employeeId: uuidSchema.optional(),
  employeeName: z.string().max(200).optional(),
})

export type UpdateInteractionStatus = z.infer<typeof updateInteractionStatusSchema>

export const publicUpdateTaskStatusSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
})

export type PublicUpdateTaskStatus = z.infer<typeof publicUpdateTaskStatusSchema>

/**
 * The result of contacting one customer on a task.
 *
 * A ❌ must carry a reason — that note is the only thing the task's creator has
 * to act on, so the schema refuses a failure without one rather than leaving
 * the check to the UI.
 */
export const recordCustomerOutcomeSchema = z
  .object({
    customerId: z.string().uuid(),
    outcome: z.enum(['done', 'failed']),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.outcome !== 'failed' || Boolean(value.note?.trim()), {
    message: 'A note is required when marking a customer as failed',
    path: ['note'],
  })

export type RecordCustomerOutcome = z.infer<typeof recordCustomerOutcomeSchema>

/** One recorded result, as stored in `interactions.customer_outcomes`. */
export const customerOutcomeSchema = z.object({
  customerId: z.string(),
  outcome: z.enum(['done', 'failed']),
  recordedAt: z.string(),
  recordedBy: z.enum(['owner', 'employee']),
  note: z.string().optional(),
})

export type CustomerOutcome = z.infer<typeof customerOutcomeSchema>

// ============================================
// Opportunity (فرصت فروش)
// ============================================

export const opportunitySchema = z.object({
  id: uuidSchema.optional(),
  customerId: uuidSchema,
  title: nonEmptyStringSchema,
  description: optionalStringSchema,
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
  value: nonNegativeNumberSchema.default(0),
  expectedCloseDate: isoDateSchema.optional(),
  probability: z.number().min(0).max(100).default(0),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Opportunity = z.infer<typeof opportunitySchema>

export const createOpportunitySchema = opportunitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateOpportunity = z.infer<typeof createOpportunitySchema>

export const updateOpportunitySchema = opportunitySchema.partial().extend({
  id: uuidSchema,
})

export type UpdateOpportunity = z.infer<typeof updateOpportunitySchema>
