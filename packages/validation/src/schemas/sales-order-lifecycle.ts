import { z } from 'zod'
import type { OrderStatus } from './developer.schema'

export const ALLOWED_SALES_ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  quoted: ['pending', 'confirmed', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['partially_fulfilled', 'fulfilled', 'invoiced', 'cancelled'],
  partially_fulfilled: ['partially_fulfilled', 'fulfilled', 'invoiced', 'cancelled'],
  invoiced: ['paid', 'partially_fulfilled', 'fulfilled'],
  paid: ['fulfilled', 'invoiced'],
  fulfilled: [],
  cancelled: [],
}

export function isValidSalesOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_SALES_ORDER_TRANSITIONS[from].includes(to)
}

export interface OrderLineQuantityState {
  orderedQuantity: number
  reservedQuantity: number
  deliveredQuantity: number
}

export interface DerivedOrderLineQuantities {
  orderedQuantity: number
  reservedQuantity: number
  deliveredQuantity: number
  remainingToDeliver: number
  backorderedQuantity: number
}

/**
 * Derive backorder & remaining quantities without inventing numbers:
 * backordered = max(0, ordered - reserved - delivered).
 */
export function deriveOrderLineQuantities(
  input: OrderLineQuantityState,
): DerivedOrderLineQuantities {
  const ordered = Math.max(0, Number(input.orderedQuantity) || 0)
  const reserved = Math.max(0, Number(input.reservedQuantity) || 0)
  const delivered = Math.max(0, Number(input.deliveredQuantity) || 0)
  const remainingToDeliver = Math.max(0, ordered - delivered)
  const backorderedQuantity = Math.max(0, ordered - reserved - delivered)
  return {
    orderedQuantity: ordered,
    reservedQuantity: reserved,
    deliveredQuantity: delivered,
    remainingToDeliver,
    backorderedQuantity,
  }
}

export function deriveOrderFulfillmentStatus(
  lines: readonly OrderLineQuantityState[],
  currentStatus: OrderStatus,
): OrderStatus {
  if (lines.length === 0) return currentStatus
  const allDelivered = lines.every((l) => l.deliveredQuantity >= l.orderedQuantity)
  if (allDelivered) return 'fulfilled'
  const anyDelivered = lines.some((l) => l.deliveredQuantity > 0)
  if (anyDelivered) return 'partially_fulfilled'
  return currentStatus
}

export const orderConfirmSchema = z
  .object({
    warehouseId: z.string().uuid().optional(),
    allowBackorder: z.boolean().default(false),
  })
  .strict()
export type OrderConfirmInput = z.infer<typeof orderConfirmSchema>

export const orderDeliveryLineSchema = z
  .object({
    orderItemId: z.string().uuid(),
    quantity: z.number().positive().max(100_000),
  })
  .strict()

export const orderDeliveryCreateSchema = z
  .object({
    warehouseId: z.string().uuid(),
    idempotencyKey: z.string().trim().min(1).max(120),
    deliveryNoteId: z.string().uuid().optional(),
    notes: z.string().trim().max(500).optional(),
    lines: z.array(orderDeliveryLineSchema).min(1).max(200),
  })
  .strict()
export type OrderDeliveryCreateInput = z.infer<typeof orderDeliveryCreateSchema>
