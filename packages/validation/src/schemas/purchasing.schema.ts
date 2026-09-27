// ============================================
// packages/validation/src/schemas/purchasing.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Purchase Order (سفارش خرید)
// ============================================

export const purchaseOrderSchema = z.object({
  id: uuidSchema.optional(),
  supplierId: uuidSchema,
  orderDate: isoDateSchema.default(() => new Date().toISOString()),
  expectedDeliveryDate: isoDateSchema.optional(),
  items: z.array(
    z.object({
      productId: uuidSchema,
      quantity: positiveNumberSchema,
      unitPrice: positiveNumberSchema,
      totalPrice: positiveNumberSchema,
    }),
  ),
  status: z.enum(['pending', 'approved', 'shipped', 'received', 'cancelled']).default('pending'),
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>

/**
 * Statuses a client may SET.
 *
 * ⚠️ «received» IS NOT ONE OF THEM (27 Sep 2026). It is reached only through
 * `POST /api/purchase-orders/:id/receive`, which moves the stock. Accepted
 * here, it marked an order received with no goods on the shelf — and the
 * receive route then refused it, so the stock could never arrive.
 */
export const settablePurchaseOrderStatusSchema = z.enum([
  'pending',
  'approved',
  'shipped',
  'cancelled',
])

export const createPurchaseOrderSchema = purchaseOrderSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
  })
  .extend({ status: settablePurchaseOrderStatusSchema.default('pending') })

export type CreatePurchaseOrder = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = purchaseOrderSchema
  .omit({ status: true })
  .partial()
  .extend({
    id: uuidSchema,
    status: settablePurchaseOrderStatusSchema.optional(),
  })

export type UpdatePurchaseOrder = z.infer<typeof updatePurchaseOrderSchema>
