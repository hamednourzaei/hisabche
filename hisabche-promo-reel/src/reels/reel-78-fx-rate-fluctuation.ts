// ============================================
// Reel 78: Multi-Currency & FX Gain/Loss — Fluctuation Shield (Bespoke Cut)
//
// The Multi-Currency Vault & Automated FX Gain/Loss Shield
// High-conversion financial precision narrative for multi-currency merchants.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  DualCurrencyTelemetryScene,
  FxCtaScene,
  FxGainLossRecognitionScene,
  FxJournalVoucherScene,
  FxShieldManifestoScene,
  FxShockDilemmaScene,
} from '../scenes/fx-rate-fluctuation'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Arrest: The FX Fluctuation Shock
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: FxShockDilemmaScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.4, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'صبح جنس رو با یک نرخ ارز فروختی، عصر که پول واریز شد نرخ پرید؛ سود کردی یا ضرر؟',
    },

    // 2 — Multi-Currency Dual-Ledger Telemetry
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: DualCurrencyTelemetryScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.2, kind: 'tick' },
          { at: 5.2, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در حسابچه هیچ فاکتور ارزی بدون نرخ روز ثبت نمی‌شه؛ سیستم خودش مابه‌التفاوت رو در سرفصل تسعیر ثبت می‌کنه.',
    },

    // 3 — Automated FX Gain/Loss Recognition
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: FxGainLossRecognitionScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.6, kind: 'tick' },
          { at: 3.6, kind: 'cash' },
          { at: 5.4, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'مابه‌التفاوت نرخ ارز در لحظه تسویه دقیقاً شناسایی شده و سود واقعی از سود تسعیر تفکیک می‌شود.',
    },

    // 4 — Automatic Double-Entry Journal Voucher
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: FxJournalVoucherScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.6, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'سند دوبل مالی مطابق استاندارد رسمی به دفتر کل می‌رود و تراز ارزی بدون ۱ ریال مغایرت بسته می‌شود.',
    },

    // 5 — Currency Fluctuation Shield Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: FxShieldManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.4, kind: 'whoosh' },
          { at: 3.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'نه سود کاغذی موهوم، نه زیان پنهان از نوسان؛ شفافیت و کنترل کامل در معاملات چندارزی.',
    },

    // 6 — High-Impact Brand Monolith & CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: FxCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابداری چندارزی حسابچه؛ همین امروز دوره رایگان خود را فعال کنید.',
    },
  ],
  { noZoom: true },
)

export const reel78: Reel = {
  id: '78',
  title: 'نرخ ارز و تسعیر: نوسان قیمت در تسویه؛ سود و زیان تسعیر کجاست؟',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'محو شدن سود بازرگان به دلیل نوسانات شدید نرخ ارز میان تاریخ فاکتور و وصول',
    oldWorkflow: 'ثبت فاکتور ارزی بدون ثبت نرخ تبدیل و حساب‌وکتاب در اکسل‌های نامطمئن',
    friction: 'تاجر فکر می‌کند فاکتور پر سود بوده، در حالی که پس از تسعیر با زیان بسته شده است',
    hisabcheAction: 'فاکتور ارزی با نرخ اجباری روز، جدول نرخ‌های لحظه‌ای و سند خودکار تسعیر',
    automatedResult: 'ثبت تفکیک‌شده سود بازرگانی و سود/زیان تسعیر ارز در ترازنامه رسمی',
    businessOutcome: 'کنترل کامل ریسک نوسان ارز و امنیت کامل سرمایه در معاملات مرزی و بین‌المللی',
    emotionalPayoff: 'تسلط کامل بر چند ارز بدون یک واحد مغایرت در پایان سال',
    cta: 'چندارزی در hisabche.com',
    selectedOperators: ['ContinuousLineMorph', 'VectorThreadDraw', 'DualBoxCtaHold'],
  },
}
