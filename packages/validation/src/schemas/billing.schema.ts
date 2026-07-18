// ============================================
// packages/validation/src/schemas/billing.schema.ts
// Billing & Subscription Schemas — v2.0
// ============================================

import { z } from 'zod'
import { uuidSchema, isoDateSchema } from './common.schema'

// ✅ اصلاح: اضافه کردن 'free' به Plan
export const planEnum = z.enum(['free', 'pro', 'enterprise'])
export type Plan = z.infer<typeof planEnum>

export const subscriptionStatusEnum = z.enum([
  'active',
  'trial',
  'expired',
  'cancelled',
  'past_due',
])
export type SubscriptionStatus = z.infer<typeof subscriptionStatusEnum>

export const subscriptionSchema = z.object({
  id: uuidSchema.optional(),
  userId: uuidSchema,
  plan: planEnum,
  status: subscriptionStatusEnum.default('active'),
  // ✅ اضافه شد
  isTrial: z.boolean().default(true),
  trialUsed: z.boolean().default(false),
  trialStartedAt: isoDateSchema,
  trialEndsAt: isoDateSchema,
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  cancelAtPeriodEnd: z.boolean().default(false),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Subscription = z.infer<typeof subscriptionSchema>

// ─── Usage Limits ──────────────────────────────────────────────

export const usageLimitsSchema = z.object({
  invoices: z.number().int().nullable(),
  users: z.number().int().nullable(),
  businesses: z.number().int().nullable(),
  reports: z.number().int().nullable(),
  transactions: z.number().int().nullable(),
  teamMembers: z.number().int().nullable(),
  workspaces: z.number().int().nullable(),
})

export type UsageLimits = z.infer<typeof usageLimitsSchema>

// ─── Plan Features ──────────────────────────────────────────────

export const planFeaturesSchema = z.object({
  plan: planEnum,
  name: z.string(),
  priceMonthly: z.number().nullable(),
  priceYearly: z.number().nullable(),
  limits: usageLimitsSchema,
  featureKeys: z.array(z.string()), // ✅ تغییر: features → featureKeys
})

export type PlanFeatures = z.infer<typeof planFeaturesSchema>

// ─── Checkout ──────────────────────────────────────────────────

export const checkoutSchema = z.object({
  plan: planEnum,
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>

// ─── Webhook ──────────────────────────────────────────────────

export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
})

export type StripeWebhook = z.infer<typeof stripeWebhookSchema>