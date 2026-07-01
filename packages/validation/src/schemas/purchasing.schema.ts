// ============================================
// packages/validation/src/schemas/purchasing.schema.ts
// ============================================

import { z } from 'zod'
import { 
  uuidSchema, 
  nonEmptyStringSchema, 
  optionalStringSchema, 
  positiveNumberSchema,
  isoDateSchema
} from './common.schema'

// ============================================
// Purchase Order (سفارش خرید)
// ============================================

export const purchaseOrderSchema = z.object({
  id: uuidSchema.optional(),
  supplierId: uuidSchema,
  orderDate: isoDateSchema.default(() => new Date().toISOString()),
  expectedDeliveryDate: isoDateSchema.optional(),
  items: z.array(z.object({
    productId: uuidSchema,
    quantity: positiveNumberSchema,
    unitPrice: positiveNumberSchema,
    totalPrice: positiveNumberSchema,
  })),
  status: z.enum(['pending', 'approved', 'shipped', 'received', 'cancelled']).default('pending'),
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>

export const createPurchaseOrderSchema = purchaseOrderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreatePurchaseOrder = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = purchaseOrderSchema.partial().extend({
  id: uuidSchema,
})

export type UpdatePurchaseOrder = z.infer<typeof updatePurchaseOrderSchema>