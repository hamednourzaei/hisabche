// ============================================
// backend/src/services/checkout.service.ts
// Checkout Service — Stripe Checkout
// ============================================

import { Plan } from '@hisabche/validation'
import { BillingService } from './billing.service'
import { DatabaseError } from '../errors/database.error'
import { supabase } from '../db'

// ─── Interface for Payment Provider ───────────────────────────────
export interface PaymentProvider {
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>
  handleWebhook(payload: any, signature: string): Promise<WebhookResult>
  cancelSubscription(subscriptionId: string): Promise<void>
}

export interface CheckoutParams {
  userId: string
  plan: Plan
  interval: 'month' | 'year'
  successUrl: string
  cancelUrl: string
}

export interface CheckoutResult {
  sessionId: string
  url: string
  checkoutId: string
}

export interface WebhookResult {
  success: boolean
  eventType: string
  data: any
}

export class CheckoutService {
  private billingService: BillingService
  private paymentProvider: PaymentProvider | null = null

  constructor() {
    this.billingService = new BillingService()
    // در آینده با StripeProvider جایگزین می‌شود
  }

  // ─── Create Checkout Session ──────────────────────────────────────
  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    // ۱. بررسی اینکه کاربر Trial را شروع کرده است
    const subscription = await this.billingService.getOrCreateSubscription(params.userId)

    // ۲. اگر Stripe وجود ندارد، شبیه‌سازی
    if (!this.paymentProvider) {
      // در توسعه: شبیه‌سازی پرداخت
      return this.simulateCheckout(params)
    }

    // ۳. ایجاد Checkout Session
    const session = await this.paymentProvider.createCheckoutSession(params)
    
    // ۴. ذخیره checkout_id در دیتابیس
    await this.saveCheckoutSession(params.userId, session.checkoutId)

    return session
  }

  // ─── Handle Checkout Success ─────────────────────────────────────
  async handleCheckoutSuccess(userId: string, checkoutId: string): Promise<void> {
    // ۱. دریافت اطلاعات checkout
    const checkout = await this.getCheckoutSession(checkoutId)
    if (!checkout) throw new DatabaseError('Checkout session not found')

    // ۲. ارتقا اشتراک
    await this.billingService.upgrade(userId, checkout.plan as Plan, checkout.interval)

    // ۳. ثبت رویداد
    console.log(`✅ User ${userId} upgraded to ${checkout.plan}`)
  }

  // ─── Handle Checkout Cancel ──────────────────────────────────────
  async handleCheckoutCancel(userId: string, checkoutId: string): Promise<void> {
    // ۱. لاگ کردن
    console.log(`❌ User ${userId} cancelled checkout: ${checkoutId}`)
  }

  // ─── Private: Simulate Checkout (توسعه) ─────────────────────────
  private async simulateCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const checkoutId = `checkout_${Date.now()}_${params.userId.slice(0, 8)}`
    
    // در توسعه، بعد از ۲ ثانیه شبیه‌سازی موفقیت
    setTimeout(async () => {
      await this.handleCheckoutSuccess(params.userId, checkoutId)
    }, 2000)

    return {
      sessionId: `cs_${Date.now()}`,
      url: `https://hisabche.com/checkout/${checkoutId}`,
      checkoutId,
    }
  }

  // ─── Private: Save Checkout Session ─────────────────────────────
  private async saveCheckoutSession(userId: string, checkoutId: string): Promise<void> {
    // ذخیره در دیتابیس برای پردازش Webhook
    await supabase.from('checkout_sessions').insert({
      id: checkoutId,
      user_id: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
  }

  // ─── Private: Get Checkout Session ──────────────────────────────
  private async getCheckoutSession(checkoutId: string): Promise<any> {
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', checkoutId)
      .single()

    if (error) return null
    return data
  }

  // ─── Set Payment Provider ────────────────────────────────────────
  setPaymentProvider(provider: PaymentProvider): void {
    this.paymentProvider = provider
  }
}