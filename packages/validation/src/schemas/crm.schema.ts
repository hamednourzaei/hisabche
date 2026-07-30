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
  nonNegativeNumberSchema
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
})

export type UpdateInteractionStatus = z.infer<typeof updateInteractionStatusSchema>

export const publicUpdateTaskStatusSchema = z.object({
  status: z.enum(['in_progress', 'completed']),
})

export type PublicUpdateTaskStatus = z.infer<typeof publicUpdateTaskStatusSchema>

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