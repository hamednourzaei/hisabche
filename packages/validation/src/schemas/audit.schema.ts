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

  /**
   * G4 — the tenancy boundary on the audit trail.
   *
   * The column has existed since live-reconciliation-migration.sql and
   * `AuditService.log()` never wrote it, so every historical row has it NULL —
   * which is why every read of the table runs behind `platformAdminGuard`. New
   * rows carry it, and the member-facing read filters on it.
   */
  workspaceId: uuidSchema.nullable().optional(),

  /** G4 — which branch the change happened at. NULL when not branch-specific. */
  branchId: uuidSchema.nullable().optional(),

  createdAt: isoDateSchema.optional(),
})

export type AuditLog = z.infer<typeof auditLogSchema>

export const createAuditLogSchema = auditLogSchema.omit({
  id: true,
  createdAt: true,
})

export type CreateAuditLog = z.infer<typeof createAuditLogSchema>

// ============================================
// Audit Filters — فقط تاریخ YYYY-MM-DD
// ============================================

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')

export const auditFiltersSchema = z.object({
  userId: uuidSchema.optional(),
  action: z.enum(['create', 'update', 'delete', 'login', 'logout', 'export', 'view']).optional(),
  entityType: z.string().optional(),
  entityId: uuidSchema.optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  /**
   * G4 — «فاکتور کی صادر شده از کدام شعبه»: the combined filter the audit tab
   * is opened to ask. Composed with `entityType` and `userId` above.
   *
   * ⚠️ NOT a tenancy filter. The workspace is never accepted from a client —
   * it comes from the verified request context. This narrows WITHIN it.
   */
  branchId: uuidSchema.optional(),

  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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
