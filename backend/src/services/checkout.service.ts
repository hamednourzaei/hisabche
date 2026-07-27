// ============================================
// backend/src/services/checkout.service.ts — Optimized v2.3
// FIXED: exactOptionalPropertyTypes error
// ============================================

import { Plan } from '@hisabche/validation'
import { BillingService } from './billing.service'
import { DatabaseError } from '../errors/database.error'
import { supabase } from '../db'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'

// ─── Constants ──────────────────────────────────────────────
const CHECKOUT_SESSION_TTL = 30 * 60 // 30 minutes
const CHECKOUT_CACHE_TTL = 60 // 1 minute

// ─── Column Selection ──────────────────────────────────────
const CHECKOUT_SESSION_COLUMNS = 'id, user_id, plan, interval, status, stripe_session_id, checkout_url, idempotency_key, created_at, expires_at, updated_at'
const CHECKOUT_MINIMAL_COLUMNS = 'id, user_id, plan, interval, status, stripe_session_id, checkout_url, idempotency_key'

// ─── Interface for Payment Provider ────────────────────────
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
  idempotencyKey?: string
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

// ✅ Type for checkout session data (idempotencyKey با string | null)
interface SaveCheckoutSessionData {
  id: string
  userId: string
  plan: Plan
  interval: 'month' | 'year'
  status: string
  stripeSessionId: string
  checkoutUrl: string
  idempotencyKey: string | null // ✅ استفاده از null به جای undefined
}

export class CheckoutService {
  private billingService: BillingService
  private paymentProvider: PaymentProvider | null = null
  private pendingCheckouts: Map<string, { 
    userId: string; 
    plan: Plan; 
    interval: 'month' | 'year';
    timeout: NodeJS.Timeout;
  }> = new Map()

  constructor() {
    this.billingService = new BillingService()
  }

  // ─── Cache Keys ────────────────────────────────────────────
  private getCheckoutCacheKey(checkoutId: string) {
    return `checkout:${checkoutId}`
  }

  private getCheckoutByUserCacheKey(userId: string) {
    return `checkout:user:${userId}`
  }

  // ─── Create Checkout Session ──────────────────────────────
  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    // ✅ Idempotency: بررسی درخواست تکراری
    if (params.idempotencyKey) {
      const existing = await this.getCheckoutByIdempotencyKey(params.idempotencyKey)
      if (existing) {
        console.log(`🔄 Idempotent request: ${params.idempotencyKey}`)
        return existing
      }
    }

    // ۱. بررسی اینکه کاربر Trial را شروع کرده است
    await this.billingService.getOrCreateSubscription(params.userId)

    // ۲. اگر Stripe وجود ندارد، شبیه‌سازی
    if (!this.paymentProvider) {
      return this.simulateCheckout(params)
    }

    // ۳. ایجاد Checkout Session
    const session = await this.paymentProvider.createCheckoutSession(params)
    
    // ۴. ذخیره checkout_id در دیتابیس
    await this.saveCheckoutSession({
      id: session.checkoutId,
      userId: params.userId,
      plan: params.plan,
      interval: params.interval,
      status: 'pending',
      stripeSessionId: session.sessionId,
      checkoutUrl: session.url,
      idempotencyKey: params.idempotencyKey || null, // ✅ تبدیل undefined به null
    })

    // ✅ ذخیره در کش
    await this.cacheCheckoutSession(session.checkoutId, {
      userId: params.userId,
      plan: params.plan,
      interval: params.interval,
      status: 'pending',
    })

    return session
  }

  // ─── Handle Checkout Success ──────────────────────────────
  async handleCheckoutSuccess(userId: string, checkoutId: string): Promise<void> {
    // ✅ بررسی idempotency
    const processedKey = `checkout:processed:${checkoutId}`
    const processed = await memoryCache.get(processedKey)
    if (processed) {
      console.log(`🔄 Checkout ${checkoutId} already processed`)
      return
    }

    // ۱. دریافت اطلاعات checkout
    const checkout = await this.getCheckoutSession(checkoutId)
    if (!checkout) {
      console.error(`❌ Checkout ${checkoutId} not found`)
      throw new DatabaseError('Checkout session not found')
    }

    // ۲. بررسی اینکه قبلاً پردازش نشده باشد
    if (checkout.status === 'completed') {
      console.log(`ℹ️ Checkout ${checkoutId} already completed`)
      return
    }

    // ۳. ارتقا اشتراک
    await this.billingService.upgrade(userId, checkout.plan as Plan, checkout.interval)

    // ۴. به‌روزرسانی وضعیت
    await this.updateCheckoutStatus(checkoutId, 'completed')

    // ۵. ثبت در کش به عنوان پردازش شده
    await memoryCache.set(processedKey, true, 3600) // 1 hour

    // ۶. ثبت رویداد
    console.log(`✅ User ${userId} upgraded to ${checkout.plan}`)

    logBusinessEvent({
      userId,
      entityType: 'billing',
      entityId: checkoutId,
      action: 'upgraded',
      title: `اشتراک شما به پلن ${checkout.plan} ارتقا یافت 🎉`,
      notifyType: 'success',
      actionUrl: '/billing',
    }).catch((err) => console.error('[CheckoutService] logBusinessEvent failed:', err))
  }

  // ─── Handle Checkout Cancel ───────────────────────────────
  async handleCheckoutCancel(userId: string, checkoutId: string): Promise<void> {
    await this.updateCheckoutStatus(checkoutId, 'cancelled')
    console.log(`❌ User ${userId} cancelled checkout: ${checkoutId}`)
  }

  // ─── Get Checkout Status ──────────────────────────────────
  async getCheckoutStatus(checkoutId: string): Promise<{
    status: string
    plan: string
    interval: string
  } | null> {
    const cacheKey = this.getCheckoutCacheKey(checkoutId)
    const cached = await memoryCache.get(cacheKey)
    if (cached) {
      return cached as { status: string; plan: string; interval: string }
    }

    const checkout = await this.getCheckoutSession(checkoutId)
    if (!checkout) return null

    const result = {
      status: checkout.status,
      plan: checkout.plan,
      interval: checkout.interval,
    }

    await memoryCache.set(cacheKey, result, CHECKOUT_CACHE_TTL)
    return result
  }

  // ─── Private: Simulate Checkout ──────────────────────────
  private async simulateCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const checkoutId = `checkout_${Date.now()}_${params.userId.slice(0, 8)}`
    
    const timeout = setTimeout(async () => {
      try {
        await this.handleCheckoutSuccess(params.userId, checkoutId)
        this.pendingCheckouts.delete(checkoutId)
        console.log(`✅ Simulated checkout completed for ${params.userId}`)
      } catch (err) {
        console.error(`❌ Simulated checkout failed for ${params.userId}:`, err)
        this.pendingCheckouts.delete(checkoutId)
      }
    }, 2000)

    this.pendingCheckouts.set(checkoutId, {
      userId: params.userId,
      plan: params.plan,
      interval: params.interval,
      timeout,
    })

    // ✅ ذخیره با idempotencyKey یا null
    await this.saveCheckoutSession({
      id: checkoutId,
      userId: params.userId,
      plan: params.plan,
      interval: params.interval,
      status: 'pending',
      stripeSessionId: `cs_${Date.now()}`,
      checkoutUrl: `https://hisabche.com/checkout/${checkoutId}`,
      idempotencyKey: params.idempotencyKey || null,
    })

    return {
      sessionId: `cs_${Date.now()}`,
      url: `https://hisabche.com/checkout/${checkoutId}`,
      checkoutId,
    }
  }

  // ─── Private: Save Checkout Session ──────────────────────
  private async saveCheckoutSession(data: SaveCheckoutSessionData): Promise<void> {
    const expiresAt = new Date(Date.now() + CHECKOUT_SESSION_TTL * 1000)

    const { error } = await supabase.from('checkout_sessions').insert({
      id: data.id,
      user_id: data.userId,
      plan: data.plan,
      interval: data.interval,
      status: data.status,
      stripe_session_id: data.stripeSessionId,
      checkout_url: data.checkoutUrl,
      idempotency_key: data.idempotencyKey, // ✅ now string | null
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Failed to save checkout session:', error)
      throw new DatabaseError('Failed to save checkout session', error)
    }
  }

  // ─── Private: Update Checkout Status ─────────────────────
  private async updateCheckoutStatus(checkoutId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('checkout_sessions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkoutId)

    if (error) {
      console.error(`Failed to update checkout ${checkoutId}:`, error)
      throw new DatabaseError('Failed to update checkout session', error)
    }

    await memoryCache.invalidate(this.getCheckoutCacheKey(checkoutId))
    await memoryCache.invalidate(`checkout:processed:${checkoutId}`)
  }

  // ─── Private: Get Checkout Session ──────────────────────
  private async getCheckoutSession(checkoutId: string): Promise<any> {
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select(CHECKOUT_SESSION_COLUMNS)
      .eq('id', checkoutId)
      .single()

    if (error) {
      console.error('Failed to get checkout session:', error)
      return null
    }
    return data
  }

  // ─── Private: Get by Idempotency Key ─────────────────────
  private async getCheckoutByIdempotencyKey(idempotencyKey: string): Promise<CheckoutResult | null> {
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select(CHECKOUT_SESSION_COLUMNS)
      .eq('idempotency_key', idempotencyKey)
      .eq('status', 'pending')
      .single()

    if (error || !data) return null

    return {
      sessionId: data.stripe_session_id || `cs_${Date.now()}`,
      url: data.checkout_url || `https://hisabche.com/checkout/${data.id}`,
      checkoutId: data.id,
    }
  }

  // ─── Private: Cache Checkout Session ─────────────────────
  private async cacheCheckoutSession(checkoutId: string, data: any): Promise<void> {
    const cacheKey = this.getCheckoutCacheKey(checkoutId)
    await memoryCache.set(cacheKey, data, CHECKOUT_CACHE_TTL)
    
    const userCacheKey = this.getCheckoutByUserCacheKey(data.userId)
    await memoryCache.set(userCacheKey, { checkoutId, data }, CHECKOUT_CACHE_TTL)
  }

  // ─── Cleanup Expired Checkouts ───────────────────────────
  async cleanupExpiredCheckouts(): Promise<number> {
    const { data, error } = await supabase
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'pending')
      .select('id')

    if (error) {
      console.error('Failed to cleanup expired checkouts:', error)
      return 0
    }

    if (data && data.length > 0) {
      for (const row of data) {
        await memoryCache.invalidate(this.getCheckoutCacheKey(row.id))
      }
    }

    return data?.length || 0
  }

  // ─── Set Payment Provider ─────────────────────────────────
  setPaymentProvider(provider: PaymentProvider): void {
    this.paymentProvider = provider
  }
}

export default CheckoutService