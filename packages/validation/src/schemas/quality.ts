// ============================================
// packages/validation/src/schemas/quality.ts
//
// V60 Slice 11 — Quality inspection event log & warranty claims chain (P9).
// ============================================

import { z } from 'zod'

export const QUALITY_SOURCE_TYPES = [
  'receipt',
  'work_order',
  'delivery',
  'return',
  'repair',
] as const
export type QualitySourceType = (typeof QUALITY_SOURCE_TYPES)[number]

export const QUALITY_EVENT_KINDS = ['check', 'pass', 'fail', 'defect', 'rework'] as const
export type QualityEventKind = (typeof QUALITY_EVENT_KINDS)[number]

export const CLAIM_DISPOSITIONS = ['restock', 'repair', 'scrap', 'replace'] as const
export type ClaimDisposition = (typeof CLAIM_DISPOSITIONS)[number]

export const WARRANTY_EXPIRED_CODE = 'WARRANTY_EXPIRED'

export const qualityEventCreateSchema = z.object({
  sourceType: z.enum(QUALITY_SOURCE_TYPES),
  sourceId: z.string().uuid(),
  eventKind: z.enum(QUALITY_EVENT_KINDS),
  productId: z.string().uuid().optional(),
  serialNumber: z.string().max(120).optional(),
  quantity: z.number().finite().positive().default(1),
  fromWarehouseId: z.string().uuid().optional(),
  quarantineWarehouseId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  occurredAt: z.string().optional(),
})

export type QualityEventCreateInput = z.infer<typeof qualityEventCreateSchema>

export const warrantyClaimCreateSchema = z.object({
  warrantyId: z.string().uuid(),
  claimDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issueDescription: z.string().trim().min(1).max(1000),
  disposition: z.enum(CLAIM_DISPOSITIONS).default('repair'),
  repairTicketId: z.string().uuid().optional(),
  resolutionNotes: z.string().max(1000).optional(),
})

export type WarrantyClaimCreateInput = z.infer<typeof warrantyClaimCreateSchema>
