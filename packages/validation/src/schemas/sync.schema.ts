// ============================================
// packages/validation/src/schemas/sync.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Sync Queue Item (آیتم صف همگام‌سازی)
// ============================================

export const syncQueueItemSchema = z.object({
  id: uuidSchema.optional(),
  userId: uuidSchema,
  entityType: nonEmptyStringSchema,
  entityId: uuidSchema.nullable().optional(),
  action: z.enum(['create', 'update', 'delete']),
  payload: z.record(z.unknown()),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  priority: z.number().int().min(0).max(10).default(5),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().positive().default(3),
  errorMessage: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  processedAt: isoDateSchema.optional().nullable(),
})

export type SyncQueueItem = z.infer<typeof syncQueueItemSchema>

export const createSyncQueueItemSchema = syncQueueItemSchema.omit({
  id: true,
  retryCount: true,
  errorMessage: true,
  processedAt: true,
  createdAt: true,
})

export type CreateSyncQueueItem = z.infer<typeof createSyncQueueItemSchema>

// ============================================
// Sync Log (تاریخچه همگام‌سازی)
// ============================================

export const syncLogSchema = z.object({
  id: uuidSchema.optional(),
  userId: uuidSchema,
  startedAt: isoDateSchema,
  completedAt: isoDateSchema.optional().nullable(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).default('running'),
  itemsProcessed: z.number().int().nonnegative().default(0),
  itemsFailed: z.number().int().nonnegative().default(0),
  itemsTotal: z.number().int().nonnegative().default(0),
  errorMessage: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
})

export type SyncLog = z.infer<typeof syncLogSchema>

// ============================================
// Sync Config (تنظیمات همگام‌سازی)
// ============================================

export const syncConfigSchema = z.object({
  autoSync: z.boolean().default(true),
  syncIntervalMs: z.number().int().min(5000).default(30000),
  maxRetries: z.number().int().min(1).max(10).default(3),
  batchSize: z.number().int().min(1).max(100).default(10),
  conflictStrategy: z.enum(['client_wins', 'server_wins', 'last_write_wins', 'manual']).default('client_wins'),
  syncOnWifiOnly: z.boolean().default(false),
  syncOnBatteryOnly: z.boolean().default(false),
})

export type SyncConfig = z.infer<typeof syncConfigSchema>

// ============================================
// Network Status
// ============================================

export const networkStatusSchema = z.object({
  isOnline: z.boolean(),
  connectionType: z.enum(['wifi', 'cellular', 'ethernet', 'unknown']).default('unknown'),
  lastCheckedAt: isoDateSchema.optional(),
})

export type NetworkStatus = z.infer<typeof networkStatusSchema>