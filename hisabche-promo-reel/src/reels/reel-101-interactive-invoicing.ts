// ============================================
// Reel 101 — «فاکتور جادویی و انبار زنده» (Interactive Invoicing & Auto-Stock Sync)
// Style Reference: Vercel / Linear / Stripe Checkout Motion
//
// 1. Hook: The "30-Minute Invoice" Deal Killer + Burning Lead Card & Hands-on-head Avatar
// 2. Pain: Excel Formula Errors + Selling Out-of-Stock Items Disaster
// 3. Solution: Interactive Spreadsheet-Style Invoice + Instant Calculation + Pointing Avatar
// 4. Automation: Real-Time Inventory Deduction + Direct Payment/PDF Link + Cash Flow Chart
// 5. CTA: Instant VIP Sandbox Unlock + Confident Avatar
//
// Hard Rule 20: noZoom: true locked across reel & sequence.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  InvoiceCtaScene,
  InvoiceInteractiveGridScene,
  InvoiceInventorySyncScene,
  InvoiceLostDealScene,
  InvoiceSpreadsheetErrorScene,
} from '../scenes/interactive-invoicing'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–7.20s) — هوک میخکوب‌کننده: پریدن مشتری در زمان انتظار برای پیش‌فاکتور
    {
      dur: 7.2,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: InvoiceLostDealScene,
        cues: [
          { at: 0.1, kind: 'alert' },
          { at: 1.4, kind: 'clockTickRapid' },
          { at: 3.5, kind: 'titleHit' },
          { at: 5.8, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'میدونی چند تا مشتری آماده به خرید رو فقط به‌خاطر اینکه صدور پیش‌فاکتورت نیم ساعت طول کشید، دو دستی تقدیم رقیبت کردی؟',
    },

    // 2 (7.20–14.40s) — تشدید درد: خطای فرمول‌های اکسل و فروختن جنس ناموجود در انبار
    {
      dur: 7.2,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: InvoiceSpreadsheetErrorScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.1, kind: 'alert' },
          { at: 4.3, kind: 'tick' },
          { at: 6.4, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'یا وسط شلوغی تو اکسل قیمت رو اشتباه زدی، یا تازه بعد از واریز پول فهمیدی اصلاً اون کالا رو تو انبار نداری!',
    },

    // 3 (14.40–25.20s) — راه‌حل حسابچه: جدول فاکتور تعاملی، سریع و متصل به لیست کالاها
    {
      dur: 10.8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: InvoiceInteractiveGridScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.9, kind: 'precisionSequence' },
          { at: 4.8, kind: 'sync' },
          { at: 8.5, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'با فاکتور هوشمند «حسابچه»، توی ده ثانیه کالا رو انتخاب کن تا قیمت، تخفیف و مالیات خودکار حساب بشه و لینک فاکتور مستقیم بره روی گوشی مشتری!',
    },

    // 4 (25.20–34.60s) — اتوماسیون پشت‌صحنه: کسر آنی از انبار و آپدیت تراز مالی و بدهکاران
    {
      dur: 9.4,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: InvoiceInventorySyncScene,
        cues: [
          { at: 0.4, kind: 'cardEnter' },
          { at: 2.8, kind: 'dataFlow' },
          { at: 6.5, kind: 'cash' },
        ] as Cue[],
      },
      vo: 'به محض تایید فاکتور، موجودی انبارت خودکار کم میشه، سود خالصت حساب میشه و سیستم سررسید چک و بدهی مشتری رو بهت یادآوری میکنه.',
    },

    // 5 (34.60–41.20s) — دعوت به اقدام (CTA)
    {
      dur: 6.6,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: InvoiceCtaScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.0, kind: 'ctaResolution' },
          { at: 4.6, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'همین الان کلمه «حسابچه» رو کامنت کن تا اکانت تست رایگان رو برات بفرستم و اولین فاکتورتو ثبت کنی!',
    },
  ],
  { noZoom: true },
)

export const reel101: Reel = {
  id: '101',
  title: 'اکسپلینر فاکتور هوشمند و انبار زنده — صدور پیش‌فاکتور ۱۰ ثانیه‌ای با حسابچه',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'از دست رفتن مشتری به خاطر کندی صدور پیش‌فاکتور و ناهماهنگی موجودی انبار با فروش',
    oldWorkflow:
      'صدور فاکتور دستی در اکسل یا کاغذ، استعلام تلفنی موجودی انبار و محاسبه دستی با ماشین‌حساب',
    friction: 'خطای محاسباتی در تخفیف/مالیات، فروش کالای ناموجود و فراموشی مطالبات و چک‌ها',
    hisabcheAction: 'رابط کاربری فاکتور تعاملی (Spreadsheet UI) متصل به بانک کالا و انبار ابری',
    automatedResult:
      'صدور فاکتور در ۱۰ ثانیه، کسر خودکار از انبار، محاسبه سود و یادآور خودکار بدهکاران',
    businessOutcome: 'افزایش نرخ تبدیل فروش (Conversion Rate) و حذف ۱۰۰٪ خطاهای مالی و انبارداری',
    emotionalPayoff: 'حس حرفه‌ای بودن جلوی مشتری و خیال راحت از دقیق بودن حساب‌وکتاب و موجودی',
    cta: 'ارسال کلمه حسابچه برای دریافت اکانت تست رایگان',
    selectedOperators: [
      'BurningLeadTimer',
      'BrokenExcelFormula',
      'InteractiveInvoiceGrid',
      'LiveInventoryGauge',
      'ProfitAndReceivablesPulse',
      'TestAccountReveal',
    ],
  },
}
