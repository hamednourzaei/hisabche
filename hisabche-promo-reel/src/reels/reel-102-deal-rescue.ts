// ============================================
// Reel 102 — «تراز نقدینگی و چک‌های سررسید» (Cashflow Blindness & Cheque Liquidity)
// Distinct Art Direction: Swiss Editorial & Financial Intelligence
// Palette: Alabaster / Navy / Terracotta Alert
// Hard Rule 20: noZoom: true locked across reel & sequence.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  CashCalendarScene,
  CashflowCtaScene,
  CashflowShockScene,
  LiquidityForecastScene,
  TrappedReceivablesScene,
} from '../scenes/cashflow-cheques'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 7.2,
      spec: {
        kind: 'bespoke',
        theme: 'swiss-editorial',
        component: CashflowShockScene,
        cues: [
          { at: 0.1, kind: 'alert' },
          { at: 1.2, kind: 'tick' },
          { at: 3.2, kind: 'titleHit' },
          { at: 5.8, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'دخلت شلوغه و فروشت هم بالاست؛ اما چرا موقع پاس کردن چک‌ها، حسابت خالیه؟',
    },
    {
      dur: 7.2,
      spec: {
        kind: 'bespoke',
        theme: 'swiss-editorial',
        component: TrappedReceivablesScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.5, kind: 'alert' },
          { at: 4.8, kind: 'tick' },
          { at: 6.4, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'چون نسیه‌ها توی بازار خوابیده، سررسیدها رو دستی نوشتی و وصول مطالبات از دستت در رفته!',
    },
    {
      dur: 10.8,
      spec: {
        kind: 'bespoke',
        theme: 'swiss-editorial',
        component: CashCalendarScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.9, kind: 'precisionSequence' },
          { at: 4.5, kind: 'sync' },
          { at: 8.5, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'با تقویم نقدینگی «حسابچه»، سیستم سه روز قبل از سررسید پیامک یادآوری محترمانه به همراه لینک پرداخت برای مشتری می‌فرسته.',
    },
    {
      dur: 9.4,
      spec: {
        kind: 'bespoke',
        theme: 'swiss-editorial',
        component: LiquidityForecastScene,
        cues: [
          { at: 0.4, kind: 'cardEnter' },
          { at: 2.8, kind: 'dataFlow' },
          { at: 6.5, kind: 'cash' },
        ] as Cue[],
      },
      vo: 'قبل از اینکه موعد چکت برسه، پول به حسابت برگشته و خیالت از برگشت نخوردن چک‌ها راحته.',
    },
    {
      dur: 6.6,
      spec: {
        kind: 'bespoke',
        theme: 'swiss-editorial',
        component: CashflowCtaScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.0, kind: 'ctaResolution' },
          { at: 4.6, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'همین الان کلمه «حسابچه» رو ارسال کن تا ماژول نقدینگی و چک‌ها رو رایگان تست کنی!',
    },
  ],
  { noZoom: true },
)

export const reel102: Reel = {
  id: '102',
  title: 'تراز نقدینگی و مدیریت چک‌های سررسید — خداحافظی با چک برگشتی',
  duration: total(scenes),
  scenes,
  theme: 'swiss-editorial',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'کمبود نقدینگی در موعد پاس شدن چک‌ها به دلیل تاخیر در وصول نسیه‌ها',
    oldWorkflow: 'ثبت چک در سررسید کاغذی و تماس‌های تلفنی معذب‌کننده با بدهکاران',
    friction: 'فراموشی بدهی‌ها، برگشت خوردن چک تامین‌کننده و بدحسابی در بازار',
    hisabcheAction: 'تقویم هوشمند نقدینگی و ارسال پیامک خودکار یادآور سررسید با لینک پرداخت',
    automatedResult: 'وصول به موقع طلب‌ها و تامین موجودی حساب قبل از تاریخ سررسید چک',
    businessOutcome: 'اعتبار ۱۰۰٪ بانکی و صفر شدن چک‌های برگشتی در کسب‌وکار',
    emotionalPayoff: 'آرامش خاطر از پاس شدن چک‌ها و نظم کامل در جریان نقدینگی',
    cta: 'ارسال کلمه حسابچه برای تست رایگان ماژول چک و نقدینگی',
    selectedOperators: [
      'CashDeficitWarning',
      'DebtorAgingRadar',
      'AutoSmsReminder',
      'PaymentLinkFlow',
      'PositiveCashBalance',
      'TestAccountReveal',
    ],
  },
}
