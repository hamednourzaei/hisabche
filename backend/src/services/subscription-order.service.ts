// ============================================
// backend/src/services/subscription-order.service.ts
//
// V54.0 Phase 5.1 — Canonical Subscription Order & Provisioning Service
//
// Implements:
//   1. Path A: Create anonymous order, verify payment, generate cryptographic claim token.
//   2. Path B: Create user-bound order, verify payment, directly provision workspace.
//   3. Claim Order: Secure atomic single-use claim token redemption to provision workspace.
//   4. Canonical Provisioning: Calls PostgreSQL `canonical_provision_workspace` RPC.
// ============================================

import { createHash, randomBytes } from 'node:crypto'
import type {
  CreateSubscriptionOrder,
  SubscriptionOrder,
  ProvisionResponse,
} from '@hisabche/validation'
import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { DatabaseError, NotFoundError, ConflictError } from '../errors/database.error'
import { PLAN_PRICING, type PricingPlan } from './plan-pricing'

export class SubscriptionOrderError extends BaseError {
  public readonly code: string
  constructor(message: string, statusCode = 400, code = 'SUBSCRIPTION_ORDER_ERROR') {
    super(message, statusCode)
    this.name = 'SubscriptionOrderError'
    this.code = code
  }
}

export class OrderAlreadyClaimedError extends SubscriptionOrderError {
  constructor(message = 'Subscription order has already been claimed') {
    super(message, 409, 'ORDER_ALREADY_CLAIMED')
    this.name = 'OrderAlreadyClaimedError'
  }
}

export class OrderNotPaidError extends SubscriptionOrderError {
  constructor(message = 'Subscription order payment has not been verified') {
    super(message, 402, 'ORDER_NOT_PAID')
    this.name = 'OrderNotPaidError'
  }
}

export class InvalidClaimTokenError extends SubscriptionOrderError {
  constructor(message = 'Invalid or expired claim token') {
    super(message, 400, 'INVALID_CLAIM_TOKEN')
    this.name = 'InvalidClaimTokenError'
  }
}

export class SubscriptionOrderService {
  constructor(private readonly db = supabase) {}

  /**
   * Hashes a raw claim token with SHA-256 for secure DB storage.
   */
  public hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
  }

  /**
   * Creates a new subscription order (Path A: anonymous, or Path B: user-bound).
   */
  async createOrder(
    input: CreateSubscriptionOrder,
    userId?: string | undefined,
  ): Promise<{ order: SubscriptionOrder; rawClaimToken?: string | undefined }> {
    // 1. Calculate price from canonical plan pricing
    const planKey = input.plan as PricingPlan
    const planPrices = PLAN_PRICING[planKey]
    let amountMinor = 0

    if (planPrices) {
      const priceVal = input.billingInterval === 'year' ? planPrices.yearly : planPrices.monthly
      amountMinor = priceVal ?? 0
    }

    // 2. Generate secure high-entropy claim token for Path A (Buy First)
    let rawClaimToken: string | undefined
    let claimTokenHash: string | null = null
    let claimTokenExpiresAt: string | null = null

    if (!userId) {
      rawClaimToken = randomBytes(32).toString('hex')
      claimTokenHash = this.hashToken(rawClaimToken)
      // 24 hour claim expiry
      claimTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }

    const insertPayload: Record<string, unknown> = {
      plan: input.plan,
      billing_interval: input.billingInterval,
      amount_minor: amountMinor,
      currency: input.currency,
      status: 'pending_payment',
      payment_method: input.paymentMethod,
      claim_token_hash: claimTokenHash,
      claim_token_expires_at: claimTokenExpiresAt,
      created_by_user_id: userId ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      metadata: input.metadata ?? {},
    }

    const { data, error } = await this.db
      .from('subscription_orders')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error || !data) {
      if (error?.code === '23505' && input.idempotencyKey) {
        // Idempotency: return existing order
        const { data: existing } = await this.db
          .from('subscription_orders')
          .select('*')
          .eq('idempotency_key', input.idempotencyKey)
          .single()
        if (existing) return { order: this.mapRow(existing) }
      }
      throw new DatabaseError('Failed to create subscription order', error)
    }

    return {
      order: this.mapRow(data),
      rawClaimToken,
    }
  }

  /**
   * Simulates/Executes server-side payment verification.
   * In production, this is invoked by trusted webhook or platform admin.
   */
  async markPaymentVerified(
    orderId: string,
    paymentRef: string,
    method = 'card_to_card',
  ): Promise<SubscriptionOrder> {
    const { data: order, error: fetchErr } = await this.db
      .from('subscription_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      throw new DatabaseError('Failed to read subscription order', fetchErr)
    }
    if (!order) {
      throw new NotFoundError('Subscription order')
    }

    if (order.status === 'paid' || order.status === 'claimed') {
      return this.mapRow(order)
    }

    const { data: updated, error: updateErr } = await this.db
      .from('subscription_orders')
      .update({
        status: 'paid',
        payment_reference: paymentRef,
        payment_method: method,
        payment_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*')
      .single()

    if (updateErr || !updated) {
      throw new DatabaseError('Failed to update order payment status', updateErr)
    }

    return this.mapRow(updated)
  }

  /**
   * PATH A: Claim an order using the cryptographic raw claim token and provision workspace.
   */
  async claimOrderAndProvision(
    userId: string,
    rawClaimToken: string,
    workspaceName: string,
    baseCurrency = 'AFN',
    timeZone = 'Asia/Kabul',
  ): Promise<ProvisionResponse> {
    const tokenHash = this.hashToken(rawClaimToken)

    const { data: order, error } = await this.db
      .from('subscription_orders')
      .select('*')
      .eq('claim_token_hash', tokenHash)
      .single()

    if (error || !order) {
      throw new InvalidClaimTokenError('Claim token not found or already consumed')
    }

    if (order.claim_token_expires_at && new Date(order.claim_token_expires_at) < new Date()) {
      throw new InvalidClaimTokenError('Claim token has expired')
    }

    if (order.status === 'claimed') {
      if (order.claimed_by_user_id === userId && order.provisioned_workspace_id) {
        return {
          success: true,
          workspaceId: order.provisioned_workspace_id,
          alreadyProvisioned: true,
        }
      }
      throw new OrderAlreadyClaimedError()
    }

    if (order.status !== 'paid') {
      throw new OrderNotPaidError()
    }

    // Call Canonical PostgreSQL RPC
    return this.invokeProvisionRpc(order.id, userId, workspaceName, baseCurrency, timeZone)
  }

  /**
   * PATH B: Provision workspace directly from an authenticated, paid order.
   */
  async provisionFromOrder(
    userId: string,
    orderId: string,
    workspaceName: string,
    baseCurrency = 'AFN',
    timeZone = 'Asia/Kabul',
  ): Promise<ProvisionResponse> {
    const { data: order, error } = await this.db
      .from('subscription_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError('Failed to read subscription order', error)
    }
    if (!order) {
      throw new NotFoundError('Subscription order')
    }

    if (order.created_by_user_id && order.created_by_user_id !== userId) {
      throw new SubscriptionOrderError('Order does not belong to this user', 403, 'ORDER_FORBIDDEN')
    }

    if (order.status === 'claimed') {
      if (order.claimed_by_user_id === userId && order.provisioned_workspace_id) {
        return {
          success: true,
          workspaceId: order.provisioned_workspace_id,
          alreadyProvisioned: true,
        }
      }
      throw new OrderAlreadyClaimedError()
    }

    if (order.status !== 'paid') {
      throw new OrderNotPaidError()
    }

    return this.invokeProvisionRpc(orderId, userId, workspaceName, baseCurrency, timeZone)
  }

  /**
   * Invokes the atomic `canonical_provision_workspace` PostgreSQL RPC.
   */
  private async invokeProvisionRpc(
    orderId: string,
    userId: string,
    workspaceName: string,
    baseCurrency: string,
    timeZone: string,
  ): Promise<ProvisionResponse> {
    const { data, error } = await this.db.rpc('canonical_provision_workspace', {
      p_order_id: orderId,
      p_user_id: userId,
      p_workspace_name: workspaceName,
      p_base_currency: baseCurrency,
      p_time_zone: timeZone,
    })

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError(error.message)
      }
      throw new DatabaseError(`Provisioning RPC failed: ${error.message}`, error)
    }

    const res = data as {
      success: boolean
      workspace_id: string
      subscription_id?: string
      already_provisioned: boolean
    }

    return {
      success: res.success,
      workspaceId: res.workspace_id,
      subscriptionId: res.subscription_id,
      alreadyProvisioned: res.already_provisioned,
    }
  }

  private mapRow(row: Record<string, any>): SubscriptionOrder {
    return {
      id: row.id,
      plan: row.plan,
      billingInterval: row.billing_interval,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentVerifiedAt: row.payment_verified_at,
      claimTokenExpiresAt: row.claim_token_expires_at,
      claimedByUserId: row.claimed_by_user_id,
      claimedAt: row.claimed_at,
      provisionedWorkspaceId: row.provisioned_workspace_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

export const subscriptionOrderService = new SubscriptionOrderService()
