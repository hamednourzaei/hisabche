// ============================================
// Reel 77: Tiered Price Lists — Confidential Pricing Shield (Bespoke Cut)
//
// The Confidential Multi-Tier Price Matrix & Margin Shield
// High-conversion pricing protection narrative for wholesalers & distributors.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AutoPricingCheckoutScene,
  CommercialPrestigeManifestoScene,
  LeakedDiscountShockScene,
  MarginProtectionGuardScene,
  MultiTierPriceMatrixScene,
  TieredCtaScene,
} from '../scenes/tiered-price-lists'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Arrest: The Leaked Discount Shock
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: LeakedDiscountShockScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.4, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'صندوقدار قیمت همکار رو جلوی مشتری عادی لو داد؛ چطور قیمت‌های چندگانه را بدون اشتباه مدیریت کنیم؟',
    },

    // 2 — Multi-Tier Price Matrix Engine
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: MultiTierPriceMatrixScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.2, kind: 'tick' },
          { at: 5.2, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در حسابچه چندین لیست قیمت می‌سازی؛ برای مشتری همکار، عمده، خرده و نمایندگی.',
    },

    // 3 — Zero-Friction 1-Click Auto Pricing
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: AutoPricingCheckoutScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.6, kind: 'tick' },
          { at: 3.6, kind: 'cash' },
          { at: 5.4, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'با انتخاب نام مشتری، نرخ مخصوص او خودکار لود می‌شود؛ بدون نیاز به حفظ کردن تخفیف یا چانه‌زنی.',
    },

    // 4 — Margin Protection & Discount Guard
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: MarginProtectionGuardScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.6, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'حاشیه سود شما محافظت می‌شود و پرسنل اجازه اعمال تخفیف زیر کف قیمت تعیین‌شده را نخواهند داشت.',
    },

    // 5 — Commercial Prestige Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: CommercialPrestigeManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.4, kind: 'whoosh' },
          { at: 3.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'نه حفظ کردن تخفیف‌ها، نه چانه‌زنی؛ پرستیژ و نظم حرفه‌ای در پیشخوان فروشگاه شما.',
    },

    // 6 — High-Impact Brand Monolith & CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: TieredCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'سیستم قیمت‌گذاری هوشمند حسابچه؛ همین امروز دوره رایگان خود را فعال کنید.',
    },
  ],
  { noZoom: true },
)

export const reel77: Reel = {
  id: '77',
  title: 'فهرست قیمت و تخفیف گروهی: برای همکار چند، برای مشتری گذری چند؟',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'اشتباه فروشنده پای فاکتور، لو رفتن تخفیف همکار پیش مشتری عادی و زیان قیمت',
    oldWorkflow: 'حفظ کردن تخفیف‌ها در ذهن یا یادداشت روی کاغذهای پراکنده پای پیشخوان',
    friction: 'صندوقدار به مشتری عادی قیمت همکار داد یا به همکار قدیمی تخفیف نداد و شاکی شد',
    hisabcheAction: 'چندین لیست قیمت (همکار، عمده، خرده، طلایی) و اعمال خودکار بر اساس پرونده',
    automatedResult: 'انتخاب مشتری = لود آنی نرخ مخصوص او بدون امکان دستکاری یا مشاهده سایرین',
    businessOutcome: 'حفظ اسرار تجاری تخفیف‌ها، افزایش رضایت شرکا و حاشیه سود سالم',
    emotionalPayoff: 'پرستیژ شرکتی و اعتبار بالا نزد تمام مشتریان بازار',
    cta: 'لیست قیمت در hisabche.com',
    selectedOperators: ['TactilePaperSlide', 'HighlighterStrike', 'DualBoxCtaHold'],
  },
}
