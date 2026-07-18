// ============================================
// backend/src/services/webhook.service.ts
// Webhook Service — Stripe Webhook Processing
// ============================================

import { supabase } from '../db'
import { BillingService } from './billing.service'
import { DatabaseError } from '../errors/database.error'

export interface WebhookEvent {
  id: string
  type: string
  data: any
  timestamp: Date
}

export class WebhookService {
  private billingService: BillingService

  constructor() {
    this.billingService = new BillingService()
  }

  // ─── Process Incoming Webhook ────────────────────────────────────
  async processWebhook(event: WebhookEvent): Promise<{ success: boolean; action: string }> {
    // ۱. بررسی Idempotency
    const processed = await this.isProcessed(event.id)
    if (processed) {
      return { success: true, action: 'already_processed' }
    }

    // ۲. پردازش بر اساس نوع رویداد
    switch(event.type) {
      case 'checkout.session.completed':
        return await this.handleCheckoutCompleted(event)
      
      case 'invoice.paid':
        return await this.handleInvoicePaid(event)
      
      case 'invoice.payment_failed':
        return await this.handlePaymentFailed(event)
      
      case 'customer.subscription.deleted':
        return await this.handleSubscriptionDeleted(event)
      
      case 'customer.subscription.updated':
        return await this.handleSubscriptionUpdated(event)
      
      default:
        return { success: true, action: 'ignored' }
    }
  }

  // ─── Handle: Checkout Completed ──────────────────────────────────
  private async handleCheckoutCompleted(event: WebhookEvent): Promise<{ success: boolean; action: string }> {
    const session = event.data.object
    const userId = session.client_reference_id
    const plan = session.metadata?.plan || 'pro'
    const interval = session.metadata?.interval || 'month'

    if (!userId) {
      throw new DatabaseError('Missing user_id in webhook')
    }

    // ارتقا اشتراک
    await this.billingService.upgrade(userId, plan, interval)

    // ثبت رویداد
    await this.logWebhook(event)

    return { success: true, action: 'upgraded' }
  }

  // ─── Handle: Invoice Paid ───────────────────────────────────────
  private async handleInvoicePaid(event: WebhookEvent): Promise<{ success: boolean; action: string }> {
    const invoice = event.data.object
    const userId = invoice.client_reference_id

    if (userId) {
      // تمدید اشتراک
      await this.extendSubscription(userId)
    }

    await this.logWebhook(event)
    return { success: true, action: 'invoice_paid' }
  }

  // ─── Handle: Payment Failed ──────────────────────────────────────
  private async handlePaymentFailed(event: WebhookEvent): Promise<{ success: boolean; action: string }> {
    const invoice = event.data.object
    const userId = invoice.client_reference_id

    if (userId) {
      // به‌روزرسانی وضعیت
      await this.setSubscriptionStatus(userId, 'past_due')
    }

    await this.logWebhook(event)
    return { success: true, action: 'payment_failed' }
  }

  // ─── Handle: Subscription Deleted ───────────────────────────────
  private async handleSubscriptionDeleted(event: WebhookEvent): Promise<{ success: boolean; action: string }> {
    const subscription = event.data.object
    const userId = subscription.client_reference_id

    if (userId) {
      await this.setSubscriptionStatus(userId, 'cancelled')
    }

    await this.logWebhook(event)
    return { success: true, action: 'subscription_deleted' }
  }

  // ─── Handle: Subscription Updated ──────────────────────────────
  private async handleSubscriptionUpdated(event: WebhookEvent): Promise<{ success: boolean; action: string }> {
    const subscription = event.data.object
    const userId = subscription.client_reference_id
    const status = subscription.status

    if (userId) {
      await this.setSubscriptionStatus(userId, status)
    }

    await this.logWebhook(event)
    return { success: true, action: 'subscription_updated' }
  }

  // ─── Private: Check Idempotency ──────────────────────────────────
  private async isProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('id', eventId)
      .single()

    return !!data
  }

  // ─── Private: Log Webhook ────────────────────────────────────────
  private async logWebhook(event: WebhookEvent): Promise<void> {
    await supabase.from('webhook_events').insert({
      id: event.id,
      type: event.type,
      payload: event.data,
      processed_at: new Date().toISOString(),
    })
  }

  // ─── Private: Extend Subscription ──────────────────────────────
  private async extendSubscription(userId: string): Promise<void> {
    const subscription = await this.billingService.getCurrentSubscription(userId)
    const periodEnd = new Date(subscription.periodEnd)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    await supabase
      .from('subscriptions')
      .update({
        period_end: periodEnd.toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }

  // ─── Private: Set Subscription Status ───────────────────────────
  private async setSubscriptionStatus(userId: string, status: string): Promise<void> {
    await supabase
      .from('subscriptions')
      .update({
        status: status as any,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}