// ============================================
// backend/src/services/email.service.ts — Optimized v2.1
// FIXED: Import order, added cache, better error handling
// ============================================

import { Resend } from 'resend'
import { supabase } from '../db'
import { memoryCache } from '../utils/pagination'

// ─── Initialize Resend ──────────────────────────────────────────
console.log('[EMAIL] Initializing Resend...')
console.log('[EMAIL] API_KEY exists:', !!process.env.RESEND_API_KEY)
console.log('[EMAIL] API_KEY prefix:', (process.env.RESEND_API_KEY || 'NONE').substring(0, 5))
console.log('[EMAIL] API_KEY length:', (process.env.RESEND_API_KEY || '').length)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@hisabche.com'
const FROM_NAME = process.env.FROM_NAME || 'Hisabche'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// ─── Types ──────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export interface EmailData {
  name: string
  daysLeft?: number
  trialEndsAt?: string
  plan?: string
  amount?: number
  currency?: string
  invoiceUrl?: string
  resetLink?: string
}

// ─── i18n Email Templates ──────────────────────────────────────

export type Language = 'fa-IR' | 'fa-AF' | 'en'

const LANGUAGES: Language[] = ['fa-IR', 'fa-AF', 'en']

// ─── Translations ──────────────────────────────────────────────

const translations = {
  'fa-IR': {
    brand: 'حسابچه',
    brandFooter: 'سیستم مدیریت کسب‌وکار',
    direction: 'rtl',
    font: 'Vazirmatn, Tahoma, sans-serif',

    reset: {
      title: 'بازنشانی رمز عبور',
      hello: 'سلام،',
      message: 'درخواست بازنشانی رمز عبور برای حساب شما ثبت شده است. برای تغییر رمز روی دکمه زیر کلیک کنید:',
      button: 'بازنشانی رمز عبور',
      expire: 'این لینک تا ۱ ساعت معتبر است.',
      ignore: 'اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.',
    },

    invite: {
      title: '🤝 دعوت به فضای کاری',
      body: (inviter: string, workspace: string) => `<strong>${inviter}</strong> شما را به فضای کاری <strong>${workspace}</strong> در حسابچه دعوت کرده است.`,
      button: 'پذیرفتن دعوت',
      expire: 'این دعوت تا ۷ روز معتبر است.',
      subject: (workspace: string) => `دعوت به فضای کاری ${workspace} در حسابچه`,
    },

    trial: {
      started: {
        title: '🎉 دوره آزمایشی شما شروع شد!',
        body: 'دوره آزمایشی ۷ روزه شما در حسابچه آغاز شد.',
        proNote: 'شما به همه امکانات <strong>Pro</strong> دسترسی دارید.',
        features: ['فاکتور نامحدود', 'گزارشات پیشرفته', 'هوش مصنوعی', 'تیم تا ۱۰ نفر'],
        button: '🚀 ورود به داشبورد',
        subject: '🎉 دوره آزمایشی شما در حسابچه شروع شد',
      },
      ending: {
        title: (days: number) => days === 1 ? '⏰ فردا دوره آزمایشی شما تمام می‌شود!' : `📅 ${days} روز تا پایان دوره آزمایشی شما باقی مانده است.`,
        body: (days: number) => days === 1 
          ? 'فردا دوره آزمایشی شما تمام می‌شود!' 
          : `${days} روز تا پایان دوره آزمایشی شما باقی مانده است.`,
        message: 'برای ادامه استفاده از امکانات Pro، اشتراک خود را ارتقا دهید.',
        button: '🔥 مشاهده پلن‌ها',
        warning: (days: number) => `⏳ ${days} روز دیگر دوره آزمایشی شما به پایان می‌رسد.`,
        subject: (days: number) => `⏰ ${days} روز تا پایان دوره آزمایشی`,
      },
      expired: {
        title: '⛔ دوره آزمایشی شما به پایان رسید',
        body: 'دوره آزمایشی ۷ روزه شما به پایان رسید.',
        message: 'برای ادامه استفاده از امکانات Pro، لطفاً اشتراک خود را ارتقا دهید.',
        button: '🔄 ارتقا به Pro',
        features: ['گزارشات پیشرفته غیرفعال شد', 'هوش مصنوعی غیرفعال شد', 'تیم به ۱ کاربر محدود شد'],
        subject: '⛔ دوره آزمایشی شما به پایان رسید',
      },
    },

    payment: {
      success: {
        title: '✅ پرداخت شما با موفقیت انجام شد',
        body: (plan: string) => `پرداخت شما برای پلن <strong>${plan}</strong> با موفقیت انجام شد.`,
        button: '🚀 ورود به داشبورد',
        subject: (plan: string) => `✅ پرداخت ${plan} با موفقیت انجام شد`,
      },
      failed: {
        title: '❌ پرداخت ناموفق',
        body: (plan: string) => `پرداخت شما برای پلن <strong>${plan}</strong> با مشکل مواجه شد.`,
        message: 'لطفاً اطلاعات پرداخت خود را بررسی و دوباره تلاش کنید.',
        button: '🔄 تلاش مجدد',
        subject: (plan: string) => `❌ پرداخت ${plan} ناموفق بود`,
      },
    },

    common: {
      support: 'سوالی دارید؟',
      supportEmail: 'support@hisabche.com',
      footer: 'hisabche.com',
    },
  },

  'fa-AF': {
    brand: 'حسابچه',
    brandFooter: 'سیستم مدیریت تجارت',
    direction: 'rtl',
    font: 'Vazirmatn, Tahoma, sans-serif',

    reset: {
      title: 'بازنشانی پسورد',
      hello: 'سلام،',
      message: 'درخواست بازنشانی پسورد برای حساب شما ثبت شده است. برای تغییر پسورد روی دکمه زیر کلیک کنید:',
      button: 'بازنشانی پسورد',
      expire: 'این لینک تا ۱ ساعت معتبر است.',
      ignore: 'اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.',
    },

    invite: {
      title: '🤝 دعوت به فضای کاری',
      body: (inviter: string, workspace: string) => `<strong>${inviter}</strong> شما را به فضای کاری <strong>${workspace}</strong> در حسابچه دعوت کرده است.`,
      button: 'پذیرفتن دعوت',
      expire: 'این دعوت تا ۷ روز معتبر است.',
      subject: (workspace: string) => `دعوت به فضای کاری ${workspace} در حسابچه`,
    },

    trial: {
      started: {
        title: '🎉 دوره آزمایشی شما شروع شد!',
        body: 'دوره آزمایشی ۷ روزه شما در حسابچه آغاز شد.',
        proNote: 'شما به همه امکانات <strong>Pro</strong> دسترسی دارید.',
        features: ['فاکتور نامحدود', 'راپورهای پیشرفته', 'هوش مصنوعی', 'تیم تا ۱۰ نفر'],
        button: '🚀 ورود به داشبورد',
        subject: '🎉 دوره آزمایشی شما در حسابچه شروع شد',
      },
      ending: {
        title: (days: number) => days === 1 ? '⏰ فردا دوره آزمایشی شما تمام می‌شود!' : `📅 ${days} روز تا پایان دوره آزمایشی شما باقی مانده است.`,
        body: (days: number) => days === 1 
          ? 'فردا دوره آزمایشی شما تمام می‌شود!' 
          : `${days} روز تا پایان دوره آزمایشی شما باقی مانده است.`,
        message: 'برای ادامه استفاده از امکانات Pro، اشتراک خود را ارتقا دهید.',
        button: '🔥 مشاهده پلن‌ها',
        warning: (days: number) => `⏳ ${days} روز دیگر دوره آزمایشی شما به پایان می‌رسد.`,
        subject: (days: number) => `⏰ ${days} روز تا پایان دوره آزمایشی`,
      },
      expired: {
        title: '⛔ دوره آزمایشی شما به پایان رسید',
        body: 'دوره آزمایشی ۷ روزه شما به پایان رسید.',
        message: 'برای ادامه استفاده از امکانات Pro، لطفاً اشتراک خود را ارتقا دهید.',
        button: '🔄 ارتقا به Pro',
        features: ['راپورهای پیشرفته غیرفعال شد', 'هوش مصنوعی غیرفعال شد', 'تیم به ۱ کاربر محدود شد'],
        subject: '⛔ دوره آزمایشی شما به پایان رسید',
      },
    },

    payment: {
      success: {
        title: '✅ پرداخت شما با موفقیت انجام شد',
        body: (plan: string) => `پرداخت شما برای پلن <strong>${plan}</strong> با موفقیت انجام شد.`,
        button: '🚀 ورود به داشبورد',
        subject: (plan: string) => `✅ پرداخت ${plan} با موفقیت انجام شد`,
      },
      failed: {
        title: '❌ پرداخت ناموفق',
        body: (plan: string) => `پرداخت شما برای پلن <strong>${plan}</strong> با مشکل مواجه شد.`,
        message: 'لطفاً اطلاعات پرداخت خود را بررسی و دوباره تلاش کنید.',
        button: '🔄 تلاش مجدد',
        subject: (plan: string) => `❌ پرداخت ${plan} ناموفق بود`,
      },
    },

    common: {
      support: 'سوالی دارید؟',
      supportEmail: 'support@hisabche.com',
      footer: 'hisabche.com',
    },
  },

  'en': {
    brand: 'Hisabche',
    brandFooter: 'Business Management System',
    direction: 'ltr',
    font: 'Inter, Arial, sans-serif',

    reset: {
      title: 'Reset Your Password',
      hello: 'Hello,',
      message: 'A password reset request has been made for your account. Click the button below to reset your password:',
      button: 'Reset Password',
      expire: 'This link is valid for 1 hour.',
      ignore: 'If you did not request this, please ignore this email.',
    },

    invite: {
      title: '🤝 Workspace Invitation',
      body: (inviter: string, workspace: string) => `<strong>${inviter}</strong> invited you to join the <strong>${workspace}</strong> workspace on Hisabche.`,
      button: 'Accept Invitation',
      expire: 'This invitation is valid for 7 days.',
      subject: (workspace: string) => `Invitation to join ${workspace} on Hisabche`,
    },

    trial: {
      started: {
        title: '🎉 Your Trial Has Started!',
        body: 'Your 7-day trial of Hisabche has begun.',
        proNote: 'You have access to all <strong>Pro</strong> features.',
        features: ['Unlimited Invoices', 'Advanced Reports', 'AI Assistant', 'Team up to 10 members'],
        button: '🚀 Go to Dashboard',
        subject: '🎉 Your Trial Has Started',
      },
      ending: {
        title: (days: number) => days === 1 ? '⏰ Your trial ends tomorrow!' : `📅 ${days} days left in your trial`,
        body: (days: number) => days === 1 
          ? 'Your trial ends tomorrow!' 
          : `${days} days left in your trial.`,
        message: 'Upgrade to Pro to keep using all features.',
        button: '🔥 View Plans',
        warning: (days: number) => `⏳ ${days} days left in your trial.`,
        subject: (days: number) => `⏰ ${days} days left in your trial`,
      },
      expired: {
        title: '⛔ Your Trial Has Expired',
        body: 'Your 7-day trial has ended.',
        message: 'Upgrade to Pro to continue using all features.',
        button: '🔄 Upgrade to Pro',
        features: ['Advanced Reports disabled', 'AI Assistant disabled', 'Team limited to 1 user'],
        subject: '⛔ Your Trial Has Expired',
      },
    },

    payment: {
      success: {
        title: '✅ Payment Successful',
        body: (plan: string) => `Your payment for <strong>${plan}</strong> was successful.`,
        button: '🚀 Go to Dashboard',
        subject: (plan: string) => `✅ ${plan} Payment Successful`,
      },
      failed: {
        title: '❌ Payment Failed',
        body: (plan: string) => `Your payment for <strong>${plan}</strong> failed.`,
        message: 'Please check your payment details and try again.',
        button: '🔄 Try Again',
        subject: (plan: string) => `❌ ${plan} Payment Failed`,
      },
    },

    common: {
      support: 'Have a question?',
      supportEmail: 'support@hisabche.com',
      footer: 'hisabche.com',
    },
  },
}

// ─── Helper: Get User Language with Cache ─────────────────────

async function getUserLanguage(userId: string): Promise<Language> {
  const cacheKey = `user:lang:${userId}`
  
  // ✅ کش کردن زبان کاربر
  const cached = await memoryCache.get(cacheKey)
  if (cached) return cached as Language

  try {
    const { data: user } = await supabase
      .from('users')
      .select('preferred_language')
      .eq('id', userId)
      .single()

    const lang = user?.preferred_language || 'fa-IR'
    const result = LANGUAGES.includes(lang) ? lang : 'fa-IR'
    
    // ✅ ذخیره در کش به مدت ۱ ساعت
    await memoryCache.set(cacheKey, result, 3600)
    return result
  } catch {
    return 'fa-IR'
  }
}

// ─── Templates ──────────────────────────────────────────────────

function buildEmailHtml(
  lang: Language,
  title: string,
  body: string,
  buttonText?: string,
  buttonUrl?: string,
  extraContent?: string,
  warningText?: string,
): string {
  const t = translations[lang]
  const dir = t.direction
  const font = t.font

  return `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: ${font}; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #12C8A0, #0EA5E9); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .body { padding: 32px 24px; color: #1a1a2e; font-size: 14px; line-height: 1.8; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #12C8A0, #0EA5E9); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 14px; margin: 16px 0; }
    .features { background: #f8fafc; padding: 16px 20px; border-radius: 8px; margin: 12px 0; }
    .features li { margin: 4px 0; }
    .warning { background: #fef3c7; padding: 12px 16px; border-radius: 8px; border-right: 4px solid #f59e0b; margin: 12px 0; }
    .expire { font-size: 12px; color: #888; margin-top: 16px; }
    .footer { padding: 20px 24px; background: #fafafa; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; }
    a { color: #12C8A0; }
    .details { background: #f8fafc; padding: 16px 20px; border-radius: 8px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="body">
      ${warningText ? `<div class="warning">${warningText}</div>` : ''}
      <p>${body}</p>
      ${extraContent ? extraContent : ''}
      ${buttonText && buttonUrl ? `<div style="text-align: center;"><a href="${buttonUrl}" class="button">${buttonText}</a></div>` : ''}
      <p style="font-size: 12px; color: #888;">${t.common.support} <a href="mailto:${t.common.supportEmail}">${t.common.supportEmail}</a></p>
    </div>
    <div class="footer">
      <p>${t.brand} — ${t.brandFooter}</p>
      <p>${t.common.footer}</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Email Queue (برای جلوگیری از ارسال همزمان) ──────────────

let emailQueue: { to: string; subject: string; html: string; resolve: (value: any) => void; reject: (error: any) => void }[] = []
let isProcessingQueue = false

async function processEmailQueue() {
  if (isProcessingQueue || emailQueue.length === 0) return
  
  isProcessingQueue = true
  
  while (emailQueue.length > 0) {
    const item = emailQueue.shift()
    if (!item) continue
    
    try {
      const result = await emailService._send(item.to, item.subject, item.html)
      item.resolve(result)
    } catch (error) {
      item.reject(error)
    }
    
    // ✅ فاصله بین ایمیل‌ها (برای جلوگیری از Rate Limit)
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  isProcessingQueue = false
}

// ─── Email Service ─────────────────────────────────────────────

export const emailService = {
  // ─── Internal send ──────────────────────────────────────────
  async _send(to: string, subject: string, html: string) {
    console.log('[EMAIL] ====== SEND START ======')
    console.log('[EMAIL] To:', to)
    console.log('[EMAIL] From:', `${FROM_NAME} <${FROM_EMAIL}>`)
    console.log('[EMAIL] Subject:', subject)
    console.log('[EMAIL] HTML length:', html.length)

    if (!resend) {
      console.warn('[EMAIL] ⚠️ Resend not configured. Email not sent.')
      return { success: false, error: 'Resend not configured' }
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      })

      if (error) {
        console.error('[EMAIL] ❌ Resend error:', JSON.stringify(error, null, 2))
        return { success: false, error }
      }

      console.log('[EMAIL] ✅ Sent! ID:', data?.id)
      console.log('[EMAIL] ====== SEND END ======')
      return { success: true, id: data?.id }
    } catch (err: any) {
      console.error('[EMAIL] ❌ Exception:', err?.message || err)
      return { success: false, error: err }
    }
  },

  // ─── Send email (با Queue) ──────────────────────────────────
  async send({ to, subject, html }: SendEmailParams) {
    return new Promise((resolve, reject) => {
      emailQueue.push({ to, subject, html, resolve, reject })
      processEmailQueue()
    })
  },

  // ─── Helper: Get user language ──────────────────────────────
  async getUserLanguage(userId: string): Promise<Language> {
    return getUserLanguage(userId)
  },

  // ─── Reset Password ──────────────────────────────────────────
  async sendResetPassword(to: string, resetLink: string, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const html = buildEmailHtml(
      lang,
      t.reset.title,
      `${t.reset.hello} ${t.reset.message}`,
      t.reset.button,
      resetLink,
      `<p class="expire">⏰ ${t.reset.expire}</p><p style="font-size: 12px; color: #888;">${t.reset.ignore}</p>`,
    )
    return this.send({ to, subject: `${t.reset.title} - ${t.brand}`, html })
  },

  // ─── Workspace Invite ─────────────────────────────────────────
  async sendWorkspaceInvite(to: string, inviterName: string, workspaceName: string, inviteLink: string, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const html = buildEmailHtml(
      lang,
      t.invite.title,
      t.invite.body(inviterName, workspaceName),
      t.invite.button,
      inviteLink,
      `<p class="expire">⏰ ${t.invite.expire}</p>`,
    )
    return this.send({ to, subject: t.invite.subject(workspaceName), html })
  },

  // ─── Trial Started ───────────────────────────────────────────
  async sendTrialStarted(to: string, name: string, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const featuresHtml = t.trial.started.features.map(f => `<li>✅ ${f}</li>`).join('')
    const extraContent = `
      <p>${t.trial.started.proNote}</p>
      <div class="features"><ul>${featuresHtml}</ul></div>
    `
    const html = buildEmailHtml(
      lang,
      t.trial.started.title,
      `${t.trial.started.body}`,
      t.trial.started.button,
      'https://hisabche.com/dashboard',
      extraContent,
    )
    return this.send({ to, subject: t.trial.started.subject, html })
  },

  // ─── Trial Ending Soon ──────────────────────────────────────
  async sendTrialEndingSoon(to: string, name: string, daysLeft: number, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const html = buildEmailHtml(
      lang,
      t.trial.ending.title(daysLeft),
      `${t.trial.ending.body(daysLeft)} ${t.trial.ending.message}`,
      t.trial.ending.button,
      'https://hisabche.com/pricing',
      '',
      t.trial.ending.warning(daysLeft),
    )
    return this.send({ to, subject: t.trial.ending.subject(daysLeft), html })
  },

  // ─── Trial Expired ──────────────────────────────────────────
  async sendTrialExpired(to: string, name: string, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const featuresHtml = t.trial.expired.features.map(f => `<li>📊 ${f}</li>`).join('')
    const extraContent = `
      <p>${t.trial.expired.message}</p>
      <div class="features"><ul>${featuresHtml}</ul></div>
    `
    const html = buildEmailHtml(
      lang,
      t.trial.expired.title,
      t.trial.expired.body,
      t.trial.expired.button,
      'https://hisabche.com/pricing',
      extraContent,
    )
    return this.send({ to, subject: t.trial.expired.subject, html })
  },

  // ─── Payment Success ─────────────────────────────────────────
  async sendPaymentSuccess(to: string, data: EmailData, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const planName = data.plan || 'Pro'
    const extraContent = `
      <div class="details">
        <ul>
          <li>💰 ${data.amount ? `${data.amount.toLocaleString()} ${data.currency || 'USD'}` : ''}</li>
          <li>📋 ${planName}</li>
        </ul>
      </div>
    `
    const html = buildEmailHtml(
      lang,
      t.payment.success.title,
      t.payment.success.body(planName),
      t.payment.success.button,
      'https://hisabche.com/dashboard',
      extraContent,
    )
    return this.send({ to, subject: t.payment.success.subject(planName), html })
  },

  // ─── Payment Failed ──────────────────────────────────────────
  async sendPaymentFailed(to: string, data: EmailData, lang: Language = 'fa-IR') {
    const t = translations[lang]
    const planName = data.plan || 'Pro'
    const extraContent = `
      <div class="details">
        <ul>
          <li>💰 ${data.amount ? `${data.amount.toLocaleString()} ${data.currency || 'USD'}` : ''}</li>
          <li>📋 ${planName}</li>
        </ul>
      </div>
      <p>${t.payment.failed.message}</p>
    `
    const html = buildEmailHtml(
      lang,
      t.payment.failed.title,
      t.payment.failed.body(planName),
      t.payment.failed.button,
      'https://hisabche.com/billing',
      extraContent,
    )
    return this.send({ to, subject: t.payment.failed.subject(planName), html })
  },

  // ─── Generic send with language detection ──────────────────
  async sendWithLanguage(to: string, template: 'trialStarted' | 'trialEndingSoon' | 'trialExpired' | 'paymentSuccess' | 'paymentFailed', data: EmailData) {
    let lang: Language = 'fa-IR'
    try {
      const { data: user } = await supabase
        .from('users')
        .select('preferred_language')
        .eq('email', to)
        .single()
      if (user?.preferred_language && LANGUAGES.includes(user.preferred_language)) {
        lang = user.preferred_language
      }
    } catch {
      // fallback
    }

    switch (template) {
      case 'trialStarted':
        return this.sendTrialStarted(to, data.name, lang)
      case 'trialEndingSoon':
        return this.sendTrialEndingSoon(to, data.name, data.daysLeft || 0, lang)
      case 'trialExpired':
        return this.sendTrialExpired(to, data.name, lang)
      case 'paymentSuccess':
        return this.sendPaymentSuccess(to, data, lang)
      case 'paymentFailed':
        return this.sendPaymentFailed(to, data, lang)
      default:
        return { success: false, error: 'Unknown template' }
    }
  },

  // ─── Check Resend Status ────────────────────────────────────
  isConfigured(): boolean {
    return !!resend
  },
}

export default emailService