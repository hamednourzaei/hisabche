// ============================================
// packages/validation/src/schemas/subscription-order.schema.ts
//
// Canonical Contracts for Subscription Orders, Claim Tokens,
// and Workspace Provisioning (V54.0 Phase 5.1)
// ============================================

import { z } from 'zod'
import { uuidSchema, nonEmptyStringSchema, currencyCodeSchema } from './common.schema'
import { planEnum } from './billing.schema'

export const subscriptionOrderStatusSchema = z.enum([
  'pending_payment',
  'paid',
  'payment_failed',
  'claimed',
  'expired',
  'cancelled',
])

export type SubscriptionOrderStatus = z.infer<typeof subscriptionOrderStatusSchema>

export const billingIntervalSchema = z.enum(['month', 'year'])
export type BillingInterval = z.infer<typeof billingIntervalSchema>

export const orderPaymentMethodSchema = z.enum(['card_to_card', 'gateway', 'manual', 'cash'])
export type OrderPaymentMethod = z.infer<typeof orderPaymentMethodSchema>

/**
 * Request payload to create a new Subscription Order (Path A or Path B).
 */
export const createSubscriptionOrderSchema = z.object({
  plan: planEnum,
  billingInterval: billingIntervalSchema.default('month'),
  currency: currencyCodeSchema.default('AFN'),
  paymentMethod: orderPaymentMethodSchema.default('card_to_card'),
  idempotencyKey: z.string().trim().max(128).optional(),
  metadata: z.record(z.unknown()).default({}),
})

export type CreateSubscriptionOrder = z.infer<typeof createSubscriptionOrderSchema>

/**
 * Canonical Subscription Order model.
 */
export const subscriptionOrderSchema = z.object({
  id: uuidSchema,
  plan: planEnum,
  billingInterval: billingIntervalSchema,
  amountMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  status: subscriptionOrderStatusSchema,
  paymentMethod: orderPaymentMethodSchema.nullable(),
  paymentReference: z.string().nullable(),
  paymentVerifiedAt: z.string().nullable(),
  claimTokenExpiresAt: z.string().nullable(),
  claimedByUserId: uuidSchema.nullable(),
  claimedAt: z.string().nullable(),
  provisionedWorkspaceId: uuidSchema.nullable(),
  createdByUserId: uuidSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SubscriptionOrder = z.infer<typeof subscriptionOrderSchema>

/**
 * Claiming an order (Path A: anonymous buyer now authenticated).
 */
export const claimSubscriptionOrderSchema = z.object({
  claimToken: nonEmptyStringSchema.max(128),
  workspaceName: nonEmptyStringSchema.min(2).max(100),
  baseCurrency: currencyCodeSchema.default('AFN'),
  timeZone: z.string().trim().default('Asia/Kabul'),
})

export type ClaimSubscriptionOrder = z.infer<typeof claimSubscriptionOrderSchema>

/**
 * Provisioning a workspace from an existing paid order (Path B).
 */
export const provisionFromOrderSchema = z.object({
  orderId: uuidSchema,
  workspaceName: nonEmptyStringSchema.min(2).max(100),
  baseCurrency: currencyCodeSchema.default('AFN'),
  timeZone: z.string().trim().default('Asia/Kabul'),
})

export type ProvisionFromOrder = z.infer<typeof provisionFromOrderSchema>

/**
 * Response returned upon successful canonical provisioning.
 */
export const provisionResponseSchema = z.object({
  success: z.boolean(),
  workspaceId: uuidSchema,
  subscriptionId: uuidSchema.optional(),
  alreadyProvisioned: z.boolean(),
})

export type ProvisionResponse = z.infer<typeof provisionResponseSchema>
