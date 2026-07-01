// ============================================
// packages/validation/src/schemas/audit.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Audit Log (گزارش حسابرسی)
// ============================================

export const auditLogSchema = z.object({
  id: uuidSchema.optional(),
  userId: uuidSchema,
  action: z.enum(['create', 'update', 'delete', 'login', 'logout', 'export', 'view']),
  entityType: nonEmptyStringSchema,
  entityId: uuidSchema.nullable().optional(),
  oldData: z.record(z.unknown()).nullable().optional(),
  newData: z.record(z.unknown()).nullable().optional(),
  ipAddress: optionalStringSchema,
  userAgent: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
})

export type AuditLog = z.infer<typeof auditLogSchema>

export const createAuditLogSchema = auditLogSchema.omit({
  id: true,
  createdAt: true,
})

export type CreateAuditLog = z.infer<typeof createAuditLogSchema>

// ============================================
// Audit Filters
// ============================================

export const auditFiltersSchema = z.object({
  userId: uuidSchema.optional(),
  action: z.enum(['create', 'update', 'delete', 'login', 'logout', 'export', 'view']).optional(),
  entityType: z.string().optional(),
  entityId: uuidSchema.optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(50),
})

export type AuditFilters = z.infer<typeof auditFiltersSchema>

// ============================================
// Audit Stats
// ============================================

export const auditStatsSchema = z.object({
  totalActions: z.number(),
  byAction: z.record(z.number()),
  byEntity: z.record(z.number()),
  byUser: z.record(z.number()),
  period: z.object({
    start: isoDateSchema,
    end: isoDateSchema,
  }),
})

export type AuditStats = z.infer<typeof auditStatsSchema>