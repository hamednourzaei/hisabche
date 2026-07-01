// ============================================
// packages/validation/src/schemas/event.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Event Type
// ============================================

export const eventTypeSchema = z.object({
  type: nonEmptyStringSchema,
  description: optionalStringSchema,
  schemaVersion: z.number().int().positive().default(1),
})

export type EventType = z.infer<typeof eventTypeSchema>

// ============================================
// Event Log
// ============================================

export const eventLogSchema = z.object({
  id: uuidSchema.optional(),
  eventType: nonEmptyStringSchema,
  entityType: nonEmptyStringSchema,
  entityId: uuidSchema,
  payload: z.record(z.unknown()).default({}),
  processed: z.boolean().default(false),
  userId: uuidSchema,
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().positive().default(3),
  nextRetryAt: isoDateSchema.optional().nullable(),
  errorMessage: optionalStringSchema,
  completedAt: isoDateSchema.optional().nullable(),
  idempotencyKey: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
})

export type EventLog = z.infer<typeof eventLogSchema>

export const createEventLogSchema = eventLogSchema.omit({
  id: true,
  processed: true,
  retryCount: true,
  errorMessage: true,
  completedAt: true,
  createdAt: true,
})

export type CreateEventLog = z.infer<typeof createEventLogSchema>

// ============================================
// Event Type Codes
// ============================================

export const EVENT_TYPE_CODES = [
  'invoice.created',
  'invoice.paid',
  'invoice.cancelled',
  'stock.added',
  'stock.removed',
  'stock.transferred',
  'stock.low',
  'journal.created',
  'account.created',
  'employee.created',
  'employee.terminated',
  'leave.requested',
  'leave.approved',
  'project.created',
  'task.completed',
  'member.invited',
  'member.joined',
  'user.login',
  'user.logout',
  'data.exported',
] as const

export type EventTypeCode = (typeof EVENT_TYPE_CODES)[number]